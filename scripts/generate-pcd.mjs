// Generates a synthetic warehouse point cloud (binary .pcd) plus map metadata
// (zones, bounds, start pose) so the dashboard runs fully offline.
//
//   node scripts/generate-pcd.mjs
//
// Output (ROS convention: x forward, y left, z up, metres):
//   public/data/warehouse.pcd
//   public/data/map.json

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data');

// Deterministic RNG so the map is identical on every run.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(1234);
const range = (a, b) => a + (b - a) * rand();
const jitter = (s) => (rand() - 0.5) * 2 * s;

// Building footprint in a local frame, then rotated + centred into the map frame
// (the demo map sits at a slight angle).
const W = 36;
const H = 54;
const ROT = (12 * Math.PI) / 180;
const toMap = (x, y) => {
  const lx = x - W / 2;
  const ly = y - H / 2;
  return [lx * Math.cos(ROT) - ly * Math.sin(ROT), lx * Math.sin(ROT) + ly * Math.cos(ROT)];
};

const points = []; // [x, y, z, r, g, b]
function push(x, y, z, [r, g, b]) {
  const [mx, my] = toMap(x, y);
  points.push([mx, my, z, r, g, b]);
}

const FLOOR = () => {
  const v = 236 + Math.floor(rand() * 16);
  return [v, v, v - 2];
};
const WALL = () => {
  const v = 18 + Math.floor(rand() * 22);
  return [v, v, v + 4];
};
const byHeight = (z) => {
  const t = Math.min(1, z / 3);
  const v = Math.round(170 - 130 * t + jitter(10));
  return [v, v, v + 3];
};

// --- Floor -------------------------------------------------------------------
for (let i = 0; i < W * H * 22; i++) {
  push(range(0, W), range(0, H), jitter(0.01), FLOOR());
}

// --- Walls (with door gaps and jagged scan noise) ----------------------------
function wall(x0, y0, x1, y1, gaps = [], height = 4) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.floor(len * 70);
  for (let i = 0; i < n; i++) {
    const t = rand();
    const d = t * len;
    if (gaps.some(([a, b]) => d >= a && d <= b)) continue;
    const off = jitter(0.12);
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    push(x0 + (x1 - x0) * t + nx * off, y0 + (y1 - y0) * t + ny * off, range(0, height), WALL());
  }
  // Clutter blobs hugging the wall, like real lidar returns.
  for (let i = 0; i < len / 3; i++) {
    const t = rand();
    const cx = x0 + (x1 - x0) * t;
    const cy = y0 + (y1 - y0) * t;
    for (let k = 0; k < 40; k++) push(cx + jitter(0.35), cy + jitter(0.35), range(0, 1.2), WALL());
  }
}

wall(0, 0, W, 0, [[8, 14], [24, 27]]);
wall(W, 0, W, H, [[38, 41]]);
wall(W, H, 0, H);
wall(0, H, 0, 0, [[18, 22]]);
// Office partition (top-left) with a doorway.
wall(0, 41, 12, 41, [[5, 7]], 3);
wall(12, 41, 12, H, [], 3);

// --- Columns -----------------------------------------------------------------
for (let x = 9; x < W; x += 9) {
  for (let y = 9; y < H - 4; y += 9) {
    for (let k = 0; k < 220; k++) push(x + jitter(0.2), y + jitter(0.2), range(0, 6), WALL());
  }
}

// --- Racks (shelving rows) ---------------------------------------------------
function box(cx, cy, w, d, h, density = 90) {
  // Top surface
  for (let i = 0; i < w * d * density * 0.4; i++) push(cx + jitter(w / 2), cy + jitter(d / 2), h + jitter(0.02), byHeight(h));
  // Vertical faces
  const perim = 2 * (w + d);
  for (let i = 0; i < perim * h * density * 0.35; i++) {
    const s = rand() * perim;
    let x;
    let y;
    if (s < w) [x, y] = [cx - w / 2 + s, cy - d / 2];
    else if (s < w + d) [x, y] = [cx + w / 2, cy - d / 2 + (s - w)];
    else if (s < 2 * w + d) [x, y] = [cx + w / 2 - (s - w - d), cy + d / 2];
    else [x, y] = [cx - w / 2, cy + d / 2 - (s - 2 * w - d)];
    const z = rand() * h;
    push(x, y, z, byHeight(z));
  }
}

for (let i = 0; i < 4; i++) box(21 + i * 3.6, 20, 1.2, 26, 2.6, 60);
box(26.4, 44, 14, 1.2, 2.6, 60);

