// Three.js overlay (spec 8.4): a transparent WebGL canvas over the camera video. The virtual camera
// follows the device orientation and reproduces the video's field of view and object-fit crop, so a
// creature anchored to a world direction lands on the same pixels the maths in rotation.ts predicts.
import * as THREE from 'three';
import type { PosedDepthMap } from '../perception/depth/temporal';
import { cameraTans, project, toDevice, type CameraTans, type Mat3, type Vec3 } from '../perception/motion/rotation';
import { createCreatureUniforms, type CreatureUniforms } from './occlusionMaterial';
import type { SpeciesId } from '../engine/species';
import { SPECIES } from '../engine/species';
import { SHARED_GEOMETRY, animateCreature, createCreature, setMood, type CreatureRig, type Mood } from './creatures3d';
import { coverMapping, type ViewMapping } from './viewMapping';

/** Creatures live on a sphere around the player; 3DoF has no metric distance. */
const ANCHOR_DISTANCE = 3;
const VIS_WIDTH = 48;

export interface Creature {
  id: number;
  species: SpeciesId;
  dir: Vec3;
  disp: number;
  anchor: THREE.Group;
  rig: CreatureRig;
  uniforms: CreatureUniforms;
  /** Visible fraction from the last visibility pass, 0..1; null before the first one. */
  visible: number | null;
  /** Number of visibility passes so far, to tell a fresh measurement from a repeated one. */
  measurements: number;
  /** Screen position and radius in CSS pixels while on screen. */
  screen: { x: number; y: number; r: number } | null;
}

/** Device-to-world rotation as a Three.js quaternion for the camera. */
export function poseQuaternion(m: Mat3, target = new THREE.Quaternion()): THREE.Quaternion {
  const m4 = new THREE.Matrix4().set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1);
  return target.setFromRotationMatrix(m4);
}

/** Sets a perspective camera to show exactly the part of the video that `view` puts on screen. */
export function configureCamera(camera: THREE.PerspectiveCamera, view: ViewMapping, tans: CameraTans) {
  camera.fov = (2 * Math.atan(tans.ty) * 180) / Math.PI;
  camera.aspect = view.videoWidth / view.videoHeight;
  camera.setViewOffset(view.videoWidth, view.videoHeight, -view.offsetX, -view.offsetY, view.width, view.height);
  camera.updateProjectionMatrix();
}

/** World size of a creature: about 7.5% of the screen height at mid depth, a little bigger when near (as in the PoC). */
export function creatureRadius(disp: number, tans: CameraTans): number {
  return ANCHOR_DISTANCE * tans.ty * 0.15 * (0.7 + 0.6 * disp);
}

