import { useEffect, useRef, useState } from 'react';
import './Views.css';

// Camera feed with graceful fallbacks:
//   1. ROS CompressedImage topic (when live)
//   2. A video file (public/media/camera.mp4, or one dropped onto the page)
//   3. A simulated first-person render from the robot in the point cloud
export function CameraView({ engine, videoUrl, rosLive, zoom }) {
  const [video, setVideo] = useState(null); // resolved playable URL or null
  const simHost = useRef(null);
  const img = useRef(null);

  // Only use the video if it really exists (Vite's SPA fallback answers 200 + HTML).
  useEffect(() => {
    let cancelled = false;
    if (videoUrl.startsWith('blob:')) {
      setVideo(videoUrl);
      return undefined;
    }
    fetch(videoUrl, { method: 'HEAD' })
      .then((r) => !cancelled && setVideo(r.ok && r.headers.get('content-type')?.startsWith('video') ? videoUrl : null))
      .catch(() => !cancelled && setVideo(null));
    return () => {
      cancelled = true;
    };
  }, [videoUrl]);

  const source = rosLive ? 'ros' : video ? 'video' : 'sim';

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
        {source === 'video' && <video key={video} src={video} autoPlay muted loop playsInline onError={() => setVideo(null)} />}
        {source === 'sim' && <div className="view__canvas" ref={simHost} />}
      </div>
      <span className={`view__badge view__badge--${source}`}>
        <i />
        {badge}
      </span>
    </div>
  );
}
