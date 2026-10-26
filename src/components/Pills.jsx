// The white "pill" controls in the top corners of the stage.

import { IconArrowRight, IconPause, IconPlay } from './icons';
import './Pills.css';

export function MissionStatus({ label, state, tone, onTogglePause }) {
  const canToggle = state === 'running' || state === 'paused';
  return (
    <div className={`pill pill--status pill--${tone}`}>
      <span className="pill__key">Status</span>
      <span className="pill__value" key={label}>
        {label}
      </span>
      <button
        type="button"
        className="pill__round"
        onClick={onTogglePause}
        disabled={!canToggle}
        aria-label={state === 'running' ? 'Pause mission' : 'Resume mission'}
        title={state === 'running' ? 'Pause mission' : 'Resume mission'}
      >
        {state === 'running' ? <IconPause size={14} /> : <IconPlay size={13} />}
      </button>
    </div>
  );
}

export function PillButton({ children, onClick, active, title }) {
  return (
    <button type="button" className={`pill pill--button ${active ? 'is-active' : ''}`} onClick={onClick} title={title} aria-pressed={active}>
      <span className="pill__label">{children}</span>
      <span className="pill__round" aria-hidden="true">
        <IconArrowRight size={14} />
      </span>
    </button>
  );
}

export function ModeToggle({ mode, onChange }) {
  return (
    <div className="pill pill--mode" role="radiogroup" aria-label="Drive mode">
      <span className="pill__label">Mode</span>
      <div className="segmented" data-active={mode}>
        <span className="segmented__thumb" aria-hidden="true" />
        {['auto', 'manual'].map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? 'is-active' : ''} onClick={() => onChange(m)}>
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}
