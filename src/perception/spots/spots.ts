// Hiding spot finder (spec 7.2), from poc/src/hidelings.js: far points right next to a much nearer object,
// such as the edge of a sofa, a chair leg or a door frame. Each spot is classified by where the nearer
// object is, so species can pick the spots they like.
import type { SpotKind } from '../../engine/species';
import type { DepthMap } from '../depth/types';

export interface HidingSpot {
  u: number;
  v: number;
  disp: number;
  /** Depth difference to the nearer neighbour; higher is a better hiding place. */
  score: number;
  kind: SpotKind;
  /** Where the nearer object is, in normalized coordinates: moving towards it hides more. */
  edgeU: number;
  edgeV: number;
}

export interface SpotOptions {
  samples?: number;
  /** A candidate must be at least this far (below this relative inverse depth). */
  maxDisp?: number;
  /** The neighbour must be this much nearer. */
  minStep?: number;
  /** Minimum distance between two spots, in normalized coordinates. */
  minSeparation?: number;
  random?: () => number;
  /** Part of the map to search, in normalized coordinates: only what is on screen. */
  bounds?: { u0: number; v0: number; u1: number; v1: number };
}

export function findHidingSpots(map: DepthMap, count: number, opts: SpotOptions = {}): HidingSpot[] {
  const { width: w, height: h, data } = map;
  const samples = opts.samples ?? 1800;
  const maxDisp = opts.maxDisp ?? 0.75;
  const minStep = opts.minStep ?? 0.18;
  const minSep = opts.minSeparation ?? 0.18;
  const random = opts.random ?? Math.random;
  // Stay away from the borders, and inside what the player can see.
  const b = opts.bounds ?? { u0: 0, v0: 0, u1: 1, v1: 1 };
  const u0 = Math.max(0.1, b.u0 + 0.06), u1 = Math.min(0.9, b.u1 - 0.06);
  const v0 = Math.max(0.15, b.v0 + 0.08), v1 = Math.min(0.85, b.v1 - 0.12);
  if (u1 <= u0 || v1 <= v0) return [];
  const k = Math.max(3, Math.round(w * 0.04));
  // Below, to the sides and diagonally below: where a nearer object hides the far surface from view.
  const probes: [number, number][] = [[k, 0], [-k, 0], [0, k], [k, k], [-k, k], [0, -k]];

  const candidates: HidingSpot[] = [];
  for (let i = 0; i < samples; i++) {
    const x = Math.floor(w * (u0 + (u1 - u0) * random()));
    const y = Math.floor(h * (v0 + (v1 - v0) * random()));
    const d = data[y * w + x]!;
    if (d > maxDisp) continue;
    let best = 0;
    let bestProbe: [number, number] = [0, 0];
    for (const [dx, dy] of probes) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const step = data[yy * w + xx]! - d;
      if (step > best) {
        best = step;
        bestProbe = [dx, dy];
      }
    }
    if (best > minStep) {
      candidates.push({
        u: (x + 0.5) / w,
        v: (y + 0.5) / h,
        disp: d,
        score: best,
        kind: Math.abs(bestProbe[1]) > Math.abs(bestProbe[0]) || bestProbe[0] === 0 ? 'horizontal' : 'vertical',
        edgeU: (x + bestProbe[0] + 0.5) / w,
        edgeV: (y + bestProbe[1] + 0.5) / h,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const picked: HidingSpot[] = [];
  for (const c of candidates) {
    if (picked.every(p => Math.hypot(p.u - c.u, p.v - c.v) > minSep)) picked.push(c);
    if (picked.length >= count) break;
  }
  return picked;
}

/** Deterministic pseudo-random numbers for tests and repeatable scans. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}
