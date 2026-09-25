import { describe, expect, it } from 'vitest';
import { cameraTans, fromEuler } from '../motion/rotation';
import { FlickerMeter, blendWithPrevious, type PosedDepthMap } from './temporal';

const tans = cameraTans(64, 720, 1280);
const W = 40;
const H = 40;

function map(pose = fromEuler(0, 90, 0), fill: (x: number, y: number) => number): PosedDepthMap {
  const data = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) data[y * W + x] = fill(x, y);
  return { width: W, height: H, data, pose };
}

describe('blendWithPrevious', () => {
  it('returns the new map when there is no previous one', () => {
    const next = map(undefined, () => 1);
    expect(blendWithPrevious(null, next, tans)).toBe(next);
  });

  it('mixes two maps taken from the same pose', () => {
    const out = blendWithPrevious(map(undefined, () => 0), map(undefined, () => 1), tans, 0.25);
    expect(out.data[20 * W + 20]).toBeCloseTo(0.75);
  });

  it('follows the rotation: an edge seen in the old frame lands where it is in the new one', () => {
    // Old frame: near (1) on the right half. The phone then turns left, so the scene moves right in the image.
    const prev = map(fromEuler(0, 90, 0), x => (x >= W / 2 ? 1 : 0));
    const next = map(fromEuler(4, 90, 0), () => 0);
    const out = blendWithPrevious(prev, next, tans, 0.5);
    const row = 20;
    // Just right of the centre the old frame's near half no longer applies: it moved further right.
    expect(out.data[row * W + W / 2 + 1]).toBe(0);
    expect(out.data[row * W + W - 2]).toBeCloseTo(0.5);
  });

  it('skips the blend after a large rotation', () => {
    const next = map(fromEuler(30, 90, 0), () => 1);
    expect(blendWithPrevious(map(fromEuler(0, 90, 0), () => 0), next, tans)).toBe(next);
  });
});

describe('FlickerMeter', () => {
  it('counts jumps above 30% per creature', () => {
    const f = new FlickerMeter();
    f.add(1, 0.5);
    f.add(1, 0.55);
    f.add(1, 0.1);
    f.add(2, 0.9);
    f.add(2, 0.9);
    expect(f.samples).toBe(3);
    expect(f.jumps).toBe(1);
    expect(f.ratio).toBeCloseTo(1 / 3);
  });
});
