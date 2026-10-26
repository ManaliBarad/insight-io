// UI state for the dashboard. High-frequency data (robot pose, velocities)
// deliberately lives outside React in the sim/ROS layer; this reducer only holds
// what the controls render.

import { config } from '../config';

export const initialState = {
  mode: 'auto', // 'auto' | 'manual'
  mission: { id: config.missionId, state: 'running' }, // idle | running | paused | completed
  estop: false,
  goal: null, // { x, y } in map frame
  picking: false, // waiting for a click on the map to place a Quick Goal
  mainView: 'map', // 'map' | 'camera'
  zoom: { map: 45, camera: 0 }, // 0..100 per view; the slider drives the main one
  showZones: true,
  follow: false,
  nav: 'dashboard',
  telemetryOpen: false,
  toast: null, // { id, text, tone }
};

let toastSeq = 0;
const toast = (text, tone = 'info') => ({ id: ++toastSeq, text, tone });

export function dashboardReducer(state, action) {
  switch (action.type) {
    case 'map/loaded':
      // Seed the demo mission with the goal from map.json (matches "On Mission 1234").
      return state.goal ? state : { ...state, goal: action.goal };

    case 'view/swap':
      return { ...state, mainView: state.mainView === 'map' ? 'camera' : 'map' };
    case 'view/set':
      return { ...state, mainView: action.view };
    case 'zoom/set':
      return { ...state, zoom: { ...state.zoom, [action.view]: Math.max(0, Math.min(100, action.zoom)) } };

    case 'mode/set': {
      if (action.mode === state.mode) return state;
      const mission =
        action.mode === 'manual' && state.mission.state === 'running'
          ? { ...state.mission, state: 'paused' }
          : state.mission;
      return {
        ...state,
        mode: action.mode,
        mission,
        toast: toast(action.mode === 'manual' ? 'Manual control: drive with W A S D' : 'Autonomous mode'),
      };
    }

    case 'mission/togglePause': {
      const s = state.mission.state;
      if (s !== 'running' && s !== 'paused') return state;
      if (s === 'paused' && (state.estop || state.mode === 'manual')) {
        return { ...state, toast: toast(state.estop ? 'Release the emergency stop first' : 'Switch to AUTO to resume', 'warn') };
      }
      return { ...state, mission: { ...state.mission, state: s === 'running' ? 'paused' : 'running' } };
    }

    case 'mission/initiate': {
      if (state.estop) return { ...state, toast: toast('Release the emergency stop first', 'warn') };
      if (!state.goal) return { ...state, toast: toast('Set a Quick Goal on the map first', 'warn') };
      const fresh = state.mission.state === 'completed' || state.mission.state === 'idle';
      return {
        ...state,
        mode: 'auto',
        mission: { id: fresh ? state.mission.id + 1 : state.mission.id, state: 'running' },
        toast: toast(`Mission ${fresh ? state.mission.id + 1 : state.mission.id} initiated`, 'ok'),
      };
    }

    case 'mission/completed':
      return { ...state, mission: { ...state.mission, state: 'completed' }, goal: null, toast: toast('Goal reached', 'ok') };

    case 'goal/startPicking':
      return {
        ...state,
        picking: !state.picking,
        mainView: 'map',
        toast: state.picking ? null : toast('Click on the map to drop a goal'),
      };
    case 'goal/cancelPicking':
      return { ...state, picking: false };
    case 'goal/set':
      if (action.blocked) return { ...state, picking: false, toast: toast(`Goal is inside a No-Go zone (${action.blocked})`, 'danger') };
      return {
        ...state,
        picking: false,
        goal: { x: action.x, y: action.y },
        mission: state.mission.state === 'running' ? state.mission : { ...state.mission, state: state.mission.state === 'paused' ? 'paused' : 'idle' },
        toast: toast('Goal set. Press INITIATE to go', 'ok'),
      };

    case 'estop/toggle': {
      const estop = !state.estop;
      const mission = estop && state.mission.state === 'running' ? { ...state.mission, state: 'paused' } : state.mission;
      return {
        ...state,
        estop,
        mission,
        toast: toast(estop ? 'EMERGENCY STOP engaged: all motion halted' : 'Emergency stop released', estop ? 'danger' : 'ok'),
      };
    }

    case 'nav/set':
      return { ...state, nav: action.nav };
    case 'zones/toggle':
      return { ...state, showZones: !state.showZones, toast: toast(state.showZones ? 'Zones hidden' : 'Zones visible') };
    case 'follow/toggle':
      return { ...state, follow: !state.follow, mainView: 'map', toast: toast(state.follow ? 'Free camera' : 'Following robot') };
    case 'telemetry/toggle':
      return { ...state, telemetryOpen: !state.telemetryOpen };

    case 'toast/show':
      return { ...state, toast: toast(action.text, action.tone) };
    case 'toast/clear':
      return state.toast?.id === action.id ? { ...state, toast: null } : state;

    default:
      return state;
  }
}

export function statusLabel(state) {
  if (state.estop) return 'Emergency Stop';
  if (state.mode === 'manual') return 'Manual Control';
  const { id, state: s } = state.mission;
  if (s === 'running') return `On Mission ${id}`;
  if (s === 'paused') return `Paused · Mission ${id}`;
  if (s === 'completed') return `Mission ${id} Complete`;
  return state.goal ? 'Goal Ready' : 'Idle';
}
