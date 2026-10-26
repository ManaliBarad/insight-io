import { useEffect, useRef, useState } from 'react';
import './Views.css';

// Camera feed with graceful fallbacks:
//   1. ROS CompressedImage topic (when live)
//   2. A video file (public/media/camera.mp4, or one dropped onto the page)
//   3. A simulated first-person render from the robot in the point cloud
export function CameraView({ engine, videoUrl, rosLive, zoom }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const simHost = useRef(null);
  const img = useRef(null);

  // A new URL (e.g. a dropped file) gets a fresh chance to play.
  useEffect(() => setVideoFailed(false), [videoUrl]);

  const source = rosLive ? 'ros' : videoFailed ? 'sim' : 'video';

  useEffect(() => {
    if (source !== 'sim') return undefined;
    return engine.world.attachCamera(simHost.current);
  }, [engine, source]);

  useEffect(() => {
    if (source !== 'ros') return undefined;
    return engine.onImage((src) => {
      if (img.current) img.current.src = src;
    });
  }, [engine, source]);

  const scale = 1 + (zoom / 100) * 2;
  const badge = { ros: 'CAM 01 · LIVE', video: 'CAM 01 · REC', sim: 'CAM 01 · SIM' }[source];

  return (
    <div className="view view--camera">
      <div className="view__media" style={{ transform: `scale(${scale})` }}>
        {source === 'ros' && <img ref={img} alt="Robot camera" />}
        {/* A missing file errors out (the dev server answers with HTML), which switches to the sim. */}
        {source === 'video' && <video key={videoUrl} src={videoUrl} autoPlay muted loop playsInline onError={() => setVideoFailed(true)} />}
        {source === 'sim' && <div className="view__canvas" ref={simHost} />}
      </div>
      <span className={`view__badge view__badge--${source}`}>
        <i />
        {badge}
      </span>
    </div>
  );
}
