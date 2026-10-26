// Wires the simulator, ROS bridge and Three.js world together and exposes a
// low-frequency telemetry snapshot to React. The 60 fps loop never touches
// React state.

import { useEffect, useRef, useState } from 'react';
import { config } from '../config';
import { RosBridge } from '../ros/RosBridge';
import { RobotSim } from '../sim/RobotSim';
import { World } from '../three/World';

const STALE_MS = 2000;
const CMD_PERIOD_MS = 100;

export function useRobotEngine({ onArrive }) {
  const [engine] = useState(() => {
    const sim = new RobotSim();
    const world = new World();
    const imageListeners = new Set();
    return {
      sim,
      world,
      ros: null,
      last: { odom: 0, image: 0, cmd: 0, driving: false }, // timestamps (ms) + last drive state
      imageListeners,
      onImage: (cb) => {
        imageListeners.add(cb);
        return () => imageListeners.delete(cb);
      },
    };
  });
  const [telemetry, setTelemetry] = useState(() => snapshot(engine, 'connecting', null));
  const [map, setMap] = useState(null);
  const [loading, setLoading] = useState({ progress: 0, done: false, error: null });
  const arriveRef = useRef(onArrive);
  arriveRef.current = onArrive;

  // Map metadata + point cloud.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meta = await fetch(config.media.mapMeta).then((r) => r.json());
        if (cancelled) return;
        engine.sim.setMap(meta);
        engine.world.setZones(meta.zones || []);
        engine.world.setPose(engine.sim.pose);
        setMap(meta);
        await engine.world.loadPcd(new URL(meta.cloud, new URL(config.media.mapMeta, location.href)).href, (p) =>
          !cancelled && setLoading((l) => ({ ...l, progress: p })),
        );
        if (cancelled) return;
        engine.world.fitView();
        setLoading({ progress: 1, done: true, error: null });
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoading({ progress: 0, done: true, error: 'Could not load the map. Run `npm run generate:map`.' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [engine]);

  // ROS bridge.
  useEffect(() => {
    const { sim, world, last, imageListeners } = engine;
    const ros = new RosBridge(config.ros, {
      onOdom: (x, y, yaw, linear, angular) => {
        last.odom = performance.now();
        sim.setExternalPose(x, y, yaw, linear, angular);
      },
      onPoints: ({ positions, colors }) => world.setCloudArrays(positions, colors),
      onImage: (src) => {
        last.image = performance.now();
        imageListeners.forEach((cb) => cb(src));
      },
      onBattery: (pct) => {
        sim.battery = pct;
      },
    });
    engine.ros = ros;
    ros.connect();
    return () => {
      ros.dispose();
      engine.ros = null;
    };
  }, [engine]);

  // Main loop + telemetry sampling.
  useEffect(() => {
    const { sim, world, last } = engine;
    sim.onArrive = () => arriveRef.current?.();
    world.start((dt) => {
      const now = performance.now();
      if (sim.external && now - last.odom > STALE_MS) sim.external = false;
      const cmd = sim.step(dt);
      if (engine.ros?.status === 'connected' && now - last.cmd > CMD_PERIOD_MS) {
        last.cmd = now;
        // In AUTO with ROS, navigation is delegated to Nav2 via /goal_pose, so
        // /cmd_vel is only sent in MANUAL or on E-stop. When we stop sending,
        // send one zero twist so the robot doesn't keep the last command.
        const drive = sim.control.mode === 'manual' || sim.control.estop;
        if (drive) engine.ros.publishCmdVel(cmd.linear, cmd.angular);
        else if (last.driving) engine.ros.publishCmdVel(0, 0);
        last.driving = drive;
      }
      return sim.pose;
    });
    const id = setInterval(() => {
      const now = performance.now();
      const cameraSource = now - last.image < STALE_MS ? 'ros' : null;
      setTelemetry(snapshot(engine, engine.ros?.status ?? 'disabled', cameraSource));
    }, 250);
    return () => {
      clearInterval(id);
      world.stop();
    };
  }, [engine]);

  return { engine, telemetry, map, loading };
}

function snapshot({ sim }, rosStatus, cameraSource) {
  return {
    x: sim.pose.x,
    y: sim.pose.y,
    yaw: sim.pose.yaw,
    linear: sim.vel.linear,
    angular: sim.vel.angular,
    battery: sim.battery,
    distance: sim.distance,
    zone: sim.zone,
    external: sim.external,
    rosStatus,
    cameraSource,
  };
}
