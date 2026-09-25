import { describe, expect, it } from 'vitest';
import type { DepthMap } from '../depth/types';
import { findHidingSpots, seededRandom } from './spots';

function map(w: number, h: number, fill: (x: number, y: number) => number): DepthMap {
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = fill(x, y);
  return { width: w, height: h, data };
}

describe('findHidingSpots', () => {
  it('finds horizontal-edge spots just above a sofa', () => {
    // Far wall (0.2) with a near sofa (0.8) in the lower half.
    const m = map(100, 100, (_x, y) => (y >= 55 ? 0.8 : 0.2));
    const spots = findHidingSpots(m, 5, { random: seededRandom(1) });
    expect(spots.length).toBeGreaterThan(0);
    for (const s of spots) {
      expect(s.v).toBeLessThan(0.56);
      expect(s.v).toBeGreaterThan(0.45);
      expect(s.kind).toBe('horizontal');
      expect(s.disp).toBeCloseTo(0.2);
    }
  });

  it('finds vertical-edge spots beside a door frame', () => {
    // A near vertical post (0.9) at x 40..45, far behind (0.1).
    const m = map(100, 100, x => (x >= 40 && x < 46 ? 0.9 : 0.1));
    const spots = findHidingSpots(m, 4, { random: seededRandom(2) });
    expect(spots.length).toBeGreaterThan(0);
    expect(spots.every(s => s.kind === 'vertical')).toBe(true);
  });

  it('only searches the part of the map on screen', () => {
    const m = map(100, 100, x => (x >= 20 && x < 26 ? 0.9 : 0.1));
    expect(findHidingSpots(m, 4, { random: seededRandom(5), bounds: { u0: 0.4, v0: 0, u1: 0.8, v1: 1 } })).toHaveLength(0);
  });

  it('keeps spots apart and finds none in a flat room', () => {
    const edge = map(100, 100, (_x, y) => (y >= 55 ? 0.8 : 0.2));
    const spots = findHidingSpots(edge, 10, { random: seededRandom(3) });
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        expect(Math.hypot(spots[i]!.u - spots[j]!.u, spots[i]!.v - spots[j]!.v)).toBeGreaterThan(0.18);
      }
    }
    expect(findHidingSpots(map(100, 100, () => 0.3), 5, { random: seededRandom(4) })).toHaveLength(0);
  });
});
