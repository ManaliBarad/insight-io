import { IconGrid, IconMap, IconPin, IconTarget, IconTrend, IconUser, IconZones } from './icons';
import './Sidebar.css';

const ITEMS = [
  { id: 'dashboard', label: 'Dashboard', Icon: IconGrid },
  { id: 'swap', label: 'Swap map / camera', Icon: IconMap },
  { id: 'goal', label: 'Drop a goal', Icon: IconPin },
  { id: 'zones', label: 'Toggle zones', Icon: IconZones },
  { id: 'follow', label: 'Follow robot', Icon: IconTarget },
  { id: 'telemetry', label: 'Telemetry', Icon: IconTrend },
];

export function Sidebar({ active, onSelect }) {
  return (
    <nav className="sidebar" aria-label="Main">
      <div className="sidebar__logo" role="img" aria-label="ERIC Robotics">
        <span className="sidebar__wordmark">
          ER<i>|</i>C
        </span>
        <span className="sidebar__sub">ROBOTICS</span>
      </div>
      <ul className="sidebar__list">
        {ITEMS.map(({ id, label, Icon }) => (
          <li key={id}>
            <button
              type="button"
              className={`sidebar__item ${active[id] ? 'is-active' : ''}`}
              aria-pressed={!!active[id]}
              aria-label={label}
              data-tip={label}
              onClick={() => onSelect(id)}
            >
              <Icon size={19} />
            </button>
          </li>
        ))}
      </ul>
      {/* Signed-in operator badge (no account system in this demo). */}
      <span className="sidebar__item sidebar__user" role="img" aria-label="Operator" data-tip="Operator">
        <IconUser size={18} />
      </span>
    </nav>
  );
}