// --- Pallets / loose goods ----------------------------------------------------
const pallets = [
  [4, 4], [6.5, 4.5], [10, 5], [4, 11], [8.5, 12.5], [15.5, 16], [16, 20], [15, 25],
  [5, 26], [9, 30], [3.5, 34], [30, 3.5], [33, 7], [17, 37], [22, 50], [28, 50.5], [32, 49],
  [7, 46], [3, 49], [9, 51],
];
for (const [x, y] of pallets) box(x + jitter(0.3), y + jitter(0.3), range(0.8, 1.3), range(0.9, 1.3), range(0.2, 1.6), 120);

// --- Scan spill through open doors -------------------------------------------
function spill(x, y, dirX, dirY, length, spread, count) {
  for (let i = 0; i < count; i++) {
    const d = rand() * length;
    const s = jitter(spread * (0.3 + d / length));
    push(x + dirX * d - dirY * s, y + dirY * d + dirX * s, jitter(0.01), FLOOR());
  }
}
spill(11, 0, 0, -1, 9, 5, 4000);
spill(25.5, 0, 0, -1, 6, 2.5, 1500);
spill(0, 20, -1, 0, 7, 3, 2000);
spill(W, 39.5, 1, 0, 6, 2.5, 1500);

// --- Write binary PCD ----------------------------------------------------------
const N = points.length;
const header =
  [
    '# .PCD v0.7 - Point Cloud Data file format',
    '# Synthetic warehouse generated by scripts/generate-pcd.mjs',
    'VERSION 0.7',
    'FIELDS x y z rgb',
    'SIZE 4 4 4 4',
    'TYPE F F F U',
    'COUNT 1 1 1 1',
    `WIDTH ${N}`,
    'HEIGHT 1',
    'VIEWPOINT 0 0 0 1 0 0 0',
    `POINTS ${N}`,
    'DATA binary',
  ].join('\n') + '\n';

const headerBuf = Buffer.from(header, 'ascii');
const body = Buffer.alloc(N * 16);
points.forEach(([x, y, z, r, g, b], i) => {
  const o = i * 16;
  body.writeFloatLE(x, o);
  body.writeFloatLE(y, o + 4);
  body.writeFloatLE(z, o + 8);
  // Packed 0x00RRGGBB, little-endian => bytes B, G, R, 0
  body.writeUInt8(b, o + 12);
  body.writeUInt8(g, o + 13);
  body.writeUInt8(r, o + 14);
  body.writeUInt8(0, o + 15);
});

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, 'warehouse.pcd'), Buffer.concat([headerBuf, body]));

// --- Map metadata ------------------------------------------------------------
const rect = (x0, y0, x1, y1) => [toMap(x0, y0), toMap(x1, y0), toMap(x1, y1), toMap(x0, y1)];
const round = (poly) => poly.map(([x, y]) => [+x.toFixed(2), +y.toFixed(2)]);

const map = {
  name: 'Warehouse A',
  frame: 'map',
  cloud: 'warehouse.pcd', // relative to map.json
  bounds: round(rect(0.4, 0.4, W - 0.4, H - 0.4)),
  start: { x: +toMap(8, 20)[0].toFixed(2), y: +toMap(8, 20)[1].toFixed(2), yaw: Math.PI / 2 + ROT },
  missionGoal: { x: +toMap(17.5, 33)[0].toFixed(2), y: +toMap(17.5, 33)[1].toFixed(2) },
  zones: [
    { id: 'loading', name: 'Loading Bay', type: 'slow', polygon: round(rect(2, 1, 13, 8)) },
    { id: 'racks', name: 'Rack Aisle A', type: 'slow', polygon: round(rect(19.5, 6.5, 33.5, 33.5)) },
    { id: 'charging', name: 'Charging', type: 'slow', polygon: round(rect(1.5, 29, 6.5, 37)) },
    { id: 'staging', name: 'Staging', type: 'slow', polygon: round(rect(13.5, 14, 18, 27)) },
    { id: 'office', name: 'Office', type: 'nogo', polygon: round(rect(0.5, 41.5, 11.5, 53.5)) },
    { id: 'mezz', name: 'Mezzanine', type: 'nogo', polygon: round(rect(19, 42, 34, 46)) },
  ],
};
writeFileSync(resolve(OUT_DIR, 'map.json'), JSON.stringify(map, null, 2) + '\n');

console.log(`Wrote ${N.toLocaleString()} points (${(body.length / 1e6).toFixed(1)} MB) and map.json to ${OUT_DIR}`);
