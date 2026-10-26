import { IconMinus, IconPlus } from './icons';
import './ZoomSlider.css';

export function ZoomSlider({ value, onChange, label }) {
  return (
    <div className="zoom" aria-label={label}>
      <button type="button" className="zoom__btn" onClick={() => onChange(value + 10)} aria-label="Zoom in">
        <IconPlus size={11} />
      </button>
      <input
        className="zoom__range"
        type="range"
        min="0"
        max="100"
        step="1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        aria-orientation="vertical"
        style={{ '--fill': `${value}%` }}
      />
      <button type="button" className="zoom__btn" onClick={() => onChange(value - 10)} aria-label="Zoom out">
        <IconMinus size={11} />
      </button>
    </div>
  );
}
