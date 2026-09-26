// Helpers for the Android WebXR mode (spec 9.4, ADR 0008), kept free of WebXR objects so they can be tested.

/** Depth-buffer value (0..1) of a point `meters` in front of a camera, from its projection matrix (column-major). */
export function metersToDepth(meters: number, projection: ArrayLike<number>): number {
  if (!(meters > 0)) return 1;
  const ndc = (-projection[10]! * meters + projection[14]!) / meters;
  return Math.max(0, Math.min(1, 0.5 * ndc + 0.5));
}

export interface DepthSample {
  /** Distance of the creature's surface from the camera plane, in metres. */
  expected: number;
  /** The real scene's distance at the same pixel, or null when unknown. */
  real: number | null;
}

/**
 * Share of the creature not hidden by the room: a sample counts as hidden when the room is nearer than the
 * creature by more than `tolerance` metres. Unknown depth counts as visible.
 */
export function visibleFraction(samples: readonly DepthSample[], tolerance = 0.04): number {
  if (!samples.length) return 0;
  const seen = samples.filter(s => s.real === null || !(s.real > 0) || s.real >= s.expected - tolerance).length;
  return seen / samples.length;
}

/** Offsets (in units of the creature radius) of the points sampled for visibility: the centre and two rings. */
export const SAMPLE_OFFSETS: readonly (readonly [number, number])[] = [
  [0, 0],
  ...Array.from({ length: 8 }, (_, i) => [0.9 * Math.cos((i * Math.PI) / 4), 0.9 * Math.sin((i * Math.PI) / 4)] as const),
  ...Array.from({ length: 4 }, (_, i) => [0.45 * Math.cos((i * Math.PI) / 2 + Math.PI / 4), 0.45 * Math.sin((i * Math.PI) / 2 + Math.PI / 4)] as const),
];

/** Nearest hit along a ray against spheres; returns the index or -1. `dir` must be normalized. */
export function raySphere(origin: readonly number[], dir: readonly number[], spheres: readonly { c: readonly number[]; r: number }[]): number {
  let best = -1, bestT = Infinity;
  spheres.forEach((s, i) => {
    const o = [origin[0]! - s.c[0]!, origin[1]! - s.c[1]!, origin[2]! - s.c[2]!];
    const b = o[0]! * dir[0]! + o[1]! * dir[1]! + o[2]! * dir[2]!;
    const c = o[0]! ** 2 + o[1]! ** 2 + o[2]! ** 2 - s.r * s.r;
    const disc = b * b - c;
    if (disc < 0) return;
    const t = -b - Math.sqrt(disc);
    if (t > 0 && t < bestT) { bestT = t; best = i; }
  });
  return best;
}
