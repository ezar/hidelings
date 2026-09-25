// Device orientation as a rotation matrix (device frame to world frame), plus camera ray maths.
// Device frame: x to the right of the screen, y to the top, z out of the screen towards the user.
// The rear camera looks along -z. Portrait orientation is assumed.
const DEG = Math.PI / 180;
let matrix = [1, 0, 0, 0, 1, 0, 0, 0, 1];
let active = false;
let eventCount = 0;

// Must be called from a user gesture on iOS, before any other await.
export async function enable() {
  if (typeof DeviceOrientationEvent === 'undefined') return false;
  try {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result !== 'granted') return false;
    }
  } catch {
    return false;
  }
  window.addEventListener('deviceorientation', onEvent);
  return true;
}

function onEvent(e) {
  if (e.alpha == null || e.beta == null || e.gamma == null) return;
  matrix = fromEuler(e.alpha, e.beta, e.gamma);
  active = true;
  eventCount++;
}

export const getMatrix = () => matrix;
export const isActive = () => active;
export function takeEventCount() {
  const n = eventCount;
  eventCount = 0;
  return n;
}

function mul(a, b) {
  const r = new Array(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    }
  }
  return r;
}

// W3C DeviceOrientation: R = Rz(alpha) * Rx(beta) * Ry(gamma).
function fromEuler(alpha, beta, gamma) {
  const a = alpha * DEG, b = beta * DEG, g = gamma * DEG;
  const ca = Math.cos(a), sa = Math.sin(a);
  const cb = Math.cos(b), sb = Math.sin(b);
  const cg = Math.cos(g), sg = Math.sin(g);
  const rz = [ca, -sa, 0, sa, ca, 0, 0, 0, 1];
  const rx = [1, 0, 0, 0, cb, -sb, 0, sb, cb];
  const ry = [cg, 0, sg, 0, 1, 0, -sg, 0, cg];
  return mul(mul(rz, rx), ry);
}

export const toWorld = (m, d) => [
  m[0] * d[0] + m[1] * d[1] + m[2] * d[2],
  m[3] * d[0] + m[4] * d[1] + m[5] * d[2],
  m[6] * d[0] + m[7] * d[1] + m[8] * d[2],
];

export const toDevice = (m, w) => [
  m[0] * w[0] + m[3] * w[1] + m[6] * w[2],
  m[1] * w[0] + m[4] * w[1] + m[7] * w[2],
  m[2] * w[0] + m[5] * w[1] + m[8] * w[2],
];

// u and v are normalized video coordinates (0..1, v grows downwards).
export const ray = (u, v, tx, ty) => [(2 * u - 1) * tx, (1 - 2 * v) * ty, -1];

export function project(d, tx, ty) {
  if (d[2] > -1e-3) return null;
  const z = -d[2];
  return { u: (d[0] / z / tx + 1) / 2, v: (1 - d[1] / z / ty) / 2 };
}
