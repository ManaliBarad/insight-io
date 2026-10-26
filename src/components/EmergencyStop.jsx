import './EmergencyStop.css';

// Yellow collar + red mushroom button, modelled on a physical E-stop.
export function EmergencyStop({ engaged, onToggle }) {
  return (
    <button
      type="button"
      className={`estop ${engaged ? 'is-engaged' : ''}`}
      onClick={onToggle}
      aria-pressed={engaged}
      aria-label={engaged ? 'Release emergency stop' : 'Emergency stop'}
      title={engaged ? 'Click to release' : 'Emergency stop'}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <path id="estop-top" d="M 16 50 A 34 34 0 0 1 84 50" />
          <path id="estop-bottom" d="M 20 52 A 30 30 0 0 0 80 52" />
          <radialGradient id="estop-red" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#ff5a4e" />
            <stop offset="70%" stopColor="#e0241b" />
            <stop offset="100%" stopColor="#a8140e" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="#f5c518" />
        <circle cx="50" cy="50" r="48" fill="none" stroke="#d9a90a" strokeWidth="1.5" />
        <text className="estop__text">
          <textPath href="#estop-top" startOffset="50%" textAnchor="middle">
            EMERGENCY
          </textPath>
        </text>
        <text className="estop__text">
          <textPath href="#estop-bottom" startOffset="50%" textAnchor="middle" dominantBaseline="hanging">
            STOP
          </textPath>
        </text>
        <g className="estop__cap">
          <circle cx="50" cy="50" r="27" fill="#8c0f0a" />
          <circle cx="50" cy="49" r="25.5" fill="url(#estop-red)" />
          {/* twist-to-release arrows */}
          <g fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round">
            <path d="M 37 44 A 14 14 0 0 1 59 38" />
            <path d="M 63 54 A 14 14 0 0 1 41 60" />
          </g>
          <path d="M 57 33 L 63 39 L 55 41 Z" fill="#fff" />
          <path d="M 43 65 L 37 59 L 45 57 Z" fill="#fff" />
        </g>
      </svg>
    </button>
  );
}
