// The creatures in 3D (docs/design creature sheets), built in code so there are no assets to license
// (spec 6.3): soft shapes, ink outline, rim light, big eyes set high so a third of a creature reads.
import * as THREE from 'three';
import { SPECIES, type SpeciesId } from '../engine/species';
import { createCreatureMaterial, type CreatureUniforms } from './occlusionMaterial';

const INK = 0x2b2140;
const HONEY = 0xffc53d;

export type Mood = 'tuck' | 'idle' | 'near' | 'caught' | 'retreat';

export interface CreatureRig {
  /** Everything that moves with the creature, inside the anchor. */
  group: THREE.Group;
  /** Parts drawn only in the colour pass (ink outlines, Brillo's glow), not in the visibility pass. */
  outline: THREE.Object3D[];
  eyes: THREE.Object3D[];
  /** The "!" shown when nearly found. */
  alert: THREE.Object3D;
  /** Dormilón's floating Zzz. */
  zzz: THREE.Object3D[];
  /** Asleep: eyes closed while idle (Dormilón). */
  sleeper: boolean;
  seed: number;
  mood: Mood;
  moodAt: number;
}

/** Deforms a sphere-like geometry into soft tufts, like the scalloped outlines of the 2D designs. */
function tufted(geo: THREE.BufferGeometry, amount: number): THREE.BufferGeometry {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.copy(v).normalize();
    const lon = Math.atan2(n.x, n.z);
    const lat = Math.asin(Math.max(-1, Math.min(1, n.y)));
    const tuft = amount * (Math.sin(11 * lon) * Math.cos(9 * lat) + 0.6 * Math.sin(17 * lat + 3 * lon));
    v.addScaledVector(n, tuft);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

interface Parts {
  uniforms: CreatureUniforms;
  group: THREE.Group;
  outline: THREE.Object3D[];
  eyes: THREE.Object3D[];
  zzz: THREE.Object3D[];
  sleeper: boolean;
}

function addBody(p: Parts, geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, outline = 1.06) {
  const body = new THREE.Mesh(geo, createCreatureMaterial(p.uniforms, { color, shade: 0.28, rim: 0.35 }));
  body.renderOrder = 1;
  const shell = new THREE.Mesh(geo, createCreatureMaterial(p.uniforms, { color: INK, shade: 0, side: THREE.BackSide }));
  shell.scale.setScalar(outline);
  p.group.add(shell, body);
  p.outline.push(shell);
  return body;
}

/** Shared by every creature; never disposed. Other geometries belong to one creature. */
export const SHARED_GEOMETRY = new THREE.SphereGeometry(1, 24, 16);
const SPHERE = SHARED_GEOMETRY;

function addEyes(p: Parts, x: number, y: number, z: number, size: number, look: [number, number] = [0.02, 0]) {
  const white = createCreatureMaterial(p.uniforms, { color: 0xffffff, shade: 0.12 });
  const ink = createCreatureMaterial(p.uniforms, { color: INK, shade: 0 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * x, y, z);
    eye.scale.setScalar(size);
    const ring = new THREE.Mesh(SPHERE, ink);
    ring.scale.set(0.28, 0.32, 0.1);
    ring.position.z = -0.02;
    const ball = new THREE.Mesh(SPHERE, white);
    ball.scale.set(0.25, 0.29, 0.12);
    const pupil = new THREE.Mesh(SPHERE, ink);
    pupil.scale.set(0.13, 0.15, 0.06);
    pupil.position.set(look[0], look[1], 0.1);
    const glint = new THREE.Mesh(SPHERE, white);
    glint.scale.setScalar(0.045);
    glint.position.set(look[0] + 0.05, look[1] + 0.07, 0.15);
    eye.add(ring, ball, pupil, glint);
    for (const m of eye.children) m.renderOrder = 2;
    p.eyes.push(eye);
    p.group.add(eye);
  }
}

function addCheeks(p: Parts, x: number, y: number, z: number, size = 1) {
  const blush = createCreatureMaterial(p.uniforms, { color: 0xff8fb1, shade: 0 });
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(SPHERE, blush);
    cheek.scale.set(0.12 * size, 0.07 * size, 0.02);
    cheek.position.set(side * x, y, z);
    cheek.rotation.y = side * 0.5;
    cheek.renderOrder = 2;
    p.group.add(cheek);
  }
}

