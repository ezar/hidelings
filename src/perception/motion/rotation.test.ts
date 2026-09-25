import { describe, expect, it } from 'vitest';
import {
  IDENTITY,
  angleBetween,
  cameraTans,
  fromEuler,
  multiply,
  project,
  ray,
  toDevice,
  toWorld,
  type Mat3,
  type Vec3,
} from './rotation';

const close = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);
const closeVec = (a: Vec3, b: Vec3, eps = 1e-9) => a.forEach((x, i) => close(x, b[i]!, eps));

// Phone held upright in portrait, rear camera facing the horizon (the PoC's usual pose).
const upright = (alpha = 0) => fromEuler(alpha, 90, 0);
const tans = cameraTans(64, 720, 1280);

describe('fromEuler', () => {
  it('is the identity for zero angles', () => {
    fromEuler(0, 0, 0).forEach((x, i) => close(x, IDENTITY[i]!));
  });

  it('is orthonormal', () => {
    const m = fromEuler(37, 61, -24);
    const mt: Mat3 = [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
    multiply(m, mt).forEach((x, i) => close(x, IDENTITY[i]!));
  });
});

describe('toWorld and toDevice', () => {
  it('are inverses', () => {
    const m = fromEuler(120, 45, 10);
    const d: Vec3 = [0.3, -0.2, -1];
    closeVec(toDevice(m, toWorld(m, d)), d);
  });

  it('points the upright rear camera at the horizon', () => {
    const forward = toWorld(upright(), [0, 0, -1]);
    close(forward[2], 0);
  });
});

describe('ray and project', () => {
  it('round-trip a video point', () => {
    const p = { u: 0.23, v: 0.71 };
    const q = project(ray(p, tans), tans)!;
    close(q.u, p.u);
    close(q.v, p.v);
  });

  it('put the optical axis at the centre', () => {
    const q = project([0, 0, -1], tans)!;
    close(q.u, 0.5);
    close(q.v, 0.5);
  });

  it('return null behind the camera', () => {
    expect(project([0, 0, 1], tans)).toBeNull();
  });
});

describe('cameraTans', () => {
  it('applies the FOV to the long side', () => {
    const t = cameraTans(64, 720, 1280);
    close(t.ty, Math.tan((32 * Math.PI) / 180));
    close(t.tx, (t.ty * 720) / 1280);
  });
});

// The PoC's known cases (spec 8.1): content anchored in the world moves the opposite way to the phone.
describe('anchored content', () => {
  const anchorAtCentre = (m: Mat3) => toWorld(m, ray({ u: 0.5, v: 0.5 }, tans));

  it('moves right on screen when the phone turns left', () => {
    const anchor = anchorAtCentre(upright(0));
    // alpha grows counter-clockwise seen from above, so +alpha turns the phone to the left.
    const p = project(toDevice(upright(10), anchor), tans)!;
    expect(p.u).toBeGreaterThan(0.5);
    close(p.v, 0.5, 1e-6);
  });

  it('moves down on screen when the phone tilts up', () => {
    const anchor = anchorAtCentre(upright(0));
    const p = project(toDevice(fromEuler(0, 100, 0), anchor), tans)!;
    expect(p.v).toBeGreaterThan(0.5);
    close(p.u, 0.5, 1e-6);
  });

  it('stays put when the phone does not move', () => {
    const m = fromEuler(33, 80, 5);
    const anchor = toWorld(m, ray({ u: 0.3, v: 0.6 }, tans));
    const p = project(toDevice(m, anchor), tans)!;
    close(p.u, 0.3);
    close(p.v, 0.6);
  });
});

describe('angleBetween', () => {
  it('measures degrees', () => {
    close(angleBetween([1, 0, 0], [0, 1, 0]), 90);
    close(angleBetween([1, 0, 0], [2, 0, 0]), 0);
    close(angleBetween(toWorld(upright(0), [0, 0, -1]), toWorld(upright(5), [0, 0, -1])), 5, 1e-6);
  });
});
