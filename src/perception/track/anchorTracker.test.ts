import { describe, expect, it } from 'vitest';
import { seededRandom } from '../spots/spots';
import { AnchorTracker, extractPatch, searchPatch, smoothStep, type GrayFrame } from './anchorTracker';

/** A smooth random texture, like furniture seen at low resolution. */
function texture(seed: number): (x: number, y: number) => number {
  const r = seededRandom(seed);
  const waves = Array.from({ length: 12 }, () => ({ fx: r() * 0.5, fy: r() * 0.5, p: r() * 6.28, a: 10 + r() * 20 }));
  return (x, y) => 128 + waves.reduce((s, w) => s + w.a * Math.sin(w.fx * x + w.fy * y + w.p), 0) / 3;
}

function frame(w: number, h: number, f: (x: number, y: number) => number, dx = 0, dy = 0): GrayFrame {
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = f(x - dx, y - dy);
  return { width: w, height: h, data };
}

describe('patch search', () => {
  const f = texture(7);

  it('finds a shifted patch with sub-pixel accuracy', () => {
    const a = frame(160, 200, f);
    const t = extractPatch(a, 80, 100, 7, 6)!;
    expect(t).not.toBeNull();
    const b = frame(160, 200, f, 5.4, -3.3);
    const m = searchPatch(b, t, 7, 80, 100, 12)!;
    expect(m.score).toBeGreaterThan(0.95);
    expect(m.x).toBeCloseTo(85.4, 0);
    expect(m.y).toBeCloseTo(96.7, 0);
  });

  it('ignores flat surfaces and borders', () => {
    expect(extractPatch(frame(40, 40, () => 100), 20, 20, 7, 6)).toBeNull();
    expect(extractPatch(frame(40, 40, f), 3, 20, 7, 6)).toBeNull();
  });

  it('copes with a change of brightness', () => {
    const a = frame(160, 200, f);
    const t = extractPatch(a, 60, 60, 7, 6)!;
    const b = frame(160, 200, (x, y) => 0.6 * f(x, y) + 30, 2, 2);
    const m = searchPatch(b, t, 7, 60, 60, 12)!;
    expect(m.score).toBeGreaterThan(0.95);
    expect(Math.round(m.x)).toBe(62);
  });
});

describe('AnchorTracker', () => {
  const f = texture(11);

  it('follows an anchor that slides as the phone walks', () => {
    const tracker = new AnchorTracker();
    expect(tracker.capture(1, frame(160, 200, f), 0.5, 0.5)).toBe(true);
    // The furniture moved 8 px left; the gyroscope predicts no change.
    const m = tracker.track(1, frame(160, 200, f, -8, 0), { u: 0.5, v: 0.5 })!;
    expect(m.u * 160).toBeCloseTo(72, 0);
    expect(m.v * 200).toBeCloseTo(100, 0);
  });

  it('gives up when the patch is not there', () => {
    const tracker = new AnchorTracker();
    tracker.capture(1, frame(160, 200, f), 0.5, 0.5);
    expect(tracker.track(1, frame(160, 200, texture(99)), { u: 0.5, v: 0.5 })).toBeNull();
    expect(tracker.track(2, frame(160, 200, f), { u: 0.5, v: 0.5 })).toBeNull();
    tracker.remove(1);
    expect(tracker.has(1)).toBe(false);
  });

  it('smooths corrections and caps each step', () => {
    expect(smoothStep(0, 10, 0.5, 100)).toBe(5);
    expect(smoothStep(0, 10, 0.5, 2)).toBe(2);
    expect(smoothStep(0, -10, 0.5, 2)).toBe(-2);
  });
});