function addMouth(p: Parts, y: number, z: number, size = 1) {
  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.07 * size, 0.022 * size, 8, 16, Math.PI),
    createCreatureMaterial(p.uniforms, { color: INK, shade: 0 }),
  );
  mouth.position.set(0, y, z);
  mouth.rotation.z = Math.PI;
  mouth.renderOrder = 2;
  p.group.add(mouth);
}

function buildPompon(p: Parts) {
  const geo = tufted(new THREE.SphereGeometry(1, 64, 40), 0.03);
  geo.scale(1, 0.94, 1);
  addBody(p, geo, SPECIES.pompon.color);
  addEyes(p, 0.36, 0.2, 0.84, 1);
  addCheeks(p, 0.55, -0.1, 0.8);
  addMouth(p, -0.12, 0.95);
}

function buildFideo(p: Parts) {
  const geo = new THREE.CapsuleGeometry(0.42, 1.5, 12, 32);
  addBody(p, geo, SPECIES.fideo.color, 1.07);
  const curl = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.045, 8, 20, Math.PI * 1.5),
    createCreatureMaterial(p.uniforms, { color: INK, shade: 0 }),
  );
  curl.position.set(0.05, 1.28, 0);
  curl.rotation.z = 0.6;
  p.group.add(curl);
  addEyes(p, 0.16, 0.62, 0.36, 0.72, [-0.03, 0.01]);
  addCheeks(p, 0.3, 0.42, 0.33, 0.7);
  addMouth(p, 0.38, 0.41, 0.7);
}

function buildTimido(p: Parts) {
  const geo = tufted(new THREE.SphereGeometry(1, 48, 32), 0.015);
  geo.scale(1, 0.85, 0.9);
  addBody(p, geo, SPECIES.timido.color);
  const leaf = new THREE.SphereGeometry(1, 16, 12);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(leaf, createCreatureMaterial(p.uniforms, { color: SPECIES.timido.color, shade: 0.25, rim: 0.3 }));
    ear.scale.set(0.16, 0.42, 0.08);
    ear.position.set(side * 0.42, 0.9, 0);
    ear.rotation.z = -side * 0.45;
    const earShell = new THREE.Mesh(leaf, createCreatureMaterial(p.uniforms, { color: INK, shade: 0, side: THREE.BackSide }));
    earShell.scale.set(0.19, 0.46, 0.1);
    earShell.position.copy(ear.position);
    earShell.rotation.copy(ear.rotation);
    p.group.add(earShell, ear);
    p.outline.push(earShell);
  }
  // Tímido looks down, shyly.
  addEyes(p, 0.3, 0.05, 0.8, 0.85, [-0.01, -0.06]);
  addCheeks(p, 0.5, -0.18, 0.72);
  addMouth(p, -0.3, 0.84, 0.8);
}

function buildCurioso(p: Parts) {
  const geo = new THREE.SphereGeometry(1, 48, 32);
  // A pear: wider at the bottom.
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const k = 1 + 0.18 * (-y);
    pos.setXYZ(i, pos.getX(i) * k, y * 1.05, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  addBody(p, geo, SPECIES.curioso.color);
  const ink = createCreatureMaterial(p.uniforms, { color: INK, shade: 0 });
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8), ink);
  stalk.position.set(0.12, 1.25, 0);
  stalk.rotation.z = -0.35;
  const bulb = new THREE.Mesh(SPHERE, createCreatureMaterial(p.uniforms, { color: HONEY, shade: 0.2, rim: 0.3 }));
  bulb.scale.setScalar(0.14);
  bulb.position.set(0.23, 1.52, 0);
  p.group.add(stalk, bulb);
  // One eye a little bigger than the other: curious.
  addEyes(p, 0.36, 0.2, 0.82, 1.1);
  p.eyes[1]!.scale.multiplyScalar(0.82);
  addCheeks(p, 0.55, -0.15, 0.8);
  addMouth(p, -0.25, 0.9);
}

