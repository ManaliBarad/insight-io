// Decodes a sensor_msgs/PointCloud2 as delivered by rosbridge (data is base64)
// into flat Float32Arrays ready for a THREE.BufferGeometry.

const MAX_POINTS = 400_000;

// PointField datatype -> DataView reader
const READERS = {
  1: (v, o) => v.getInt8(o),
  2: (v, o) => v.getUint8(o),
  3: (v, o, le) => v.getInt16(o, le),
  4: (v, o, le) => v.getUint16(o, le),
  5: (v, o, le) => v.getInt32(o, le),
  6: (v, o, le) => v.getUint32(o, le),
  7: (v, o, le) => v.getFloat32(o, le),
  8: (v, o, le) => v.getFloat64(o, le),
};

export function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function decodePointCloud2(msg) {
  const field = (name) => msg.fields.find((f) => f.name === name && READERS[f.datatype]);
  const fx = field('x');
  const fy = field('y');
  const fz = field('z');
  if (!fx || !fy || !fz) return null;
  const frgb = field('rgb') || field('rgba');
  const fint = field('intensity');

  const bytes = typeof msg.data === 'string' ? base64ToBytes(msg.data) : Uint8Array.from(msg.data);
  const view = new DataView(bytes.buffer);
  const le = !msg.is_bigendian;
  const read = (f, o) => READERS[f.datatype](view, o + f.offset, le);

  // Organized clouds can pad each row, so locate points with row_step + point_step.
  const total = msg.width * msg.height;
  const stride = Math.max(1, Math.ceil(total / MAX_POINTS));
  const offsetOf = (i) => Math.floor(i / msg.width) * msg.row_step + (i % msg.width) * msg.point_step;

  let maxIntensity = 1;
  if (fint && !frgb) {
    for (let i = 0; i < total; i += stride) maxIntensity = Math.max(maxIntensity, read(fint, offsetOf(i)));
  }

  const positions = new Float32Array(Math.ceil(total / stride) * 3);
  const colors = frgb || fint ? new Float32Array(positions.length) : null;
  let n = 0;
  for (let i = 0; i < total; i += stride) {
    const o = offsetOf(i);
    const x = read(fx, o);
    const y = read(fy, o);
    const z = read(fz, o);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    positions.set([x, y, z], n * 3);
    if (frgb) {
      // Packed 0x00RRGGBB, stored little-endian as B, G, R
      const c = o + frgb.offset;
      colors.set([bytes[c + 2] / 255, bytes[c + 1] / 255, bytes[c] / 255], n * 3);
    } else if (fint) {
      const v = 0.25 + 0.75 * (read(fint, o) / maxIntensity);
      colors.set([v, v, v], n * 3);
    }
    n++;
  }
  return { positions: positions.subarray(0, n * 3), colors: colors?.subarray(0, n * 3) ?? null, count: n };
}
