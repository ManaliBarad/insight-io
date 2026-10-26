import { IconBattery, IconSignal } from './icons';
import './TopStatusBar.css';

const ROS_LABEL = {
  connected: 'ROS Live',
  connecting: 'ROS…',
  offline: 'Sim',
  disabled: 'Sim',
};

export function TopStatusBar({ battery, signal, failsafe, system, rosStatus, viewLabel }) {
  const pct = Math.round(battery);
  return (
    <header className="statusbar">
      <div className="statusbar__bar">
        <span className="statusbar__item" title="Battery">
          <b>{pct}%</b>
          <IconBattery level={pct} />
        </span>
        <span className="statusbar__item" title="Network signal">
          <IconSignal bars={signal.bars} />
          <b>{signal.label}</b>
        </span>
        <span className="statusbar__item statusbar__item--hide-sm">
          <span className="statusbar__key">Failsafe</span>
          <b className={failsafe.ok ? '' : 'is-bad'}>{failsafe.label}</b>
          <i className={`dot ${failsafe.ok ? 'dot--ok' : 'dot--bad'}`} />
        </span>
        <span className="statusbar__item">
          <span className="statusbar__key">System</span>
          <b className={system.ok ? '' : 'is-bad'}>{system.label}</b>
          <i className={`dot ${system.ok ? 'dot--ok' : system.warn ? 'dot--warn' : 'dot--bad'}`} />
        </span>
        <span className={`statusbar__ros statusbar__ros--${rosStatus}`} title={`ROS bridge: ${rosStatus}`}>
          {ROS_LABEL[rosStatus] ?? rosStatus}
        </span>
      </div>
      <div className="statusbar__tab" key={viewLabel}>
        {viewLabel}
      </div>
    </header>
  );
}
