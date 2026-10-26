// Owns the Three.js scene shared by the Map view and the simulated Camera view.
//
// Map data uses the ROS convention (x forward, y left, z up). Everything that
// lives in the map frame is parented to `this.mapFrame`, which is rotated so
// ROS z points along Three's y-up. Converting map <-> three is therefore just
// mapFrame.localToWorld / worldToLocal.

import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { PCDLoader } from 'three/addons/loaders/PCDLoader.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { createGoalMarker, createRobot, createZone } from './objects';

const MAP_BG = 0xd5d6d2;
const CAM_BG = 0x10141c;
const OVERLAY_LAYER = 1; // visible in the map view only (robot halo, labels)
const MAP_CLOUD_LAYER = 2; // world-sized points, reads as a solid floor from above
const CAM_CLOUD_LAYER = 3; // fixed pixel-size points, lidar look up close

const MIN_DIST = 6;
const MAX_DIST = 140;
export const zoomToDistance = (v) => MAX_DIST * (MIN_DIST / MAX_DIST) ** (v / 100);
export const distanceToZoom = (d) => (100 * Math.log(d / MAX_DIST)) / Math.log(MIN_DIST / MAX_DIST);

export class World {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(20, 40, 10);
    this.scene.add(sun);
    this.cameraFog = new THREE.Fog(CAM_BG, 6, 38);

    this.mapFrame = new THREE.Group();
    this.mapFrame.rotation.x = -Math.PI / 2;
    this.scene.add(this.mapFrame);

