// Rotation maths for 3DoF anchoring (spec 8.1 and 8.2), ported from poc/src/orientation.js.
// Device frame: x to the right of the screen, y to the top, z out of the screen towards the user.
// The rear camera looks along -z. World frame comes from DeviceOrientation: R = Rz(alpha) · Rx(beta) · Ry(gamma).

/** Row-major 3×3 rotation matrix mapping device coordinates to world coordinates. */
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];
export type Vec3 = readonly [number, number, number];

/** A point in normalized video coordinates: 0..1, v grows downwards. */
export interface VideoPoint {
  u: number;
  v: number;
}

/** Tangents of the half field of view along the video's x and y axes. */
export interface CameraTans {
  tx: number;
  ty: number;
}

const DEG = Math.PI / 180;

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function multiply(a: Mat3, b: Mat3): Mat3 {
  const r = new Array<number>(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r[i * 3 + j] = a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!;
    }
  }
  return r as unknown as Mat3;
}

/** W3C DeviceOrientation angles in degrees to a device-to-world rotation. */
export function fromEuler(alpha: number, beta: number, gamma: number): Mat3 {
  const a = alpha * DEG;
  const b = beta * DEG;
  const g = gamma * DEG;
  const ca = Math.cos(a), sa = Math.sin(a);
  const cb = Math.cos(b), sb = Math.sin(b);
  const cg = Math.cos(g), sg = Math.sin(g);
  const rz: Mat3 = [ca, -sa, 0, sa, ca, 0, 0, 0, 1];
  const rx: Mat3 = [1, 0, 0, 0, cb, -sb, 0, sb, cb];
  const ry: Mat3 = [cg, 0, sg, 0, 1, 0, -sg, 0, cg];
  return multiply(multiply(rz, rx), ry);
}

/** Device-frame direction to world frame (R · d). */
export function toWorld(m: Mat3, d: Vec3): Vec3 {
  return [
    m[0] * d[0] + m[1] * d[1] + m[2] * d[2],
    m[3] * d[0] + m[4] * d[1] + m[5] * d[2],
    m[6] * d[0] + m[7] * d[1] + m[8] * d[2],
  ];
}

/** World-frame direction to device frame (Rᵀ · w). */
export function toDevice(m: Mat3, w: Vec3): Vec3 {
  return [
    m[0] * w[0] + m[3] * w[1] + m[6] * w[2],
    m[1] * w[0] + m[4] * w[1] + m[7] * w[2],
    m[2] * w[0] + m[5] * w[1] + m[8] * w[2],
  ];
}

/** Half-FOV tangents for a video frame, with the calibrated FOV applied to its long side. */
export function cameraTans(fovDeg: number, videoWidth: number, videoHeight: number): CameraTans {
  const t = Math.tan((fovDeg * DEG) / 2);
  const w = videoWidth || 1;
  const h = videoHeight || 1;
  return w >= h ? { tx: t, ty: (t * h) / w } : { ty: t, tx: (t * w) / h };
}

/** Normalized video point to a device-frame ray: [(2u - 1)·tanX, (1 - 2v)·tanY, -1]. */
export function ray(p: VideoPoint, tans: CameraTans): Vec3 {
  return [(2 * p.u - 1) * tans.tx, (1 - 2 * p.v) * tans.ty, -1];
}

/** Device-frame direction to a normalized video point, or null when it is behind the camera. */
export function project(d: Vec3, tans: CameraTans): VideoPoint | null {
  if (d[2] > -1e-3) return null;
  const z = -d[2];
  return { u: (d[0] / z / tans.tx + 1) / 2, v: (1 - d[1] / z / tans.ty) / 2 };
}

/** Angle in degrees between two directions of any length. */
export function angleBetween(a: Vec3, b: Vec3): number {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const na = Math.hypot(a[0], a[1], a[2]);
  const nb = Math.hypot(b[0], b[1], b[2]);
  if (!na || !nb) return 0;
  return Math.acos(Math.min(1, Math.max(-1, dot / (na * nb)))) / DEG;
}
