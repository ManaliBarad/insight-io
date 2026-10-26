// Thin wrapper around roslibjs. Connects to rosbridge, subscribes to the
// robot's topics and keeps retrying in the background, so the dashboard falls
// back to the simulator whenever ROS is not reachable.

import { decodePointCloud2 } from './pointcloud2';

const quatToYaw = ({ x, y, z, w }) => Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));

export class RosBridge {
  constructor(config, handlers) {
    this.config = config;
    this.handlers = handlers; // { onStatus, onOdom, onPoints, onImage, onBattery }
    this.status = config.enabled ? 'connecting' : 'disabled';
    this.ros = null;
    this.topics = {};
    this.retry = 0;
    this.disposed = false;
  }

  setStatus(status) {
    if (status === this.status) return;
    this.status = status;
    this.handlers.onStatus?.(status);
  }

  async connect() {
    if (!this.config.enabled || this.disposed) return;
    // Loaded lazily so a missing / failing ROS stack never blocks the UI.
    const { default: ROSLIB } = await import('roslib');
    if (this.disposed) return;
    this.ROSLIB = ROSLIB;
    // Stay on 'offline' during background retries so the UI doesn't flicker.
    if (this.status !== 'offline') this.setStatus('connecting');

    const ros = new ROSLIB.Ros({ url: this.config.url });
    this.ros = ros;
    ros.on('connection', () => {
      this.setStatus('connected');
      this.subscribe();
    });
    ros.on('error', () => {}); // 'close' always follows; handled there
    ros.on('close', () => {
      if (this.ros !== ros) return;
      this.unsubscribe();
      this.setStatus('offline');
      if (!this.disposed) this.retry = setTimeout(() => this.connect(), this.config.retryMs);
    });
  }

  subscribe() {
    const { ROSLIB, ros } = this;
    const t = this.config.topics;
    const sub = (name, messageType, throttle, cb) => {
      const topic = new ROSLIB.Topic({ ros, name, messageType, throttle_rate: throttle, queue_length: 1 });
      topic.subscribe(cb);
      this.topics[name] = topic;
    };

    sub(t.odom, 'nav_msgs/msg/Odometry', 40, (m) => {
      const p = m.pose.pose;
      const v = m.twist?.twist;
      this.handlers.onOdom?.(p.position.x, p.position.y, quatToYaw(p.orientation), v?.linear.x ?? 0, v?.angular.z ?? 0);
    });
    sub(t.points, 'sensor_msgs/msg/PointCloud2', 1000, (m) => {
      const cloud = decodePointCloud2(m);
      if (cloud?.count) this.handlers.onPoints?.(cloud);
    });
    sub(t.camera, 'sensor_msgs/msg/CompressedImage', 66, (m) => {
      const fmt = m.format?.includes('png') ? 'png' : 'jpeg';
      this.handlers.onImage?.(`data:image/${fmt};base64,${m.data}`);
    });
    sub(t.battery, 'sensor_msgs/msg/BatteryState', 1000, (m) => {
      const pct = m.percentage <= 1 ? m.percentage * 100 : m.percentage;
      if (Number.isFinite(pct)) this.handlers.onBattery?.(pct);
    });

    this.cmdVel = new ROSLIB.Topic({ ros, name: t.cmdVel, messageType: 'geometry_msgs/msg/Twist' });
    this.goal = new ROSLIB.Topic({ ros, name: t.goal, messageType: 'geometry_msgs/msg/PoseStamped' });
  }

  unsubscribe() {
    Object.values(this.topics).forEach((topic) => topic.unsubscribe());
    this.topics = {};
    this.cmdVel = null;
    this.goal = null;
  }

  publishCmdVel(linear, angular) {
    this.cmdVel?.publish({ linear: { x: linear, y: 0, z: 0 }, angular: { x: 0, y: 0, z: angular } });
  }

  publishGoal({ x, y }, yaw = 0) {
    const now = Date.now();
    this.goal?.publish({
      header: { frame_id: 'map', stamp: { sec: Math.floor(now / 1000), nanosec: (now % 1000) * 1e6 } },
      pose: { position: { x, y, z: 0 }, orientation: { x: 0, y: 0, z: Math.sin(yaw / 2), w: Math.cos(yaw / 2) } },
    });
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.retry);
    this.unsubscribe();
    const ros = this.ros;
    this.ros = null;
    ros?.close();
  }
}
