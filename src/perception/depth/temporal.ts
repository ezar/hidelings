// Temporal blending of depth maps (spec 7.1): each new map is blended with the previous one, warped by
// the rotation between the two frames, to calm flicker at object edges.
import { project, ray, type CameraTans, type Mat3 } from '../motion/rotation';
import type { DepthMap } from './types';

/** A depth map with the device orientation captured when its camera frame was grabbed. */
export interface PosedDepthMap extends DepthMap {
  pose: Mat3;
}

/** Rotation taking device-frame directions of `next` into the device frame of `prev`: prevᵀ · next. */
function relative(prev: Mat3, next: Mat3): Mat3 {
  const r = new Array<number>(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r[i * 3 + j] = prev[i]! * next[j]! + prev[3 + i]! * next[3 + j]! + prev[6 + i]! * next[6 + j]!;
    }
  }
  return r as unknown as Mat3;
}

/** Angle of a rotation matrix, in degrees. */
function rotationAngle(m: Mat3): number {
  const c = (m[0] + m[4] + m[8] - 1) / 2;
  return (Math.acos(Math.min(1, Math.max(-1, c))) * 180) / Math.PI;
}

/**
 * Blends `next` with `prev` warped into `next`'s view. `prevWeight` is the share of the old map where it is
 * visible; pixels the old frame did not see keep the new value. Skips the blend for large rotations, where
 * the old map says little about the new view.
 */
export function blendWithPrevious(
  prev: PosedDepthMap | null,
  next: PosedDepthMap,
  tans: CameraTans,
  prevWeight = 0.35,
  maxRotationDeg = 12,
): PosedDepthMap {
  if (!prev || prev.width !== next.width || prev.height !== next.height) return next;
  const r = relative(prev.pose, next.pose);
  if (rotationAngle(r) > maxRotationDeg) return next;

  const { width: w, height: h } = next;
  const out = new Float32Array(next.data.length);
  const keep = 1 - prevWeight;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const d = ray({ u: (x + 0.5) / w, v: (y + 0.5) / h }, tans);
      const q = project([
        r[0] * d[0] + r[1] * d[1] + r[2] * d[2],
        r[3] * d[0] + r[4] * d[1] + r[5] * d[2],
        r[6] * d[0] + r[7] * d[1] + r[8] * d[2],
      ], tans);
      const now = next.data[i]!;
      if (!q || q.u < 0 || q.u >= 1 || q.v < 0 || q.v >= 1) {
        out[i] = now;
        continue;
      }
      const old = prev.data[Math.floor(q.v * h) * w + Math.floor(q.u * w)]!;
      out[i] = keep * now + prevWeight * old;
    }
  }
  return { ...next, data: out };
}

/**
 * Flicker as spec 15 defines it: the share of visibility samples where a creature's visible fraction jumps
 * by more than 30% from the previous sample.
 */
export class FlickerMeter {
  private last = new Map<number, number>();
  samples = 0;
  jumps = 0;

  add(id: number, visible: number, threshold = 0.3) {
    const prev = this.last.get(id);
    this.last.set(id, visible);
    if (prev === undefined) return;
    this.samples++;
    if (Math.abs(visible - prev) > threshold) this.jumps++;
  }

  forget(id: number) {
    this.last.delete(id);
  }

  get ratio(): number {
    return this.samples ? this.jumps / this.samples : 0;
  }

  reset() {
    this.last.clear();
    this.samples = 0;
    this.jumps = 0;
  }
}
