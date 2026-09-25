import { describe, expect, it } from 'vitest';
import { coverMapping, screenToVideo, videoToScreen, visibleVideoRect } from './viewMapping';

describe('coverMapping', () => {
  it('crops the sides of a 720×1280 video on a narrower 390×844 screen', () => {
    const m = coverMapping(390, 844, 720, 1280);
    expect(m.videoHeight).toBeCloseTo(844);
    expect(m.videoWidth).toBeCloseTo(474.75);
    expect(m.offsetY).toBeCloseTo(0);
    expect(m.offsetX).toBeCloseTo(-42.375);
  });

  it('crops top and bottom of a landscape video', () => {
    const m = coverMapping(390, 844, 1280, 720);
    expect(m.videoHeight).toBeCloseTo(844);
    expect(m.videoWidth).toBeGreaterThan(390);
  });

  it('round-trips points', () => {
    const m = coverMapping(390, 844, 720, 1280);
    const p = { u: 0.17, v: 0.83 };
    const s = videoToScreen(m, p);
    const q = screenToVideo(m, s.x, s.y);
    expect(q.u).toBeCloseTo(p.u);
    expect(q.v).toBeCloseTo(p.v);
  });

  it('maps the screen centre to the video centre', () => {
    const m = coverMapping(390, 844, 720, 1280);
    const q = screenToVideo(m, 195, 422);
    expect(q.u).toBeCloseTo(0.5);
    expect(q.v).toBeCloseTo(0.5);
  });

  it('reports the visible video rectangle', () => {
    const r = visibleVideoRect(coverMapping(390, 844, 720, 1280));
    expect(r.u0).toBeGreaterThan(0);
    expect(r.u1).toBeLessThan(1);
    expect(r.v0).toBeCloseTo(0);
    expect(r.v1).toBeCloseTo(1);
  });

  it('does not divide by zero before the video has a size', () => {
    const m = coverMapping(390, 844, 0, 0);
    expect(Number.isFinite(m.videoWidth)).toBe(true);
  });
});
