// Pompón in 3D (docs/design creature sheets): fuzzy round body, ink outline, big eyes set high, blush.
// Built in code so there are no assets to license (spec 6.3).
import * as THREE from 'three';
import { createCreatureMaterial, type CreatureUniforms } from './occlusionMaterial';

const INK = 0x2b2140;
const BODY = 0x7be0ad;

/** A sphere with soft tufts, like the scalloped outline of the 2D design. */
function fuzzyBody(): THREE.BufferGeometry {
  // Indexed, so computeVertexNormals averages across faces and the body shades smoothly.
  const geo = new THREE.SphereGeometry(1, 64, 40);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const lon = Math.atan2(v.x, v.z);
    const lat = Math.asin(v.y);
    const tuft = 0.035 * Math.sin(11 * lon) * Math.cos(9 * lat) + 0.02 * Math.sin(17 * lat + 3 * lon);
    v.multiplyScalar(1 + tuft);
    v.y *= 0.94;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export interface CreatureRig {
  group: THREE.Group;
  /** Parts drawn only in the colour pass (the ink outline). */
  outline: THREE.Object3D[];
  eyes: THREE.Object3D[];
  seed: number;
}

export function createPompon(uniforms: CreatureUniforms): CreatureRig {
  const group = new THREE.Group();
  const bodyGeo = fuzzyBody();

  const body = new THREE.Mesh(bodyGeo, createCreatureMaterial(uniforms, { color: BODY, shade: 0.28, rim: 0.35 }));
  body.renderOrder = 1;
  const outline = new THREE.Mesh(bodyGeo, createCreatureMaterial(uniforms, { color: INK, shade: 0, side: THREE.BackSide }));
  outline.scale.setScalar(1.06);
  outline.renderOrder = 0;
  group.add(outline, body);

  const white = createCreatureMaterial(uniforms, { color: 0xffffff, shade: 0.12 });
  const ink = createCreatureMaterial(uniforms, { color: INK, shade: 0 });
  const blush = createCreatureMaterial(uniforms, { color: 0xff8fb1, shade: 0 });
  const sphere = new THREE.SphereGeometry(1, 24, 16);

  const eyes: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * 0.36, 0.2, 0.84);
    const ball = new THREE.Mesh(sphere, white);
    ball.scale.set(0.25, 0.29, 0.12);
    const ring = new THREE.Mesh(sphere, ink);
    ring.scale.set(0.28, 0.32, 0.1);
    ring.position.z = -0.02;
    const pupil = new THREE.Mesh(sphere, ink);
    pupil.scale.set(0.13, 0.15, 0.06);
    pupil.position.set(0.02, 0, 0.1);
    const glint = new THREE.Mesh(sphere, white);
    glint.scale.setScalar(0.045);
    glint.position.set(0.07, 0.07, 0.15);
    eye.add(ring, ball, pupil, glint);
    for (const m of eye.children) m.renderOrder = 2;
    eyes.push(eye);
    group.add(eye);

    const cheek = new THREE.Mesh(sphere, blush);
    cheek.scale.set(0.12, 0.07, 0.02);
    cheek.position.set(side * 0.55, -0.1, 0.8);
    cheek.rotation.y = side * 0.5;
    cheek.renderOrder = 2;
    group.add(cheek);
  }

  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.022, 8, 16, Math.PI), ink);
  mouth.position.set(0, -0.12, 0.95);
  mouth.rotation.z = Math.PI;
  mouth.renderOrder = 2;
  group.add(mouth);

  return { group, outline: [outline], eyes, seed: Math.random() * 100 };
}

/**
 * Idle animation (spec 6.2): breathing, blinking and a slow peek cycle that shifts the creature a little
 * around its anchor, so what peeks out changes over time. `rig.group` sits inside the anchor object.
 */
export function animateCreature(rig: CreatureRig, timeMs: number) {
  const t = timeMs / 1000 + rig.seed;
  rig.group.scale.set(1, 1 + 0.03 * Math.sin(t * 2.1), 1);
  rig.group.position.set(0.14 * Math.sin(t * 0.35), 0.1 * Math.sin(t * 0.5), 0);
  const blinking = t % 4.3 < 0.12;
  for (const eye of rig.eyes) eye.scale.y = blinking ? 0.12 : 1;
}
