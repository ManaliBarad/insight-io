// Runtime configuration. Everything can be overridden through Vite env vars
// (see .env.example) so the same build works against a sim or a real robot.

const env = import.meta.env;
const base = env.BASE_URL;

export const config = {
  ros: {
    enabled: env.VITE_ROS_ENABLED !== 'false',
    url: env.VITE_ROSBRIDGE_URL || 'ws://localhost:9090',
    retryMs: 8000,
    topics: {
      odom: env.VITE_TOPIC_ODOM || '/odom',
      cmdVel: env.VITE_TOPIC_CMD_VEL || '/cmd_vel',
      goal: env.VITE_TOPIC_GOAL || '/goal_pose',
      points: env.VITE_TOPIC_POINTS || '/points',
      camera: env.VITE_TOPIC_CAMERA || '/camera/image_raw/compressed',
      battery: env.VITE_TOPIC_BATTERY || '/battery_state',
    },
  },
  media: {
    cameraVideo: base + (env.VITE_CAMERA_VIDEO || 'media/camera.mp4'),
    mapMeta: base + (env.VITE_MAP_META || 'data/map.json'),
  },
  robot: {
    maxLinear: 1.2, // m/s
    maxAngular: 1.4, // rad/s
    slowZoneLinear: 0.45,
    goalTolerance: 0.35, // m
  },
  missionId: 1234,
};
