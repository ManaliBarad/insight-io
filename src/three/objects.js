// Scene objects, all built in the ROS map frame (z up).

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const onLayer = (obj, layer) => {
  obj.traverse((o) => o.layers.set(layer));
  return obj;
};

export function createRobot(overlayLayer) {
  const frame = new THREE.Group(); // follows the pose, never scaled (camera mount)
  const visual = new THREE.Group(); // scaled with map zoom for readability
  frame.add(visual);

  const dark = new THREE.MeshStandardMaterial({ color: 0x1e2533, roughness: 0.55, metalness: 0.2 });
  const light = new THREE.MeshStandardMaterial({ color: 0xf4f6fa, roughness: 0.4 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x3ddc84, emissive: 0x1b7a45, roughness: 0.3 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.62, 0.3), dark);
  body.position.z = 0.22;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.05), light);
  deck.position.set(-0.08, 0, 0.39);
  const lidar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.12, 24), accent);
  lidar.rotation.x = Math.PI / 2;
  lidar.position.set(0.3, 0, 0.44);
  visual.add(body, deck, lidar);
  for (const [x, y] of [[0.3, 0.33], [0.3, -0.33], [-0.3, 0.33], [-0.3, -0.33]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 16), dark);
    wheel.position.set(x, y, 0.1);
    visual.add(wheel);
  }

  // Map-only overlay: pulsing halo + heading chevron.
  const overlay = new THREE.Group();
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1.0, 48),
    new THREE.MeshBasicMaterial({ color: 0x2f80ed, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  halo.position.z = 0.02;
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 48),
    new THREE.MeshBasicMaterial({ color: 0x2f80ed, transparent: true, opacity: 0.12, depthWrite: false }),
  );
  disc.position.z = 0.015;
  const chevron = new THREE.Mesh(
    new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(1.45, 0), new THREE.Vector2(1.08, 0.28), new THREE.Vector2(1.08, -0.28)])),
    new THREE.MeshBasicMaterial({ color: 0x2f80ed, depthWrite: false, transparent: true }),
  );
  chevron.position.z = 0.03;
  overlay.add(halo, disc, chevron);
  visual.add(onLayer(overlay, overlayLayer));

  return { frame, visual, halo };
}

export function createGoalMarker() {
  const group = new THREE.Group();
  const scaled = new THREE.Group();
  group.add(scaled);
  const blue = new THREE.MeshStandardMaterial({ color: 0x2f80ed, emissive: 0x0d3f8a, roughness: 0.35 });

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.46, 40),
    new THREE.MeshBasicMaterial({ color: 0x2f80ed, transparent: true, opacity: 0.85, depthWrite: false }),
  );
  ring.position.z = 0.04;
  const pin = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), blue);
  head.position.z = 0.25;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 20), blue);
  tip.rotation.x = -Math.PI / 2;
  pin.add(head, tip);
  scaled.add(ring, pin);
  group.userData = { pin, scaled };
  return group;
}

const ZONE_STYLE = {
  nogo: { fill: 0xe5484d, fillOpacity: 0.26, line: 0xc8323a },
  slow: { fill: 0xf07c8a, fillOpacity: 0.16, line: 0xe0606f },
};

export function createZone(zone, overlayLayer) {
  const style = ZONE_STYLE[zone.type] || ZONE_STYLE.slow;
  const group = new THREE.Group();
  group.name = zone.id;

  const shape = new THREE.Shape(zone.polygon.map(([x, y]) => new THREE.Vector2(x, y)));
  const fill = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({ color: style.fill, transparent: true, opacity: style.fillOpacity, depthWrite: false, side: THREE.DoubleSide }),
  );
  fill.position.z = 0.03;

  const outline = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(zone.polygon.map(([x, y]) => new THREE.Vector3(x, y, 0.035))),
    new THREE.LineBasicMaterial({ color: style.line, transparent: true, opacity: 0.8 }),
  );
  group.add(fill, outline);

  const el = document.createElement('div');
  el.className = `zone-label zone-label--${zone.type}`;
  el.textContent = zone.name;
  const label = new CSS2DObject(el);
  const cx = zone.polygon.reduce((s, p) => s + p[0], 0) / zone.polygon.length;
  const cy = zone.polygon.reduce((s, p) => s + p[1], 0) / zone.polygon.length;
  label.position.set(cx, cy, 0.1);
  group.add(label);

  // Zone tint shows in the camera view too (AR-style); label stays map-only.
  label.layers.set(overlayLayer);
  return group;
}
