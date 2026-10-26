// Decodes a sensor_msgs/PointCloud2 as delivered by rosbridge (data is base64)
// into flat Float32Arrays ready for a THREE.BufferGeometry.

const FLOAT32 = 7;
const MAX_POINTS = 400_000;

export function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function decodePointCloud2(msg) {
  const field = (name) => msg.fields.find((f) => f.name === name);
  const fx = field('x');
  const fy = field('y');
  const fz = field('z');
  if (!fx || !fy || !fz || fx.datatype !== FLOAT32) return null;
  const frgb = field('rgb') || field('rgba');
  const fint = field('intensity');

  const bytes = typeof msg.data === 'string' ? base64ToBytes(msg.data) : Uint8Array.from(msg.data);
  const view = new DataView(bytes.buffer);
  const le = !msg.is_bigendian;
  const total = msg.width * msg.height;
  const stride = Math.max(1, Math.ceil(total / MAX_POINTS));

  const positions = new Float32Array(Math.ceil(total / stride) * 3);
  const colors = frgb || fint ? new Float32Array(positions.length) : null;
  let maxIntensity = 1;
  if (fint && !frgb) {
    for (let i = 0; i < total; i += stride) maxIntensity = Math.max(maxIntensity, view.getFloat32(i * msg.point_step + fint.offset, le));
  }

  let n = 0;
  for (let i = 0; i < total; i += stride) {
    const o = i * msg.point_step;
    const x = view.getFloat32(o + fx.offset, le);
    const y = view.getFloat32(o + fy.offset, le);
    const z = view.getFloat32(o + fz.offset, le);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    positions.set([x, y, z], n * 3);
    if (frgb) {
      colors.set([bytes[o + frgb.offset + 2] / 255, bytes[o + frgb.offset + 1] / 255, bytes[o + frgb.offset] / 255], n * 3);
    } else if (fint) {
      const v = 0.25 + 0.75 * (view.getFloat32(o + fint.offset, le) / maxIntensity);
      colors.set([v, v, v], n * 3);
    }
    n++;
  }
  return { positions: positions.subarray(0, n * 3), colors: colors?.subarray(0, n * 3) ?? null, count: n };
}