    // Same geometry drawn twice with different materials, split by layer.
    this.cloud = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ vertexColors: true }));
    this.cloud.layers.set(MAP_CLOUD_LAYER);
    this.cloud.frustumCulled = false;
    this.camCloud = new THREE.Points(this.cloud.geometry, new THREE.PointsMaterial({ size: 1.6, vertexColors: true, sizeAttenuation: false }));
    this.camCloud.layers.set(CAM_CLOUD_LAYER);
    this.camCloud.frustumCulled = false;
    this.mapFrame.add(this.cloud, this.camCloud);

    this.zones = new THREE.Group();
    this.mapFrame.add(this.zones);

    this.robot = createRobot(OVERLAY_LAYER);
    this.mapFrame.add(this.robot.frame);

    this.goal = createGoalMarker();
    this.goal.visible = false;
    this.mapFrame.add(this.goal);

    this.path = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineDashedMaterial({ color: 0x2f80ed, dashSize: 0.5, gapSize: 0.35, transparent: true, opacity: 0.9 }),
    );
    this.path.visible = false;
    this.mapFrame.add(this.path);

    // First-person camera mounted on the robot (used when no video / ROS feed).
    this.robotCamera = new THREE.PerspectiveCamera(72, 16 / 9, 0.05, 90);
    this.robotCamera.position.set(0.35, 0, 0.95);
    this.robotCamera.setRotationFromMatrix(
      new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)),
    );
    this.robotCamera.rotateX(-0.14);
    this.robotCamera.layers.enable(CAM_CLOUD_LAYER);
    this.robot.frame.add(this.robotCamera);

    this.views = { map: null, camera: null };
    this.pose = { x: 0, y: 0, yaw: 0 };
    this.goalPos = null;
    this.follow = false;
    this.picking = false;
    this.onPick = null;
    this.onZoom = null;
    this.tick = null;
    this.clock = new THREE.Clock();
    this.raf = 0;
  }

  // ---------------------------------------------------------------- lifecycle

  start(tick) {
    this.tick = tick;
    if (this.raf) return;
    this.clock.start();
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.frame(Math.min(this.clock.getDelta(), 0.1));
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  frame(dt) {
    const pose = this.tick?.(dt);
    if (pose) this.setPose(pose);

    const t = this.clock.elapsedTime;
    this.robot.halo.scale.setScalar(1 + 0.12 * Math.sin(t * 3));
    this.goal.userData.pin.position.z = 1.15 + 0.12 * Math.sin(t * 2.5);

    const map = this.views.map;
    if (map) {
      if (this.follow) {
        const p = this.robot.frame.getWorldPosition(new THREE.Vector3());
        const delta = p.sub(map.controls.target).setY(0);
        map.controls.target.add(delta);
        map.camera.position.add(delta);
      }
      map.controls.update();
      // Keep the robot / goal readable when zoomed out.
      const s = THREE.MathUtils.clamp(map.camera.position.distanceTo(map.controls.target) / 30, 1, 3);
      this.robot.visual.scale.setScalar(s);
      this.goal.userData.scaled.scale.setScalar(s);

      // PointsMaterial size is in "screen-height / depth" units; divide by
      // tan(fov/2) so points render ~0.32 m wide and the floor reads as solid.
      this.scene.fog = null;
      this.cloud.material.size = 0.32 / Math.tan(THREE.MathUtils.degToRad(map.camera.fov / 2));
      map.renderer.render(this.scene, map.camera);
      map.labels.render(this.scene, map.camera);
    }

    const cam = this.views.camera;
    if (cam) {
      this.robot.visual.scale.setScalar(1);
      this.goal.userData.scaled.scale.setScalar(1);
      this.scene.fog = this.cameraFog;
      cam.renderer.render(this.scene, this.robotCamera);
    }
  }

  // ---------------------------------------------------------------- views

  attachMap(container) {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(MAP_BG);
    container.appendChild(renderer.domElement);

    const labels = new CSS2DRenderer();
    labels.domElement.className = 'map-labels';
    container.appendChild(labels.domElement);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
    camera.layers.enable(OVERLAY_LAYER);
    camera.layers.enable(MAP_CLOUD_LAYER);
    camera.position.set(0, zoomToDistance(45), 0.01);

    const controls = new MapControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.minDistance = MIN_DIST;
    controls.maxDistance = MAX_DIST;
    controls.maxPolarAngle = 1.25;
    controls.zoomSpeed = 1.2;
    let lastZoom = null;
    controls.addEventListener('change', () => {
      const z = Math.round(distanceToZoom(camera.position.distanceTo(controls.target)));
      if (z !== lastZoom) {
        lastZoom = z;
        this.onZoom?.(z);
      }
    });

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = container;
      if (!w || !h) return;
      renderer.setSize(w, h);
      labels.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // Click (not drag) on the floor while picking => goal in map frame.
    const down = { x: 0, y: 0 };
    const onDown = (e) => Object.assign(down, { x: e.clientX, y: e.clientY });
    const onUp = (e) => {
      if (!this.picking || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
      if (!hit) return;
      const p = this.mapFrame.worldToLocal(hit);
      this.onPick?.({ x: p.x, y: p.y });
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    this.views.map = { renderer, labels, camera, controls };
    return () => {
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      controls.dispose();
      renderer.dispose();
      container.replaceChildren();
      this.views.map = null;
    };
  }

  attachCamera(container) {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(CAM_BG);
    container.appendChild(renderer.domElement);
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = container;
      if (!w || !h) return;
      renderer.setSize(w, h);
      this.robotCamera.aspect = w / h;
      this.robotCamera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();
    this.views.camera = { renderer };
    return () => {
      ro.disconnect();
      renderer.dispose();
      container.replaceChildren();
      this.views.camera = null;
    };
  }

  setZoom(v) {
    const map = this.views.map;
    if (!map) return;
    const { camera, controls } = map;
    const dir = camera.position.clone().sub(controls.target);
    const d = dir.length();
    const target = zoomToDistance(v);
    if (Math.abs(d - target) / d < 0.01) return;
    camera.position.copy(controls.target).add(dir.setLength(target));
  }

  // Top-down view framing the whole cloud.
  fitView() {
    const map = this.views.map;
    const box = this.cloudBox;
    if (!map || !box) return;
    const { camera, controls } = map;
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3()).setY(0);
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const d = THREE.MathUtils.clamp(Math.max(size.z / 2 / tan, size.x / 2 / (tan * camera.aspect)) * 1.08, MIN_DIST, MAX_DIST);
    controls.target.copy(c);
    camera.position.set(c.x, d, c.z + 0.01);
    controls.update();
    this.onZoom?.(Math.round(distanceToZoom(d)));
  }

  // ---------------------------------------------------------------- content

  loadPcd(source, onProgress) {
    const loader = new PCDLoader();
    const apply = (points) => {
      this.setCloudGeometry(points.geometry);
      points.material.dispose();
    };
    if (source instanceof ArrayBuffer) {
      apply(loader.parse(source));
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      loader.load(
        source,
        (points) => {
          apply(points);
          resolve();
        },
        (e) => e.total && onProgress?.(e.loaded / e.total),
        reject,
      );
    });
  }

  setCloudGeometry(geometry) {
    if (!geometry.getAttribute('color')) colorByHeight(geometry);
    this.cloud.geometry.dispose();
    this.cloud.geometry = geometry;
    this.camCloud.geometry = geometry;
    geometry.computeBoundingBox();
    this.mapFrame.updateMatrixWorld();
    this.cloudBox = geometry.boundingBox.clone().applyMatrix4(this.mapFrame.matrixWorld);
    this.pointCount = geometry.getAttribute('position').count;
  }

  setCloudArrays(positions, colors) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (colors) g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.setCloudGeometry(g);
  }

  setZones(zones) {
    for (const child of [...this.zones.children]) {
      child.traverse((o) => {
        if (o instanceof CSS2DObject) o.element.remove();
        o.geometry?.dispose();
      });
      this.zones.remove(child);
    }
    for (const zone of zones) this.zones.add(createZone(zone, OVERLAY_LAYER));
  }

  setZonesVisible(visible) {
    this.zones.visible = visible; // CSS2DRenderer hides the labels of invisible groups too
  }

  setPose({ x, y, yaw }) {
    this.pose = { x, y, yaw };
    this.robot.frame.position.set(x, y, 0);
    this.robot.frame.rotation.z = yaw;
    this.updatePath();
  }

  setGoal(goal) {
    this.goalPos = goal;
    this.goal.visible = !!goal;
    if (goal) this.goal.position.set(goal.x, goal.y, 0);
    this.updatePath();
  }

  updatePath() {
    const g = this.goalPos;
    this.path.visible = !!g;
    if (!g) return;
    const pos = this.path.geometry.attributes.position;
    pos.setXYZ(0, this.pose.x, this.pose.y, 0.06);
    pos.setXYZ(1, g.x, g.y, 0.06);
    pos.needsUpdate = true;
    this.path.computeLineDistances();
  }

  setPicking(picking) {
    this.picking = picking;
  }

  setFollow(follow) {
    this.follow = follow;
  }
}

function colorByHeight(geometry) {
  const pos = geometry.getAttribute('position');
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const span = Math.max(max.z - min.z, 0.001);
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getZ(i) - min.z) / span;
    c.setHSL(0.62 - 0.62 * t, 0.75, 0.5);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}
