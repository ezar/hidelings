import { describe, expect, it } from 'vitest';
import { fromEuler } from './rotation';
import { SpeedWatch, rotationBetween, sessionOver } from './speed';

describe('rotationBetween', () => {
  it('measures turns in degrees', () => {
    expect(rotationBetween(fromEuler(0, 90, 0), fromEuler(30, 90, 0))).toBeCloseTo(30);
    expect(rotationBetween(fromEuler(10, 80, 5), fromEuler(10, 80, 5))).toBeCloseTo(0);
  });
});

describe('SpeedWatch', () => {
  const run = (w: SpeedWatch, degPerS: number, fromMs: number, toMs: number, startYaw = 0) => {
    let yaw = startYaw;
    for (let t = fromMs; t <= toMs; t += 16) {
      yaw += (degPerS * 16) / 1000;
      w.update(fromEuler(yaw, 90, 0), t);
    }
    return yaw;
  };

  it('stays calm when turning slowly', () => {
    const w = new SpeedWatch();
    run(w, 60, 0, 2000);
    expect(w.tooFast).toBe(false);
  });

  it('warns after a sustained fast swing and clears after calm', () => {
    const w = new SpeedWatch();
    const yaw = run(w, 300, 0, 600);
    expect(w.tooFast).toBe(true);
    run(w, 0, 616, 1500, yaw);
    expect(w.tooFast).toBe(true); // still within the calm-down time
    run(w, 0, 1516, 3000, yaw);
    expect(w.tooFast).toBe(false);
  });

  it('ignores a single jolt', () => {
    const w = new SpeedWatch();
    w.update(fromEuler(0, 90, 0), 0);
    w.update(fromEuler(20, 90, 0), 16);
    w.update(fromEuler(20, 90, 0), 32);
    expect(w.tooFast).toBe(false);
  });
});

describe('sessionOver', () => {
  it('compares play time with the limit; 0 means no limit', () => {
    expect(sessionOver(0, 19 * 60_000, 20)).toBe(false);
    expect(sessionOver(0, 20 * 60_000, 20)).toBe(true);
    expect(sessionOver(0, 999 * 60_000, 0)).toBe(false);
  });
});
