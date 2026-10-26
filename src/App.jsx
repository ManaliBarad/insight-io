import { useCallback, useEffect, useReducer, useState } from 'react';
import { CameraView } from './components/CameraView';
import { EmergencyStop } from './components/EmergencyStop';
import { Joystick } from './components/Joystick';
import { MapView } from './components/MapView';
import { DropOverlay, TelemetryPanel, Toast } from './components/Overlays';
import { MissionStatus, ModeToggle, PillButton } from './components/Pills';
import { Sidebar } from './components/Sidebar';
import { TopStatusBar } from './components/TopStatusBar';
import { ViewStage } from './components/ViewStage';
import { ZoomSlider } from './components/ZoomSlider';
import { config } from './config';
import { useDriveInput } from './hooks/useDriveInput';
import { useRobotEngine } from './hooks/useRobotEngine';
import { zoneAt } from './sim/geometry';
import { dashboardReducer, initialState, statusLabel } from './state/dashboardReducer';

export default function App() {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);
  const onArrive = useCallback(() => dispatch({ type: 'mission/completed' }), []);
  const { engine, telemetry, map, loading } = useRobotEngine({ onArrive });
  const { sim, world } = engine;
  const [videoOverride, setVideoOverride] = useState(null);
  const [dragging, setDragging] = useState(false);

  const canDrive = state.mode === 'manual' && !state.estop;
  const drive = useDriveInput(sim, canDrive);

  // ---- push UI state into the sim / 3D world ------------------------------
  useEffect(() => {
    if (map?.missionGoal) dispatch({ type: 'map/loaded', goal: map.missionGoal });
  }, [map]);

  useEffect(() => {
    sim.setControl({ mode: state.mode, running: state.mission.state === 'running', estop: state.estop, goal: state.goal });
  }, [sim, state.mode, state.mission.state, state.estop, state.goal]);

  useEffect(() => world.setGoal(state.goal), [world, state.goal]);
  useEffect(() => world.setZonesVisible(state.showZones), [world, state.showZones]);
  useEffect(() => world.setFollow(state.follow), [world, state.follow]);
  useEffect(() => world.setPicking(state.picking), [world, state.picking]);
  useEffect(() => world.setZoom(state.zoom.map), [world, state.zoom.map]);

  useEffect(() => {
    world.onZoom = (zoom) => dispatch({ type: 'zoom/set', view: 'map', zoom });
    world.onFollowBreak = () => dispatch({ type: 'follow/toggle' });
    world.onPick = ({ x, y }) => {
      const zone = zoneAt(map?.zones || [], x, y);
      dispatch({ type: 'goal/set', x, y, blocked: zone?.type === 'nogo' ? zone.name : null });
    };
  }, [world, map]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && dispatch({ type: 'goal/cancelPicking' });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---- actions --------------------------------------------------------------
  const initiate = () => {
    if (state.goal && !state.estop && engine.ros?.status === 'connected') {
      const yaw = Math.atan2(state.goal.y - telemetry.y, state.goal.x - telemetry.x);
      engine.ros.publishGoal(state.goal, yaw);
    }
    dispatch({ type: 'mission/initiate' });
  };

  const onNav = (id) => {
    if (id === 'dashboard') {
      dispatch({ type: 'nav/set', nav: id });
      world.fitView();
    } else if (id === 'map') {
      dispatch({ type: 'view/set', view: 'map' });
    } else if (id === 'goal') dispatch({ type: 'goal/startPicking' });
    else if (id === 'zones') dispatch({ type: 'zones/toggle' });
    else if (id === 'follow') dispatch({ type: 'follow/toggle' });
    else if (id === 'telemetry') dispatch({ type: 'telemetry/toggle' });
  };

  const onDrop = async (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (/\.pcd$/i.test(file.name)) {
      try {
        await world.loadPcd(await file.arrayBuffer());
        world.fitView();
        dispatch({ type: 'toast/show', text: `Loaded ${file.name}`, tone: 'ok' });
      } catch {
        dispatch({ type: 'toast/show', text: `Could not parse ${file.name}`, tone: 'danger' });
      }
    } else if (file.type.startsWith('video/')) {
      if (videoOverride) URL.revokeObjectURL(videoOverride);
      setVideoOverride(URL.createObjectURL(file));
      dispatch({ type: 'toast/show', text: `Camera feed: ${file.name}`, tone: 'ok' });
    } else {
      dispatch({ type: 'toast/show', text: 'Drop a .pcd or a video file', tone: 'warn' });
    }
  };

  // ---- derived status -------------------------------------------------------
  const lowBattery = telemetry.battery < 20;
  // Bridge is up but the robot isn't publishing odometry.
  const noOdom = telemetry.rosStatus === 'connected' && !telemetry.external;
  const signal = noOdom ? { bars: 2, label: 'Weak' } : { bars: 4, label: 'Strong' };
  const statusTone = state.estop ? 'danger' : state.mission.state === 'paused' ? 'warn' : state.mission.state === 'completed' ? 'ok' : '';
  const nav = {
    dashboard: state.nav === 'dashboard',
    map: state.mainView === 'map' && state.nav !== 'dashboard',
    goal: state.picking,
    zones: state.showZones,
    follow: state.follow,
    telemetry: state.telemetryOpen,
  };

  return (
    <div
      className={`app ${state.estop ? 'is-estop' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={onDrop}
    >
      <Sidebar active={nav} onSelect={onNav} />

      <main className="stage">
        <ViewStage
          mainView={state.mainView}
          onSwap={() => dispatch({ type: 'view/swap' })}
          map={<MapView world={world} loading={loading} picking={state.picking} isMain={state.mainView === 'map'} />}
          camera={
            <CameraView
              engine={engine}
              videoUrl={videoOverride || config.media.cameraVideo}
              rosLive={telemetry.cameraSource === 'ros'}
              zoom={state.zoom.camera}
            />
          }
        />

        <TopStatusBar
          battery={telemetry.battery}
          signal={signal}
          failsafe={state.estop ? { ok: false, label: 'Engaged' } : { ok: true, label: 'Okay' }}
          system={
            state.estop
              ? { ok: false, label: 'Halted' }
              : lowBattery || noOdom
                ? { ok: false, warn: true, label: 'Warning' }
                : { ok: true, label: 'Okay' }
          }
          rosStatus={telemetry.rosStatus}
          viewLabel={state.mainView === 'map' ? 'Map View' : 'Camera View'}
        />

        <div className="hud hud--tl">
          <MissionStatus
            label={statusLabel(state)}
            state={state.mission.state}
            tone={statusTone}
            onTogglePause={() => dispatch({ type: 'mission/togglePause' })}
          />
          <PillButton onClick={() => dispatch({ type: 'goal/startPicking' })} active={state.picking} title="Click, then pick a point on the map">
            Quick Goal
          </PillButton>
        </div>

        <div className="hud hud--tr">
          <ModeToggle mode={state.mode} onChange={(mode) => dispatch({ type: 'mode/set', mode })} />
          <PillButton onClick={initiate} title="Start the mission to the current goal">
            Initiate
          </PillButton>
        </div>

        <div className="hud hud--right">
          <EmergencyStop engaged={state.estop} onToggle={() => dispatch({ type: 'estop/toggle' })} />
          <Joystick
            enabled={canDrive}
            active={drive.active}
            onPress={drive.press}
            onDisabledPress={() =>
              dispatch({ type: 'toast/show', text: state.estop ? 'Release the emergency stop first' : 'Switch to MANUAL to drive', tone: 'warn' })
            }
          />
        </div>

        <div className="hud hud--zoom">
          <ZoomSlider
            value={state.zoom[state.mainView]}
            label={`${state.mainView === 'map' ? 'Map' : 'Camera'} zoom`}
            onChange={(zoom) => dispatch({ type: 'zoom/set', view: state.mainView, zoom })}
          />
        </div>

        <TelemetryPanel
          open={state.telemetryOpen}
          telemetry={telemetry}
          pointCount={loading.done ? world.pointCount : 0}
          onClose={() => dispatch({ type: 'telemetry/toggle' })}
        />
        <Toast toast={state.toast} onDone={(id) => dispatch({ type: 'toast/clear', id })} />
        <DropOverlay visible={dragging} />
        {state.estop && <div className="estop-frame" aria-hidden="true" />}
      </main>
    </div>
  );
}
