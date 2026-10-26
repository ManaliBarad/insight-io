// A tiny stand-in for rosbridge, for trying the ROS integration without ROS.
//
//   npm run mock:ros      (then: npm run dev)
//
// Speaks the rosbridge v2 JSON protocol on ws://localhost:9090 and fakes a robot:
//   publishes  /odom, /points (the sample warehouse), /camera/image_raw/compressed, /battery_state
//   listens to /cmd_vel (MANUAL driving) and /goal_pose (INITIATE: drives to the goal)

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const map = JSON.parse(readFileSync(resolve(root, 'public/data/map.json'), 'utf8'));
const cameraJpeg = readFileSync(resolve(root, 'docs/camera-view.jpg')).toString('base64');

// Re-publish the sample .pcd as a PointCloud2 (its binary body is already x y z rgb, 16 bytes/point).
function warehouseCloud() {
  const file = readFileSync(resolve(root, 'public/data', map.cloud));
  const headerEnd = file.indexOf('DATA binary\n') + 'DATA binary\n'.length;
  const body = file.subarray(headerEnd);
  const count = body.length / 16;
  return {
    header: { frame_id: 'map' },
    height: 1,
    width: count,
    fields: ['x', 'y', 'z'].map((name, i) => ({ name, offset: i * 4, datatype: 7, count: 1 })).concat({ name: 'rgb', offset: 12, datatype: 6, count: 1 }),
    is_bigendian: false,
    point_step: 16,
    row_step: body.length,
    data: body.toString('base64'),
    is_dense: true,
  };
}
const cloud = warehouseCloud();

// Fake robot state
const robot = { ...map.start, linear: 0, angular: 0 };
let cmd = { linear: 0, angular: 0, at: 0 };
let goal = null;

function step(dt) {
  let linear = 0;
  let angular = 0;
  if (goal) {
    const dx = goal.x - robot.x;
    const dy = goal.y - robot.y;
    const err = Math.atan2(Math.sin(Math.atan2(dy, dx) - robot.yaw), Math.cos(Math.atan2(dy, dx) - robot.yaw));
    angular = Math.max(-1, Math.min(1, 2 * err));
    linear = Math.min(0.8, Math.hypot(dx, dy)) * Math.max(0, Math.cos(err));
    if (Math.hypot(dx, dy) < 0.2) goal = null;
  } else if (Date.now() - cmd.at < 500) {
    // cmd_vel times out after 0.5 s like a real base controller
    ({ linear, angular } = cmd);
  }
  robot.yaw += angular * dt;
  robot.x += Math.cos(robot.yaw) * linear * dt;
  robot.y += Math.sin(robot.yaw) * linear * dt;
  Object.assign(robot, { linear, angular });
}

const wss = new WebSocketServer({ port: 9090 });
wss.on('connection', (ws) => {
  console.log('client connected');
  const subscribed = new Set();
  const publish = (topic, msg) => subscribed.has(topic) && ws.send(JSON.stringify({ op: 'publish', topic, msg }));

  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.op === 'subscribe') subscribed.add(m.topic);
    if (m.op === 'unsubscribe') subscribed.delete(m.topic);
    if (m.op !== 'publish') return;
    if (m.topic === '/cmd_vel') {
      cmd = { linear: m.msg.linear.x, angular: m.msg.angular.z, at: Date.now() };
      goal = null; // like a twist_mux, teleop / E-stop commands override navigation
    }
    if (m.topic === '/goal_pose') {
      goal = m.msg.pose.position;
      console.log(`goal received: (${goal.x.toFixed(2)}, ${goal.y.toFixed(2)})`);
    }
  });

  let sentCloud = false;
  const timers = [
    setInterval(() => {
      step(0.05);
      const q = { x: 0, y: 0, z: Math.sin(robot.yaw / 2), w: Math.cos(robot.yaw / 2) };
      publish('/odom', {
        header: { frame_id: 'odom' },
        pose: { pose: { position: { x: robot.x, y: robot.y, z: 0 }, orientation: q } },
        twist: { twist: { linear: { x: robot.linear, y: 0, z: 0 }, angular: { x: 0, y: 0, z: robot.angular } } },
      });
    }, 50),
    setInterval(() => publish('/camera/image_raw/compressed', { format: 'jpeg', data: cameraJpeg }), 200),
    setInterval(() => publish('/battery_state', { percentage: 0.87 }), 1000),
    // The map doesn't change, so send it once the client has subscribed.
    setInterval(() => {
      if (sentCloud || !subscribed.has('/points')) return;
      publish('/points', cloud);
      sentCloud = true;
    }, 500),
  ];
  ws.on('close', () => {
    timers.forEach(clearInterval);
    console.log('client disconnected');
  });
});

console.log('Mock rosbridge listening on ws://localhost:9090');
