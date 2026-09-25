import { describe, expect, it } from 'vitest';
import { RangeSmoother, halfToFloat, normalizeDepth, normalizeWithRange, percentileRange, toFloat32 } from './normalize';

describe('normalizeDepth', () => {
  it('maps the range to 0..1', () => {
    const raw = Array.from({ length: 1000 }, (_, i) => i);
    const out = normalizeDepth(raw);
    expect(out[0]).toBe(0);
    expect(out[999]).toBe(1);
    expect(out[500]).toBeGreaterThan(0.45);
    expect(out[500]).toBeLessThan(0.55);
  });

  it('ignores outliers beyond the percentiles', () => {
    const raw = Array.from({ length: 1000 }, () => 5);
    for (let i = 0; i < 500; i++) raw[i] = 1;
    raw[999] = 1e6;
    const out = normalizeDepth(raw);
    expect(out[0]).toBe(0);
    expect(out[700]).toBe(1);
  });

  it('keeps values in range and survives NaN and a flat map', () => {
    expect([...normalizeDepth([NaN, 1, 2, 3])].every(v => v >= 0 && v <= 1)).toBe(true);
    expect([...normalizeDepth([4, 4, 4, 4])].every(v => v === 0)).toBe(true);
    expect(normalizeDepth([]).length).toBe(0);
  });
});

describe('half floats', () => {
  it('decodes known values', () => {
    expect(halfToFloat(0x3c00)).toBe(1);
    expect(halfToFloat(0xc000)).toBe(-2);
    expect(halfToFloat(0x3800)).toBe(0.5);
    expect(halfToFloat(0x7c00)).toBe(Infinity);
    expect(Number.isNaN(halfToFloat(0x7e00))).toBe(true);
  });

  it('converts a Uint16Array of half bits', () => {
    expect([...toFloat32(new Uint16Array([0x3c00, 0x4000]))]).toEqual([1, 2]);
  });

  it('passes a Float32Array through untouched', () => {
    const a = new Float32Array([1, 2]);
    expect(toFloat32(a)).toBe(a);
  });
});

describe('RangeSmoother', () => {
  it('takes the first range as is, then moves a fraction towards each new one', () => {
    const s = new RangeSmoother(0.25);
    expect(s.update({ lo: 0, hi: 10 })).toEqual({ lo: 0, hi: 10 });
    expect(s.update({ lo: 4, hi: 30 })).toEqual({ lo: 1, hi: 15 });
  });

  it('keeps a map stable when a bright object briefly widens the range', () => {
    const s = new RangeSmoother(0.25);
    const base = Array.from({ length: 100 }, (_, i) => i);
    const a = normalizeWithRange(base, s.update(percentileRange(base)!));
    const spiked = [...base.slice(0, 90), ...Array.from({ length: 10 }, () => 1000)];
    const b = normalizeWithRange(spiked, s.update(percentileRange(spiked)!));
    const perFrame = normalizeDepth(spiked);
    // Smoothed: the unchanged middle of the map moves much less than with per-frame normalization.
    expect(Math.abs(b[50]! - a[50]!)).toBeLessThan(Math.abs(perFrame[50]! - a[50]!));
  });
});
