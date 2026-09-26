import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SAMPLE_OFFSETS, metersToDepth, raySphere, visibleFraction } from './xrMath';

describe('metersToDepth', () => {
  it('matches what the GPU writes for a point at that distance', () => {
    const cam = new THREE.PerspectiveCamera(60, 0.5, 0.1, 20);
    cam.updateProjectionMatrix();
    const p = cam.projectionMatrix.elements;
    expect(metersToDepth(0.1, p)).toBeCloseTo(0, 5);
    expect(metersToDepth(20, p)).toBeCloseTo(1, 5);
    const v = new THREE.Vector3(0, 0, -2).applyMatrix4(cam.projectionMatrix);
    expect(metersToDepth(2, p)).toBeCloseTo(0.5 * v.z + 0.5, 6);
    expect(metersToDepth(0, p)).toBe(1);
  });
});

describe('visibleFraction', () => {
  it('counts the samples the room does not cover', () => {
    const hidden = { expected: 2, real: 1.2 };
    const shown = { expected: 2, real: 3 };
    expect(visibleFraction([hidden, hidden, shown, shown])).toBe(0.5);
    expect(visibleFraction([{ expected: 2, real: 1.98 }])).toBe(1);
    expect(visibleFraction([{ expected: 2, real: null }, { expected: 2, real: 0 }])).toBe(1);
    expect(visibleFraction([])).toBe(0);
    expect(SAMPLE_OFFSETS).toHaveLength(13);
  });
});

describe('raySphere', () => {
  it('picks the nearest sphere on the ray', () => {
    const spheres = [{ c: [0, 0, -3], r: 0.2 }, { c: [0, 0, -1.5], r: 0.2 }, { c: [1, 0, -1], r: 0.2 }];
    expect(raySphere([0, 0, 0], [0, 0, -1], spheres)).toBe(1);
    expect(raySphere([0, 0, 0], [0, 1, 0], spheres)).toBe(-1);
  });
});