function buildDormilon(p: Parts) {
  const geo = new THREE.SphereGeometry(1, 48, 32);
  // A mochi: flat bottom, soft dome.
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setXYZ(i, pos.getX(i) * 1.25, y < -0.3 ? -0.3 + (y + 0.3) * 0.25 : y * 0.8, pos.getZ(i) * 1.05);
  }
  geo.computeVertexNormals();
  addBody(p, geo, SPECIES.dormilon.color);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 20), createCreatureMaterial(p.uniforms, { color: 0x5b4bdb, shade: 0.3 }));
  cap.position.set(0.25, 0.95, 0);
  cap.rotation.z = -0.5;
  const pompom = new THREE.Mesh(SPHERE, createCreatureMaterial(p.uniforms, { color: 0xffffff, shade: 0.2 }));
  pompom.scale.setScalar(0.13);
  pompom.position.set(0.62, 1.3, 0);
  p.group.add(cap, pompom);
  addEyes(p, 0.42, 0.05, 0.86, 0.9);
  addCheeks(p, 0.66, -0.12, 0.8);
  addMouth(p, -0.16, 0.95, 0.7);
  // Three "z" letters built from bars, floating up and away while asleep.
  const ink = createCreatureMaterial(p.uniforms, { color: INK, shade: 0 });
  const bar = new THREE.BoxGeometry(0.28, 0.05, 0.02);
  for (let i = 0; i < 3; i++) {
    const z = new THREE.Group();
    const top = new THREE.Mesh(bar, ink);
    top.position.y = 0.12;
    const bottom = new THREE.Mesh(bar, ink);
    bottom.position.y = -0.12;
    const diag = new THREE.Mesh(bar, ink);
    diag.rotation.z = Math.atan2(0.24, -0.28);
    diag.scale.x = 1.3;
    z.add(top, bottom, diag);
    z.userData.phase = i / 3;
    for (const m of z.children) m.renderOrder = 3;
    p.zzz.push(z);
    p.group.add(z);
  }
  p.sleeper = true;
}

/** Brillo's body: a soft five-pointed star. */
function starBody(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 64, 32);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = Math.atan2(v.y, v.x);
    const lobe = 1 + 0.28 * Math.max(0, Math.cos(5 * (a - Math.PI / 2)));
    pos.setXYZ(i, v.x * lobe, v.y * lobe, v.z * 0.8);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildBrillo(p: Parts) {
  const halo = new THREE.Mesh(SPHERE, createCreatureMaterial(p.uniforms, { color: 0xfff3b0, shade: 0, alpha: 0.28, glow: true }));
  halo.scale.setScalar(1.9);
  halo.renderOrder = -1;
  p.group.add(halo);
  p.outline.push(halo); // colour pass only: the glow does not count towards visibility
  addBody(p, starBody(), SPECIES.brillo.color);
  (p.group.children.at(-1) as THREE.Mesh).material = createCreatureMaterial(p.uniforms, { color: SPECIES.brillo.color, shade: 0.1, rim: 0.8 });
  addEyes(p, 0.28, 0.1, 0.78, 0.9);
  addCheeks(p, 0.48, -0.15, 0.72, 0.9);
  addMouth(p, -0.22, 0.8, 0.8);
}

function buildAlert(uniforms: CreatureUniforms): THREE.Group {
  const alert = new THREE.Group();
  const honey = createCreatureMaterial(uniforms, { color: HONEY, shade: 0 });
  const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.3, 6, 12), honey);
  bar.position.y = 0.3;
  const dot = new THREE.Mesh(SPHERE, honey);
  dot.scale.setScalar(0.1);
  alert.add(bar, dot);
  alert.position.set(0.95, 1.1, 0.2);
  alert.visible = false;
  for (const m of alert.children) m.renderOrder = 3;
  return alert;
}

const BUILDERS: Record<SpeciesId, (p: Parts) => void> = {
  pompon: buildPompon,
  fideo: buildFideo,
  timido: buildTimido,
  curioso: buildCurioso,
  dormilon: buildDormilon,
  brillo: buildBrillo,
};

export function createCreature(species: SpeciesId, uniforms: CreatureUniforms, now: number): CreatureRig {
  const parts: Parts = { uniforms, group: new THREE.Group(), outline: [], eyes: [], zzz: [], sleeper: false };
  BUILDERS[species](parts);
  const alert = buildAlert(uniforms);
  parts.group.add(alert);
  return { ...parts, alert, seed: Math.random() * 100, mood: 'tuck', moodAt: now };
}

