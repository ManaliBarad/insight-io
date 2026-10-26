import { IconSwap } from './icons';
import './Views.css';

// Holds both views permanently mounted and swaps which one is full-screen and
// which one sits in the picture-in-picture slot (so WebGL contexts survive the swap).
export function ViewStage({ mainView, onSwap, map, camera }) {
  const slot = (id) => (mainView === id ? 'main' : 'pip');
  const pip = (id, label) =>
    slot(id) === 'pip' && (
      <button type="button" className="pane__hit" onClick={onSwap} aria-label={`Switch to ${label}`}>
        <span className="pane__hint">
          <IconSwap size={13} /> {label}
        </span>
      </button>
    );

  return (
    <div className="stage__views">
      <section className={`pane pane--${slot('map')}`} aria-label="Map view">
        {map}
        {pip('map', 'Map View')}
      </section>
      <section className={`pane pane--${slot('camera')}`} aria-label="Camera view">
        {camera}
        {pip('camera', 'Camera View')}
      </section>
    </div>
  );
}
