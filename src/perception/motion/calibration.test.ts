import { describe, expect, it } from 'vitest';
import { FovCalibrator, estimateShift, fovFromShift, toGray, type GrayImage } from './calibration';
import { cameraTans, fromEuler, project, ray, toDevice, toWorld } from './rotation';

/** Deterministic textured image, shifted by (sx, sy) pixels. */
function texture(w: number, h: number, sx = 0, sy = 0): GrayImage {
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x - sx;
      const v = y - sy;
      data[y * w + x] = 128 + 60 * Math.sin(u * 0.37) * Math.cos(v * 0.23) + 40 * Math.sin((u + 2 * v) * 0.11);
    }
  }
  return { width: w, height: h, data };
}

describe('estimateShift', () => {
  it('finds integer shifts', () => {
    const s = estimateShift(texture(96, 96), texture(96, 96, 5, -2))!;
    expect(s.dx).toBeCloseTo(5, 1);
    expect(s.dy).toBeCloseTo(-2, 1);
    expect(s.confidence).toBeGreaterThan(0.5);
  });

  it('finds sub-pixel shifts approximately', () => {
    const s = estimateShift(texture(96, 96), texture(96, 96, 3.5, 0))!;
    expect(Math.abs(s.dx - 3.5)).toBeLessThan(0.35);
  });

  it('reports low confidence on a flat image', () => {
    const flat = { width: 96, height: 96, data: new Float32Array(96 * 96).fill(100) };
    expect(estimateShift(flat, flat)).toBeNull();
  });
});

describe('fovFromShift', () => {
  // Simulates what a camera with a known FOV sees when the phone turns, and checks we recover that FOV.
  it.each([55, 64, 72])('recovers a %i° field of view', trueFov => {
    const vw = 720;
    const vh = 1280;
    const tans = cameraTans(trueFov, vw, vh);
    const a = fromEuler(0, 90, 0);
    const b = fromEuler(5, 90, 0);
    const centre = toWorld(a, ray({ u: 0.5, v: 0.5 }, tans));
    const moved = project(toDevice(b, centre), tans)!;
    const fov = fovFromShift(a, b, moved.u - 0.5, vw, vh)!;
    expect(fov).toBeCloseTo(trueFov, 3);
  });

  it('rejects tiny rotations and contradictory directions', () => {
    const a = fromEuler(0, 90, 0);
    expect(fovFromShift(a, fromEuler(0.5, 90, 0), 0.01, 720, 1280)).toBeNull();
    expect(fovFromShift(a, fromEuler(5, 90, 0), -0.1, 720, 1280)).toBeNull();
  });
});

describe('FovCalibrator', () => {
  it('needs both directions and enough samples', () => {
    const c = new FovCalibrator();
    for (const f of [63, 64, 65]) c.add(f, 0.05);
    expect(c.result(4)).toBeNull();
    for (const f of [66, 62]) c.add(f, -0.05);
    expect(c.result(4)).toBe(64);
  });
});

describe('toGray', () => {
  it('downscales keeping the aspect ratio', () => {
    const frame = { width: 320, height: 568, data: new Uint8ClampedArray(320 * 568 * 4).fill(255) };
    const g = toGray(frame, 96);
    expect(g.width).toBe(96);
    expect(g.height).toBe(170);
    expect(g.data[0]).toBeCloseTo(255);
  });
});