export function setMood(rig: CreatureRig, mood: Mood, now: number) {
  if (rig.mood === mood) return;
  rig.mood = mood;
  rig.moodAt = now;
}

const ease = (t: number) => 1 - (1 - t) ** 3;

/**
 * Animation (spec 6.2 and docs/design/motion.md): tuck-in after hiding, idle breathing, blinking and a slow
 * peek cycle, the nearly-found reaction, the catch pop and Tímido's retreat. Returns the creature's
 * opacity, which the caller feeds to the shader.
 */
export function animateCreature(rig: CreatureRig, now: number, reducedMotion = false): number {
  const t = now / 1000 + rig.seed;
  const since = now - rig.moodAt;
  let sx = 1, sy = 1 + 0.03 * Math.sin(t * 2.1);
  const px = 0.14 * Math.sin(t * 0.35);
  let py = 0.1 * Math.sin(t * 0.5);
  let fade = 1;
  let eyeScale = 1;
  rig.alert.visible = false;
  rig.group.rotation.z = 0;

  switch (rig.mood) {
    case 'tuck': {
      // Pop in and wave (0-300 ms), then squash and slide behind the edge (300-900 ms).
      if (reducedMotion) { if (since > 200) rig.mood = 'idle'; break; }
      const k = Math.min(1, since / 300);
      sx = sy = 0.2 + 0.8 * ease(k);
      rig.group.rotation.z = since < 600 ? 0.2 * Math.sin((since / 300) * Math.PI * 2) : 0;
      if (since > 300) {
        const s = Math.min(1, (since - 300) / 400);
        sy *= 1 - 0.15 * Math.sin(s * Math.PI);
        py -= 0.4 * ease(s) * (1 - Math.min(1, (since - 700) / 200));
      }
      if (since > 900) rig.mood = 'idle';
      break;
    }
    case 'near': {
      // Eyes widen with overshoot and the "!" pops (about 600 ms), then back to idle.
      const k = since / 1000;
      eyeScale = reducedMotion ? 1 : 1 + 0.3 * Math.sin(Math.min(1, k * 4) * Math.PI * 0.8) * (k < 1 ? 1 : 0);
      rig.alert.visible = since < 1200;
      rig.alert.scale.setScalar(reducedMotion ? 1 : Math.min(1.1, since / 180) - Math.max(0, Math.min(0.1, (since - 200) / 200)));
      if (since > 1200) rig.mood = 'idle';
      break;
    }
    case 'caught': {
      // Squash (0-120), stretch and rise (120-260), pop and fade (260-450).
      if (reducedMotion) { fade = Math.max(0, 1 - since / 200); break; }
      if (since < 120) { sx = 1.25; sy = 0.75; }
      else if (since < 260) { sx = 0.85; sy = 1.2; py += 0.2 * ((since - 120) / 140); }
      else { const k = Math.min(1, (since - 260) / 190); sx = sy = 1 + 0.4 * k; py += 0.2; fade = 1 - k; }
      break;
    }
    case 'retreat': {
      // Tímido pulls back down behind its edge.
      py -= 0.55 * ease(Math.min(1, since / 300));
      break;
    }
    case 'idle':
      break;
  }

  rig.group.scale.set(sx, sy, 1);
  rig.group.position.set(px, py, 0);
  const asleep = rig.sleeper && (rig.mood === 'idle' || rig.mood === 'tuck');
  const blinking = asleep || (rig.mood === 'idle' && t % 4.3 < 0.12);
  for (const eye of rig.eyes) {
    const base = eye.userData.baseScale ?? (eye.userData.baseScale = eye.scale.x);
    eye.scale.set(base * eyeScale, base * eyeScale * (blinking ? 0.12 : 1), base);
  }
  for (const z of rig.zzz) {
    // Each z rises and grows over 2.4 s, staggered, only while asleep.
    const k = (t / 2.4 + (z.userData.phase as number)) % 1;
    z.visible = asleep && !reducedMotion;
    z.position.set(0.8 + 0.35 * k, 0.9 + 0.9 * k, 0.2);
    z.scale.setScalar(0.4 + 0.6 * k);
  }
  return fade;
}
