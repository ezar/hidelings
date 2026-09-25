import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { cameraTans, fromEuler, project, ray, toDevice, toWorld } from '../perception/motion/rotation';
import { configureCamera, poseQuaternion } from './occlusionRenderer';
import { coverMapping, videoToScreen } from './viewMapping';

// The Three.js camera must put an anchored point on the same screen pixel as rotation.ts + viewMapping.ts,
// or occlusion would sample the depth map in the wrong place.
describe('Three.js camera agrees with the anchoring maths', () => {
  const view = coverMapping(390, 844, 720, 1280);
  const tans = cameraTans(64, 720, 1280);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 50);
  configureCamera(camera, view, tans);

  it.each([
    [fromEuler(0, 90, 0), { u: 0.5, v: 0.5 }],
    [fromEuler(20, 80, 5), { u: 0.3, v: 0.7 }],
    [fromEuler(-40, 100, -10), { u: 0.62, v: 0.2 }],
  ])('pose %#', (pose, point) => {
    const dir = toWorld(pose, ray(point, tans));
    const expected = videoToScreen(view, project(toDevice(pose, dir), tans)!);

    poseQuaternion(pose, camera.quaternion);
    camera.updateMatrixWorld();
    const ndc = new THREE.Vector3(dir[0] * 3, dir[1] * 3, dir[2] * 3).project(camera);
    const x = ((ndc.x + 1) / 2) * view.width;
    const y = ((1 - ndc.y) / 2) * view.height;
    expect(x).toBeCloseTo(expected.x, 3);
    expect(y).toBeCloseTo(expected.y, 3);
  });
});
