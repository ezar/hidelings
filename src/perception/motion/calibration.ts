// Field-of-view calibration (spec 8.3): compare how far the image moves between two frames with how far
// the gyroscope says the phone turned, and solve for the field of view that makes them agree.
import type { FramePixels } from '../depth/types';
import { toDevice, toWorld, type Mat3 } from './rotation';

export interface GrayImage {
  width: number;
  height: number;
  data: Float32Array;
}

/** Downscaled luminance of an RGBA frame. */
export function toGray(frame: FramePixels, width = 96): GrayImage {
  const height = Math.round((width * frame.height) / frame.width);
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const fy = Math.floor(((y + 0.5) / height) * frame.height);
    for (let x = 0; x < width; x++) {
      const fx = Math.floor(((x + 0.5) / width) * frame.width);
      const i = (fy * frame.width + fx) * 4;
      data[y * width + x] = 0.299 * frame.data[i]! + 0.587 * frame.data[i + 1]! + 0.114 * frame.data[i + 2]!;
    }
  }
  return { width, height, data };
}

export interface Shift {
  /** Pixels the content moved from `a` to `b`: b(x, y) ≈ a(x - dx, y - dy). */
  dx: number;
  dy: number;
  /** 0..1, how much better the best shift matches than the average one. */
  confidence: number;
}

/**
 * Global image shift by exhaustive search over integer shifts, refined to sub-pixel with a parabola.
 * Compares mean absolute differences over the central region both shifts can see.
 */
export function estimateShift(a: GrayImage, b: GrayImage, maxShift = 12, maxShiftY = maxShift): Shift | null {
  if (a.width !== b.width || a.height !== b.height) return null;
  const { width: w, height: h } = a;
  const m = Math.max(maxShift, maxShiftY);
  if (w <= 4 * m || h <= 4 * m) return null;
  const cost = (dx: number, dy: number) => {
    let sum = 0;
    let n = 0;
    for (let y = m; y < h - m; y += 1) {
      for (let x = m; x < w - m; x += 1) {
        sum += Math.abs(b.data[y * w + x]! - a.data[(y - dy) * w + (x - dx)]!);
        n++;
      }
    }
    return sum / n;
  };

  const costs = new Map<string, number>();
  let best = { dx: 0, dy: 0, c: Infinity };
  let total = 0;
  let count = 0;
  for (let dy = -maxShiftY; dy <= maxShiftY; dy++) {
    for (let dx = -maxShift; dx <= maxShift; dx++) {
      const c = cost(dx, dy);
      costs.set(`${dx},${dy}`, c);
      total += c;
      count++;
      if (c < best.c) best = { dx, dy, c };
    }
  }
  const mean = total / count;
  if (!(mean > 0)) return null;

  const refine = (cm: number | undefined, c0: number, cp: number | undefined) => {
    if (cm === undefined || cp === undefined) return 0;
    const den = cm - 2 * c0 + cp;
    return den > 0 ? Math.max(-0.5, Math.min(0.5, (cm - cp) / (2 * den))) : 0;
  };
  const at = (dx: number, dy: number) => costs.get(`${dx},${dy}`);
  return {
    dx: best.dx + refine(at(best.dx - 1, best.dy), best.c, at(best.dx + 1, best.dy)),
    dy: best.dy + refine(at(best.dx, best.dy - 1), best.c, at(best.dx, best.dy + 1)),
    confidence: 1 - best.c / mean,
  };
}

/**
 * Field of view on the video's long side that explains a measured horizontal shift.
 * `poseA` and `poseB` are the device orientations when the two frames were grabbed; `du` is the shift as a
 * fraction of the image width. Returns null when the rotation or the shift is too small to be reliable.
 */
export function fovFromShift(poseA: Mat3, poseB: Mat3, du: number, videoWidth: number, videoHeight: number): number | null {
  const d = toDevice(poseB, toWorld(poseA, [0, 0, -1]));
  if (d[2] > -1e-3) return null;
  const slope = d[0] / -d[2];
  if (Math.abs(slope) < Math.tan((1.5 * Math.PI) / 180) || Math.abs(du) < 0.02) return null;
  if (Math.sign(slope) !== Math.sign(du)) return null;
  const tx = slope / (2 * du);
  const long = videoWidth >= videoHeight ? tx : (tx * videoHeight) / videoWidth;
  const fov = (2 * Math.atan(long) * 180) / Math.PI;
  return fov > 30 && fov < 100 ? fov : null;
}

/** Collects field-of-view estimates while the player turns, and reports their median. */
export class FovCalibrator {
  private samples: number[] = [];
  left = false;
  right = false;

  add(fov: number, du: number) {
    this.samples.push(fov);
    if (du > 0) this.left = true;
    else this.right = true;
  }

  get count(): number {
    return this.samples.length;
  }

  /** Median once both directions have been seen and there are enough samples. */
  result(minSamples = 6): number | null {
    if (!this.left || !this.right || this.samples.length < minSamples) return null;
    const s = [...this.samples].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)]!;
  }
}
