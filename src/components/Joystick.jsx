import { IconChevron } from './icons';
import './Joystick.css';

const DIRS = [
  { dir: 'up', key: 'W' },
  { dir: 'left', key: 'A' },
  { dir: 'right', key: 'D' },
  { dir: 'down', key: 'S' },
];

// Directional pad. Mirrors keyboard W A S D presses; usable by touch / mouse.
export function Joystick({ enabled, active, onPress, onDisabledPress }) {
  const bind = (dir) => ({
    onPointerDown: (e) => {
      if (!enabled) return onDisabledPress?.();
      e.currentTarget.setPointerCapture(e.pointerId);
      onPress(dir, true);
    },
    onPointerUp: () => enabled && onPress(dir, false),
    onPointerCancel: () => enabled && onPress(dir, false),
  });

  return (
    <div className={`joystick ${enabled ? '' : 'is-disabled'}`} role="group" aria-label="Manual drive (W A S D)">
      {DIRS.map(({ dir, key }) => (
        <button
          key={dir}
          type="button"
          className={`joystick__btn joystick__btn--${dir} ${active.has(dir) ? 'is-active' : ''}`}
          aria-label={`Drive ${dir} (${key})`}
          {...bind(dir)}
        >
          <IconChevron dir={dir} size={14} />
          <span className="joystick__key">{key}</span>
        </button>
      ))}
      <div className="joystick__hub" aria-hidden="true">
        <span>W</span>
        <span>A · D</span>
        <span>S</span>
      </div>
    </div>
  );
}
