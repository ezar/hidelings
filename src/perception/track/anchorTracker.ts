// Parallax and drift correction (spec 8.5, ADR 0007): each creature keeps a small image patch of what is
// around its anchor. A few times a second the patch is searched for near where the gyroscope predicts
// the anchor to be; a confident match moves the creature there. When the seeker walks, the furniture
// shifts in the image and the creature follows it instead of sliding.
import type { FramePixels } from '../depth/types';

export interface GrayFrame {
  width: number;
  height: number;
  data: Float32Array;
}

export interface Match {
  u: number;
  v: number;
  /** Normalized cross-correlation, -1..1. */
  score: number;
}

export interface TrackerOptions {
  /** Half size of the patch in pixels of the tracking frame. */
  half?: number;
  /** Search radius around the prediction, in pixels. */
  radius?: number;
  /** Matches below this score are ignored. */
  minScore?: number;
  /** Patches flatter than this (standard deviation of grey, 0..255) cannot be tracked. */
  minContrast?: number;
}

const DEFAULTS: Required<TrackerOptions> = { half: 7, radius: 12, minScore: 0.9, minContrast: 6 };

export function toGray(frame: FramePixels): GrayFrame {
  const { width, height, data } = frame;
  const out = new Float32Array(width * height);
  for (let i = 0; i < out.length; i++) out[i] = 0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!;
  return { width, height, data: out };
}

/** Zero-mean, unit-norm patch centred on (cx, cy), or null near the border or on a flat surface. */
export function extractPatch(img: GrayFrame, cx: number, cy: number, half: number, minContrast: number): Float32Array | null {
  const x0 = Math.round(cx) - half, y0 = Math.round(cy) - half, n = 2 * half + 1;
  if (x0 < 0 || y0 < 0 || x0 + n > img.width || y0 + n > img.height) return null;
  const p = new Float32Array(n * n);
  let mean = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) mean += p[y * n + x] = img.data[(y0 + y) * img.width + x0 + x]!;
  mean /= n * n;
  let ss = 0;
  for (let i = 0; i < p.length; i++) { p[i]! -= mean; ss += p[i]! * p[i]!; }
  if (Math.sqrt(ss / p.length) < minContrast) return null;
  const norm = Math.sqrt(ss);
  for (let i = 0; i < p.length; i++) p[i]! /= norm;
  return p;
}

function nccAt(img: GrayFrame, template: Float32Array, half: number, cx: number, cy: number): number {
  const n = 2 * half + 1, x0 = cx - half, y0 = cy - half;
  if (x0 < 0 || y0 < 0 || x0 + n > img.width || y0 + n > img.height) return -1;
  let sum = 0, sum2 = 0, dot = 0;
  for (let y = 0; y < n; y++) {
    const row = (y0 + y) * img.width + x0;
    for (let x = 0; x < n; x++) {
      const v = img.data[row + x]!;
      sum += v; sum2 += v * v; dot += v * template[y * n + x]!;
    }
  }
  const count = n * n;
  const variance = sum2 - (sum * sum) / count;
  if (variance <= 1e-6) return -1;
  // The template has zero mean, so the image mean drops out of the dot product.
  return dot / Math.sqrt(variance);
}

/** Best match of `template` within `radius` pixels of (px, py), with sub-pixel refinement. */
export function searchPatch(img: GrayFrame, template: Float32Array, half: number, px: number, py: number, radius: number): { x: number; y: number; score: number } | null {
  const cx = Math.round(px), cy = Math.round(py);
  let best = { x: 0, y: 0, score: -2 };
  const scores = new Map<number, number>();
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const s = nccAt(img, template, half, cx + dx, cy + dy);
      scores.set((cy + dy) * img.width + cx + dx, s);
      if (s > best.score) best = { x: cx + dx, y: cy + dy, score: s };
    }
  }
  if (best.score <= -1) return null;
  const at = (x: number, y: number) => scores.get(y * img.width + x) ?? nccAt(img, template, half, x, y);
  const refine = (a: number, b: number, c: number) => {
    const d = a - 2 * b + c;
    return d < 0 ? Math.max(-0.5, Math.min(0.5, (a - c) / (2 * d))) : 0;
  };
  const sx = refine(at(best.x - 1, best.y), best.score, at(best.x + 1, best.y));
  const sy = refine(at(best.x, best.y - 1), best.score, at(best.x, best.y + 1));
  return { x: best.x + sx, y: best.y + sy, score: best.score };
}

interface Entry {
  template: Float32Array;
  /** Where the patch was last seen, in normalized video coordinates. */
  last: { u: number; v: number };
}

/** Patches per creature id, in normalized video coordinates so the tracking frame size can change. */
export class AnchorTracker {
  private entries = new Map<number, Entry>();
  private opts: Required<TrackerOptions>;

  constructor(opts: TrackerOptions = {}) {
    this.opts = { ...DEFAULTS, ...opts };
  }

  has(id: number): boolean {
    return this.entries.has(id);
  }

  /** Takes the patch around (u, v). False when the surface there has too little texture to track. */
  capture(id: number, img: GrayFrame, u: number, v: number): boolean {
    const t = extractPatch(img, u * img.width, v * img.height, this.opts.half, this.opts.minContrast);
    if (!t) return false;
    this.entries.set(id, { template: t, last: { u, v } });
    return true;
  }

  /** Searches for the patch near the predicted position; null when it is not found with confidence. */
  track(id: number, img: GrayFrame, predicted: { u: number; v: number }): Match | null {
    const e = this.entries.get(id);
    if (!e) return null;
    const m = searchPatch(img, e.template, this.opts.half, predicted.u * img.width, predicted.v * img.height, this.opts.radius);
    if (!m || m.score < this.opts.minScore) return null;
    const match = { u: m.x / img.width, v: m.y / img.height, score: m.score };
    e.last = { u: match.u, v: match.v };
    // A very good match refreshes the patch, so it keeps up as the viewpoint changes.
    if (m.score > 0.95) {
      const t = extractPatch(img, m.x, m.y, this.opts.half, this.opts.minContrast);
      if (t) e.template = t;
    }
    return match;
  }

  remove(id: number) {
    this.entries.delete(id);
  }

  clear() {
    this.entries.clear();
  }
}

/** Limits a correction: moves `from` towards `to` by `gain`, at most `maxStep` in each coordinate. */
export function smoothStep(from: number, to: number, gain: number, maxStep: number): number {
  const d = (to - from) * gain;
  return from + Math.max(-maxStep, Math.min(maxStep, d));
}
