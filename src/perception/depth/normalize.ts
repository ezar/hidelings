// Turns raw relative inverse depth into 0 (far) .. 1 (near), per frame (spec 7.1).

/** Robust per-frame normalization between the given low and high percentiles. */
export function normalizeDepth(raw: ArrayLike<number>, lowPct = 0.02, highPct = 0.98, maxSamples = 3000): Float32Array {
  const n = raw.length;
  const out = new Float32Array(n);
  if (!n) return out;
  const stride = Math.max(1, Math.floor(n / maxSamples));
  const sample: number[] = [];
  for (let i = 0; i < n; i += stride) {
    const v = raw[i]!;
    if (Number.isFinite(v)) sample.push(v);
  }
  if (!sample.length) return out;
  sample.sort((a, b) => a - b);
  const lo = sample[Math.floor((sample.length - 1) * lowPct)]!;
  const hi = sample[Math.floor((sample.length - 1) * highPct)]!;
  const span = hi - lo || 1;
  for (let i = 0; i < n; i++) {
    const v = (raw[i]! - lo) / span;
    out[i] = v < 0 || !Number.isFinite(v) ? 0 : v > 1 ? 1 : v;
  }
  return out;
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
