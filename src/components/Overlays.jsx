// Transient overlays: toast notifications, telemetry drawer, file-drop target.

import { useEffect } from 'react';
import { IconClose, IconUpload } from './icons';
import './Overlays.css';

export function Toast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => onDone(toast.id), 2600);
    return () => clearTimeout(id);
  }, [toast, onDone]);

  if (!toast) return null;
  return (
    <div className={`toast toast--${toast.tone}`} role="status" key={toast.id}>
      {toast.text}
    </div>
  );
}

const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '-');

export function TelemetryPanel({ open, telemetry, pointCount, onClose }) {
  const rows = [
    ['Position', `${fmt(telemetry.x)}, ${fmt(telemetry.y)} m`],
    ['Heading', `${fmt((telemetry.yaw * 180) / Math.PI, 0)}°`],
    ['Linear', `${fmt(telemetry.linear)} m/s`],
    ['Angular', `${fmt(telemetry.angular)} rad/s`],
    ['Zone', telemetry.zone ? `${telemetry.zone.name} (${telemetry.zone.type === 'nogo' ? 'no-go' : 'slow'})` : 'Open floor'],
    ['Odometer', `${fmt(telemetry.distance, 1)} m`],
    ['Battery', `${fmt(telemetry.battery, 1)} %`],
    ['Pose source', telemetry.external ? 'ROS /odom' : 'Simulator'],
    ['Camera', telemetry.cameraSource === 'ros' ? 'ROS topic' : 'Local'],
    ['Map points', pointCount ? pointCount.toLocaleString() : '-'],
  ];
  return (
    <aside className={`telemetry ${open ? 'is-open' : ''}`} aria-hidden={!open} aria-label="Telemetry">
      <header>
        <h2>Telemetry</h2>
        <button type="button" onClick={onClose} aria-label="Close telemetry">
          <IconClose size={14} />
        </button>
      </header>
      <dl>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="telemetry__hint">Tip: drop a .pcd or video file anywhere to load it.</p>
    </aside>
  );
}

export function DropOverlay({ visible }) {
  if (!visible) return null;
  return (
    <div className="drop">
      <div className="drop__card">
        <IconUpload size={26} />
        <strong>Drop to load</strong>
        <span>.pcd point cloud → Map · .mp4 / .webm → Camera</span>
      </div>
    </div>
  );
}
