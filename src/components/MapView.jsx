import { useEffect, useRef } from 'react';
import './Views.css';

export function MapView({ world, loading, picking, isMain }) {
  const host = useRef(null);

  useEffect(() => world.attachMap(host.current), [world]);

  return (
    <div className={`view view--map ${picking && isMain ? 'is-picking' : ''}`}>
      <div className="view__canvas" ref={host} />
      {!loading.done && (
        <div className="view__loading">
          <div className="view__spinner" />
          <span>Loading point cloud… {Math.round(loading.progress * 100)}%</span>
          <div className="view__progress">
            <i style={{ width: `${loading.progress * 100}%` }} />
          </div>
        </div>
      )}
      {loading.error && <div className="view__error">{loading.error}</div>}
    </div>
  );
}