export class OcclusionRenderer {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.05, 50);
  private visTarget = new THREE.WebGLRenderTarget(VIS_WIDTH, VIS_WIDTH);
  private visPixels = new Uint8Array(VIS_WIDTH * VIS_WIDTH * 4);
  private depthTexture: THREE.DataTexture | null = null;
  private depthBytes: Uint8Array | null = null;
  private depthPose: Mat3 | null = null;
  private creatures: Creature[] = [];
  private nextId = 1;
  private visCursor = 0;
  private view: ViewMapping = coverMapping(1, 1, 1, 1);
  private tans: CameraTans = cameraTans(64, 1, 1);
  private cssWidth = 1;
  private cssHeight = 1;
  private pixelRatio = 1;
  private occlusion = true;
  private video: HTMLVideoElement | null = null;
  private stillRequests: { id: number; done: (dataUrl: string | null) => void }[] = [];
  private reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: false });
    this.renderer.setClearColor(0x000000, 0);
  }

  /** Call when the canvas or video size, or the calibrated field of view, changes. */
  setView(cssWidth: number, cssHeight: number, pixelRatio: number, videoWidth: number, videoHeight: number, fovDeg: number) {
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    this.pixelRatio = pixelRatio;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(cssWidth, cssHeight, false);
    this.view = coverMapping(cssWidth, cssHeight, videoWidth, videoHeight);
    this.tans = cameraTans(fovDeg, videoWidth, videoHeight);
    configureCamera(this.camera, this.view, this.tans);
    const visHeight = Math.max(1, Math.round((VIS_WIDTH * cssHeight) / cssWidth));
    if (this.visTarget.height !== visHeight) {
      this.visTarget.setSize(VIS_WIDTH, visHeight);
      this.visPixels = new Uint8Array(VIS_WIDTH * visHeight * 4);
    }
  }

  /** With occlusion off (calibration), creatures are always drawn whole and need no depth map. */
  setOcclusion(enabled: boolean) {
    this.occlusion = enabled;
    for (const c of this.creatures) c.uniforms.uOcclusion.value = enabled ? 1 : 0;
  }

  get cameraTans(): CameraTans {
    return this.tans;
  }

  /** Uploads the latest depth map; occlusion uses it together with the pose it was captured with. */
  setDepth(map: PosedDepthMap) {
    const n = map.width * map.height;
    if (!this.depthTexture || this.depthTexture.image.width !== map.width || this.depthTexture.image.height !== map.height) {
      this.depthTexture?.dispose();
      this.depthBytes = new Uint8Array(n);
      this.depthTexture = new THREE.DataTexture(this.depthBytes, map.width, map.height, THREE.RedFormat, THREE.UnsignedByteType);
      this.depthTexture.minFilter = THREE.LinearFilter;
      this.depthTexture.magFilter = THREE.LinearFilter;
      this.depthTexture.wrapS = THREE.ClampToEdgeWrapping;
      this.depthTexture.wrapT = THREE.ClampToEdgeWrapping;
    }
    const bytes = this.depthBytes!;
    for (let i = 0; i < n; i++) bytes[i] = Math.round(map.data[i]! * 255);
    this.depthTexture.needsUpdate = true;
    this.depthPose = map.pose;
    for (const c of this.creatures) {
      c.uniforms.uDepth.value = this.depthTexture;
      c.uniforms.uHasDepth.value = 1;
    }
  }

  /**
   * Anchors a creature in a world direction. `up` is the phone's up direction in the world when it was
   * placed, so the creature faces the player upright however the phone was held.
   */
  addCreature(dir: Vec3, disp: number, up: Vec3 = [0, 0, 1], species: SpeciesId = 'pompon', now = performance.now(), id?: number): Creature {
    const uniforms = createCreatureUniforms();
    uniforms.uDisp.value = disp;
    uniforms.uOcclusion.value = this.occlusion ? 1 : 0;
    if (this.depthTexture) {
      uniforms.uDepth.value = this.depthTexture;
      uniforms.uHasDepth.value = 1;
    }
    const rig = createCreature(species, uniforms, now);
    const anchor = new THREE.Group();
    anchor.up.set(up[0], up[1], up[2]);
    const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    anchor.position.set((dir[0] / len) * ANCHOR_DISTANCE, (dir[1] / len) * ANCHOR_DISTANCE, (dir[2] / len) * ANCHOR_DISTANCE);
    anchor.lookAt(0, 0, 0);
    anchor.scale.setScalar(creatureRadius(disp, this.tans) * SPECIES[species].size);
    anchor.add(rig.group);
    this.scene.add(anchor);
    const creatureId = id ?? this.nextId++;
    this.nextId = Math.max(this.nextId, creatureId + 1);
    const creature: Creature = { id: creatureId, species, dir, disp, anchor, rig, uniforms, visible: null, measurements: 0, screen: null };
    this.creatures.push(creature);
    return creature;
  }

  /** Moves a creature's anchor (solo moves, re-anchoring). Keeps it facing the player upright. */
  setCreatureDir(id: number, dir: Vec3) {
    const c = this.creatures.find(x => x.id === id);
    if (!c) return;
    const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    c.dir = [dir[0] / len, dir[1] / len, dir[2] / len];
    c.anchor.position.set(c.dir[0] * ANCHOR_DISTANCE, c.dir[1] * ANCHOR_DISTANCE, c.dir[2] * ANCHOR_DISTANCE);
    c.anchor.lookAt(0, 0, 0);
  }

  /** Changes how near a creature sits (Curioso creeping closer): its occlusion depth and its size. */
  setCreatureDisp(id: number, disp: number) {
    const c = this.creatures.find(x => x.id === id);
    if (!c) return;
    c.disp = disp;
    c.uniforms.uDisp.value = disp;
    c.anchor.scale.setScalar(creatureRadius(disp, this.tans) * SPECIES[c.species].size);
  }

  setMood(id: number, mood: Mood, now = performance.now()) {
    const c = this.creatures.find(x => x.id === id);
    if (c) setMood(c.rig, mood, now);
  }

  /** Time up (spec 5): the uncaught creatures show themselves whole. */
  reveal(ids: readonly number[]) {
    for (const c of this.creatures) if (ids.includes(c.id)) c.uniforms.uOcclusion.value = 0;
  }

  /** The video element, used to compose catch stills. */
  setVideo(video: HTMLVideoElement | null) {
    this.video = video;
  }

  /** Asks for a still of the camera and the creatures around one creature, taken right after the next frame. */
  requestStill(id: number, done: (dataUrl: string | null) => void) {
    this.stillRequests.push({ id, done });
  }

  removeCreature(id: number) {
    const c = this.creatures.find(x => x.id === id);
    if (!c) return;
    this.scene.remove(c.anchor);
    // Free the GPU buffers too: each creature builds its own body geometries (the small sphere is shared).
    const geometries = new Set<THREE.BufferGeometry>();
    c.anchor.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      (o.material as THREE.Material).dispose();
      if (o.geometry !== SHARED_GEOMETRY) geometries.add(o.geometry);
    });
    for (const g of geometries) g.dispose();
    this.creatures = this.creatures.filter(x => x.id !== id);
  }

  clear() {
    for (const c of [...this.creatures]) this.removeCreature(c.id);
  }

  get list(): readonly Creature[] {
    return this.creatures;
  }

  /** Draws one frame with the current device orientation. Measures one creature's visibility per call. */
  render(pose: Mat3, timeMs: number) {
    poseQuaternion(pose, this.camera.quaternion);
    this.camera.updateMatrixWorld();
    const bufferW = this.cssWidth * this.pixelRatio;
    const bufferH = this.cssHeight * this.pixelRatio;

    for (const c of this.creatures) {
      c.uniforms.uFade.value = animateCreature(c.rig, timeMs, this.reducedMotion);
      const p = project(toDevice(pose, c.dir), this.tans);
      const dp = this.depthPose ? project(toDevice(this.depthPose, c.dir), this.tans) : null;
      c.uniforms.uOffset.value.set(p && dp ? dp.u - p.u : 0, p && dp ? dp.v - p.v : 0);
      this.setBufferUniforms(c.uniforms, bufferW, bufferH, this.pixelRatio);
      c.screen = p
        ? {
            x: this.view.offsetX + p.u * this.view.videoWidth,
            y: this.view.offsetY + p.v * this.view.videoHeight,
            r: (c.anchor.scale.x / ANCHOR_DISTANCE / this.tans.ty / 2) * this.view.videoHeight,
          }
        : null;
    }

    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
    // The WebGL canvas is only readable in the same task as the render, so stills are taken here.
    if (this.stillRequests.length) this.takeStills();
    this.measureNext();
  }

  private takeStills() {
    const requests = this.stillRequests;
    this.stillRequests = [];
    for (const r of requests) {
      const c = this.creatures.find(x => x.id === r.id);
      r.done(c?.screen && this.video ? this.composeStill(c.screen) : null);
    }
  }

  private composeStill(at: { x: number; y: number; r: number }): string | null {
    const video = this.video!;
    const size = 240;
    const half = Math.max(at.r * 2.2, 60);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx || !video.videoWidth) return null;
    const scale = size / (half * 2);
    // Camera frame, cropped like object-fit: cover, then the creatures on top.
    ctx.setTransform(scale, 0, 0, scale, -(at.x - half) * scale, -(at.y - half) * scale);
    ctx.drawImage(video, this.view.offsetX, this.view.offsetY, this.view.videoWidth, this.view.videoHeight);
    ctx.drawImage(this.renderer.domElement, 0, 0, this.cssWidth, this.cssHeight);
    try {
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch {
      return null;
    }
  }

  private setBufferUniforms(u: CreatureUniforms, bufferW: number, bufferH: number, scale: number) {
    u.uBuffer.value.set(bufferW, bufferH);
    u.uVideoRect.value.set(this.view.offsetX * scale, this.view.offsetY * scale, this.view.videoWidth * scale, this.view.videoHeight * scale);
  }

  /** Visibility read-back (spec 8.4): renders one creature into a small target and averages its coverage. */
  private measureNext() {
    const onScreen = this.creatures.filter(c => c.screen);
    if (!onScreen.length || !this.depthTexture || !this.occlusion) return;
    const c = onScreen[this.visCursor++ % onScreen.length]!;
    const w = this.visTarget.width;
    const h = this.visTarget.height;

    const hidden: THREE.Object3D[] = [];
    for (const other of this.creatures) if (other !== c) { other.anchor.visible = false; hidden.push(other.anchor); }
    for (const o of c.rig.outline) o.visible = false;
    c.uniforms.uVisPass.value = 1;
    this.setBufferUniforms(c.uniforms, w, h, w / this.cssWidth);

    this.renderer.setRenderTarget(this.visTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.readRenderTargetPixels(this.visTarget, 0, 0, w, h, this.visPixels);
    this.renderer.setRenderTarget(null);

    c.uniforms.uVisPass.value = 0;
    for (const o of c.rig.outline) o.visible = true;
    for (const a of hidden) a.visible = true;

    let shown = 0;
    let covered = 0;
    const px = this.visPixels;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 1]! > 127) {
        covered++;
        shown += px[i]! / 255;
      }
    }
    c.visible = covered ? shown / covered : 0;
    c.measurements++;
  }

  dispose() {
    this.clear();
    this.depthTexture?.dispose();
    this.visTarget.dispose();
    this.renderer.dispose();
  }
}
