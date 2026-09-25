// Turns raw relative inverse depth into 0 (far) .. 1 (near) (spec 7.1).

export interface DepthRange {
  lo: number;
  hi: number;
}

/** Low and high percentiles of a raw map, sampled for speed. Null when the map has no finite values. */
export function percentileRange(raw: ArrayLike<number>, lowPct = 0.02, highPct = 0.98, maxSamples = 3000): DepthRange | null {
  const n = raw.length;
  const stride = Math.max(1, Math.floor(n / maxSamples));
  const sample: number[] = [];
  for (let i = 0; i < n; i += stride) {
    const v = raw[i]!;
    if (Number.isFinite(v)) sample.push(v);
  }
  if (!sample.length) return null;
  sample.sort((a, b) => a - b);
  return {
    lo: sample[Math.floor((sample.length - 1) * lowPct)]!,
    hi: sample[Math.floor((sample.length - 1) * highPct)]!,
  };
}

export function normalizeWithRange(raw: ArrayLike<number>, range: DepthRange): Float32Array {
  const n = raw.length;
  const out = new Float32Array(n);
  const span = range.hi - range.lo || 1;
  for (let i = 0; i < n; i++) {
    const v = (raw[i]! - range.lo) / span;
    out[i] = v < 0 || !Number.isFinite(v) ? 0 : v > 1 ? 1 : v;
  }
  return out;
}

/** Robust per-frame normalization between the given low and high percentiles. */
export function normalizeDepth(raw: ArrayLike<number>, lowPct = 0.02, highPct = 0.98, maxSamples = 3000): Float32Array {
  const range = percentileRange(raw, lowPct, highPct, maxSamples);
  return range ? normalizeWithRange(raw, range) : new Float32Array(raw.length);
}

/**
 * Smooths the normalization range over time with an exponential moving average (spec 7.1), so an object
 * entering the frame does not rescale the whole map from one frame to the next.
 */
export class RangeSmoother {
  private range: DepthRange | null = null;

  constructor(private readonly alpha = 0.25) {}

  update(next: DepthRange): DepthRange {
    const r = this.range;
    this.range = r ? { lo: r.lo + (next.lo - r.lo) * this.alpha, hi: r.hi + (next.hi - r.hi) * this.alpha } : { ...next };
    return this.range;
  }

  reset() {
    this.range = null;
  }
}

/** IEEE 754 half-precision bits to a number. */
export function halfToFloat(h: number): number {
  const sign = h & 0x8000 ? -1 : 1;
  const exp = (h >> 10) & 0x1f;
  const frac = h & 0x3ff;
  if (exp === 0) return sign * 2 ** -14 * (frac / 1024);
  if (exp === 31) return frac ? NaN : sign * Infinity;
  return sign * 2 ** (exp - 15) * (1 + frac / 1024);
}

/** Model output (float32, float16 or half bits in a Uint16Array) as a Float32Array. */
export function toFloat32(data: ArrayLike<number> | ArrayBufferView): Float32Array {
  if (data instanceof Float32Array) return data;
  if (typeof Float16Array !== 'undefined' && data instanceof Float16Array) return Float32Array.from(data);
  if (data instanceof Uint16Array) {
    const out = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) out[i] = halfToFloat(data[i]!);
    return out;
  }
  return Float32Array.from(data as ArrayLike<number>);
}
