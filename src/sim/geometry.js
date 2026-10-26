export function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const zoneAt = (zones, x, y) => zones.find((z) => pointInPolygon(x, y, z.polygon)) || null;

export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Exponential approach, frame-rate independent.
export const approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
