// Differential-drive robot model. Runs the robot when no ROS odometry is
// available; when ROS is live it is fed external poses instead and only
// produces velocity commands.

import { config } from '../config';
import { approach, clamp, pointInPolygon, wrapAngle, zoneAt } from './geometry';

const { maxLinear, maxAngular, slowZoneLinear, goalTolerance } = config.robot;

export class RobotSim {
  pose = { x: 0, y: 0, yaw: 0 };
  vel = { linear: 0, angular: 0 };
  battery = 100;
  distance = 0;
  zone = null;
  external = false; // true while poses come from ROS /odom

  control = { mode: 'auto', running: false, estop: false, goal: null };
  manual = { forward: 0, turn: 0 }; // -1..1 from keyboard / joystick
  map = { zones: [], bounds: null };

  onArrive = null;

  setMap(map) {
    this.map = { zones: map.zones || [], bounds: map.bounds || null };
    if (map.start) this.pose = { ...map.start };
  }

  setControl(control) {
    this.control = { ...this.control, ...control };
  }

  // Pose + measured velocity from ROS /odom.
  setExternalPose(x, y, yaw, linear, angular) {
    // Don't count the jump from the sim pose to the first real pose as travel.
    if (this.external) this.distance += Math.hypot(x - this.pose.x, y - this.pose.y);
    this.external = true;
    this.pose = { x, y, yaw };
    this.vel = { linear, angular };
  }

  // Velocity the robot should be commanded with right now.
  desiredCommand() {
    const { mode, running, estop, goal } = this.control;
    if (estop) return { linear: 0, angular: 0 };

    let linear = 0;
    let angular = 0;
    if (mode === 'manual') {
      linear = this.manual.forward * (this.manual.forward > 0 ? maxLinear * 0.8 : maxLinear * 0.45);
      angular = this.manual.turn * maxAngular;
    } else if (running && goal) {
      const dx = goal.x - this.pose.x;
      const dy = goal.y - this.pose.y;
      const dist = Math.hypot(dx, dy);
      const err = wrapAngle(Math.atan2(dy, dx) - this.pose.yaw);
      angular = clamp(2.2 * err, -maxAngular, maxAngular);
      linear = clamp(0.9 * dist, 0, maxLinear) * Math.max(0, Math.cos(err)) ** 3;
    }

    this.zone = zoneAt(this.map.zones, this.pose.x, this.pose.y);
    if (this.zone?.type === 'slow') linear = clamp(linear, -slowZoneLinear, slowZoneLinear);
    return { linear, angular };
  }

  step(dt) {
    const cmd = this.desiredCommand();
    // With ROS the real robot moves; we only compute the command.
    if (!this.external) {
      const hardStop = this.control.estop;
      this.vel.linear = hardStop ? 0 : approach(this.vel.linear, cmd.linear, 4, dt);
      this.vel.angular = hardStop ? 0 : approach(this.vel.angular, cmd.angular, 6, dt);

      const yaw = this.pose.yaw + this.vel.angular * dt;
      const nx = this.pose.x + Math.cos(yaw) * this.vel.linear * dt;
      const ny = this.pose.y + Math.sin(yaw) * this.vel.linear * dt;
      const zone = zoneAt(this.map.zones, nx, ny);
      const blocked =
        (this.map.bounds && !pointInPolygon(nx, ny, this.map.bounds)) ||
        (zone?.type === 'nogo' && this.zone?.type !== 'nogo');
      this.pose.yaw = wrapAngle(yaw);
      if (blocked) {
        this.vel.linear = 0;
      } else {
        this.distance += Math.hypot(nx - this.pose.x, ny - this.pose.y);
        this.pose.x = nx;
        this.pose.y = ny;
      }
      const moving = Math.abs(this.vel.linear) > 0.02 || Math.abs(this.vel.angular) > 0.02;
      this.battery = Math.max(0, this.battery - dt * (moving ? 0.03 : 0.003));
    }

    const { goal, running, mode } = this.control;
    if (goal && running && mode === 'auto' && Math.hypot(goal.x - this.pose.x, goal.y - this.pose.y) < goalTolerance) {
      this.control.running = false;
      this.onArrive?.();
    }
    return cmd;
  }
}
