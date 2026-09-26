/// <reference types="webxr" />
// Android WebXR mode (spec 9.4, ADR 0008): pass-and-play in an immersive-ar session. Hit-test places the
// creatures on real surfaces and anchors keep them there in 6DoF, so the seeker can walk around. When the
// phone offers depth sensing, the room's depth is written into the depth buffer before the creatures are
// drawn, so furniture covers them; the same depth gives the visible share used by the game rules.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { play } from '../../audio/audio';
import { recordCatch } from '../../data/collection';
import {
  catchCreature,
  checkTimeout,
  elapsedMs,
  formatClock,
  giveUp,
  hide,
  MAX_CREATURES,
  newRound,
  remaining,
  startClock,
  toHandover,
  toSeek,
  unhide,
} from '../../engine/round';
import { CATCH_MIN_VISIBLE, hiddenEnough, hintStage, panFor } from '../../engine/rules';
import { COMMON_SPECIES, SPECIES, speciesForSpot, type SpeciesId } from '../../engine/species';
import { fill } from '../../i18n/strings';
import { animateCreature, createCreature, setMood, type CreatureRig } from '../../render/creatures3d';
import { createCreatureUniforms, type CreatureUniforms } from '../../render/occlusionMaterial';
import { BASE_HEIGHT_M, floorFit } from '../../render/usdz';
import { closeCamera } from '../../app/session';
import { log } from '../../app/report';
import { useSession, useSettings, useT } from '../../app/store';
import { Curtain } from '../game/Curtain';
import { Results } from '../game/Results';
import { useRound } from '../game/roundStore';
import { SAMPLE_OFFSETS, raySphere, visibleFraction, type DepthSample } from './xrMath';

const PENDING_CHECK_MS = 900;
const HINT_SOUND_EVERY_MS = 6_000;

interface XrCreature {
  id: number;
  species: SpeciesId;
  /** On the surface, turned to face the hider. */
  root: THREE.Group;
  rig: CreatureRig;
  uniforms: CreatureUniforms;
  anchor: XRAnchor | null;
  /** Radius in metres, and the centre's height above the surface. */
  radius: number;
  visible: number | null;
}

interface XrRuntime {
  session: XRSession;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  refSpace: XRReferenceSpace;
  hitSource: XRHitTestSource | null;
  reticle: THREE.Mesh;
  lastHit: XRHitTestResult | null;
  occluder: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  depthTexture: THREE.DataTexture | null;
  creatures: XrCreature[];
  nextId: number;
}

const occluderVertex = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Writes the room's depth (from WebXR depth sensing) into the depth buffer, so creatures behind furniture
// fail the depth test. Nothing is drawn in colour.
const occluderFragment = /* glsl */ `
  uniform sampler2D uDepth;
  uniform float uHas;
  uniform float uFloat;
  uniform float uRawToMeters;
  uniform mat4 uUvTransform;
  uniform vec2 uViewport;
  uniform float uP10;
  uniform float uP14;
  void main() {
    if (uHas < 0.5) { gl_FragDepth = 1.0; return; }
    vec2 nv = vec2(gl_FragCoord.x / uViewport.x, 1.0 - gl_FragCoord.y / uViewport.y);
    vec2 uv = (uUvTransform * vec4(nv, 0.0, 1.0)).xy;
    vec4 t = texture2D(uDepth, uv);
    float raw = uFloat > 0.5 ? t.r : dot(t.rg, vec2(255.0, 65280.0));
    float m = raw * uRawToMeters;
    if (m <= 0.0) { gl_FragDepth = 1.0; return; }
    float ndc = (-uP10 * m + uP14) / m;
    gl_FragDepth = clamp(0.5 * ndc + 0.5, 0.0, 1.0);
  }
`;

function createOccluder(): XrRuntime['occluder'] {
  const material = new THREE.ShaderMaterial({
    vertexShader: occluderVertex,
    fragmentShader: occluderFragment,
    uniforms: {
      uDepth: { value: null },
      uHas: { value: 0 },
      uFloat: { value: 0 },
      uRawToMeters: { value: 0.001 },
      uUvTransform: { value: new THREE.Matrix4() },
      uViewport: { value: new THREE.Vector2(1, 1) },
      uP10: { value: -1 },
      uP14: { value: -0.2 },
    },
    colorWrite: false,
    depthWrite: true,
    depthTest: true,
    depthFunc: THREE.AlwaysDepth,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}

/** Whether this browser can run the WebXR mode. */
export async function xrSupported(): Promise<boolean> {
  try {
    return !!(await navigator.xr?.isSessionSupported('immersive-ar'));
  } catch {
    return false;
  }
}

export function XrGame() {
  const t = useT();
  const setSession = useSession(s => s.set);
  const round = useRound(s => s.round);
  const apply = useRound(s => s.apply);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rt = useRef<XrRuntime | null>(null);
  const pending = useRef(new Map<number, { at: number; insisted: boolean }>());
  const rejected = useRef<{ p: THREE.Vector3; at: number } | null>(null);
  const wantHandover = useRef(false);
  const lastHintSound = useRef(0);
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);
  const [running, setRunning] = useState(false);
  const [depth, setDepth] = useState<boolean | null>(null);
  const [banner, setBanner] = useState('');
  const [clock, setClock] = useState('0:00');

  const flash = useCallback((text: string, ms = 2200) => {
    setBanner(text);
    window.setTimeout(() => setBanner(b => (b === text ? '' : b)), ms);
  }, []);

  const removeCreature = (id: number) => {
    const r = rt.current;
    if (!r) return;
    const c = r.creatures.find(x => x.id === id);
    if (!c) return;
    c.anchor?.delete();
    r.scene.remove(c.root);
    r.creatures = r.creatures.filter(x => x !== c);
  };

  const place = (hit: XRHitTestResult, frame: XRFrame, now: number) => {
    const r = rt.current;
    if (!r || useRound.getState().round.creatures.length >= MAX_CREATURES) return;
    const hp = hit.getPose(r.refSpace);
    const viewer = frame.getViewerPose(r.refSpace);
    if (!hp || !viewer) return;
    const p = hp.transform.position;
    const cam = viewer.transform.position;
    const pos = new THREE.Vector3(p.x, p.y, p.z);
    const last = rejected.current;
    const insisted = !!last && now - last.at < 6000 && last.p.distanceTo(pos) < 0.15;
    rejected.current = null;

    const species = speciesForSpot(null, Math.random(), COMMON_SPECIES);
    const uniforms = createCreatureUniforms();
    uniforms.uOcclusion.value = 0;
    const rig = createCreature(species, uniforms, now);
    const height = BASE_HEIGHT_M * SPECIES[species].size;
    const fit = floorFit(rig.group, height);
    const inner = new THREE.Group();
    inner.scale.setScalar(fit.scale);
    inner.position.y = fit.lift;
    inner.add(rig.group);
    const root = new THREE.Group();
    root.position.copy(pos);
    root.rotation.y = Math.atan2(cam.x - p.x, cam.z - p.z);
    root.add(inner);
    r.scene.add(root);
    const id = r.nextId++;
    const creature: XrCreature = { id, species, root, rig, uniforms, anchor: null, radius: height / 2, visible: null };
    r.creatures.push(creature);
    hit.createAnchor?.().then(
      a => { if (r.creatures.includes(creature)) creature.anchor = a; else a.delete(); },
      e => log(`XR anchor error: ${String(e)}`),
    );
    apply(state => hide(state, { id, species, dir: [0, 0, -1], disp: 0, up: [0, 1, 0] }));
    pending.current.set(id, { at: now, insisted });
    play('place');
  };

  const tryCatch = (frame: XRFrame, source: XRInputSource, now: number) => {
    const r = rt.current;
    const state = useRound.getState().round;
    if (!r || state.phase !== 'seek' || state.pausedAt !== null) return;
    const ray = frame.getPose(source.targetRaySpace, r.refSpace);
    if (!ray) return;
    const o = ray.transform.position;
    const q = ray.transform.orientation;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    const open = r.creatures.filter(c => c.rig.mood !== 'caught');
    const i = raySphere([o.x, o.y, o.z], [dir.x, dir.y, dir.z], open.map(c => ({ c: centre(c).toArray(), r: c.radius * 1.3 })));
    const c = open[i];
    if (!c) return;
    const visible = c.visible ?? 1;
    if (visible < CATCH_MIN_VISIBLE) return;
    setMood(c.rig, 'caught', now);
    window.setTimeout(() => removeCreature(c.id), 500);
    apply(s => catchCreature(s, c.id, now, visible, 'tap'));
    const { parent } = useSettings.getState();
    recordCatch({ species: c.species, at: Date.now(), room: parent.room || tRef.current.defaultRoom, mode: 'pass', method: 'tap', visible })
      .then(isNew => { if (isNew) flash(fill(tRef.current.newSpecies, { name: SPECIES[c.species].name }), 2600); })
      .catch(e => log(`Collection error: ${String(e)}`));
    play('catch');
    navigator.vibrate?.(40);
  };

  const onFrame = (time: number, frame: XRFrame | undefined) => {
    const r = rt.current;
    if (!r || !frame) return;
    const viewer = frame.getViewerPose(r.refSpace);
    let state = useRound.getState().round;
    if (viewer) {
      const view = viewer.views[0]!;
      const info = readDepth(r, frame, view);
      if (depth === null && info) setDepth(true);

      // Reticle while hiding.
      if (state.phase === 'hide' && r.hitSource) {
        const hit = frame.getHitTestResults(r.hitSource)[0] ?? null;
        r.lastHit = hit;
        const pose = hit?.getPose(r.refSpace);
        r.reticle.visible = !!pose;
        if (pose) r.reticle.matrix.fromArray(pose.transform.matrix);
      } else {
        r.reticle.visible = false;
      }

      // Anchors keep creatures where they were put as ARCore refines its map.
      for (const c of r.creatures) {
        const pose = c.anchor ? frame.getPose(c.anchor.anchorSpace, r.refSpace) : null;
        if (pose) c.root.position.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);
        c.uniforms.uFade.value = animateCreature(c.rig, time);
        c.visible = info ? measureVisible(c, view, info) : null;
      }

      if (state.phase === 'hide') {
        for (const [id, p] of pending.current) {
          const c = r.creatures.find(x => x.id === id);
          if (!c) { pending.current.delete(id); continue; }
          if (time - p.at < PENDING_CHECK_MS) continue;
          pending.current.delete(id);
          if (!p.insisted && c.visible !== null && !hiddenEnough(c.visible)) {
            rejected.current = { p: c.root.position.clone(), at: time };
            removeCreature(id);
            apply(s => unhide(s, id));
            flash(tRef.current.hideTooVisible, 3500);
            wantHandover.current = false;
          }
        }
        if (wantHandover.current && pending.current.size === 0) {
          wantHandover.current = false;
          apply(toHandover);
        }
      }

      if (state.phase === 'seek') {
        if (state.seekStartedAt === null) { apply(s => startClock(s, time)); state = useRound.getState().round; }
        const timedOut = checkTimeout(state, time);
        if (timedOut !== state) apply(() => timedOut);
        // Hint sound from where the nearest creature is (spec 10).
        const stage = hintStage(time, state.lastProgressAt ?? time, useSettings.getState().parent.hintDelaySec * 1000);
        const target = nearest(r, view);
        if (stage >= 1 && target && time - lastHintSound.current > HINT_SOUND_EVERY_MS) {
          lastHintSound.current = time;
          play('hint', panFor(target));
        }
      }
    }
    r.renderer.render(r.scene, r.camera);
  };
  const onFrameRef = useRef(onFrame);
  useEffect(() => { onFrameRef.current = onFrame; });

  const stop = useCallback(() => {
    const r = rt.current;
    rt.current = null;
    if (!r) return;
    r.renderer.setAnimationLoop(null);
    r.hitSource?.cancel();
    for (const c of r.creatures) c.anchor?.delete();
    r.session.end().catch(() => undefined);
    r.renderer.dispose();
    setRunning(false);
  }, []);

  useEffect(() => stop, [stop]);

  // Buttons on the DOM overlay must not also count as taps in the room.
  useEffect(() => {
    const root = overlayRef.current;
    if (!root) return;
    const block = (e: Event) => { if ((e.target as HTMLElement | null)?.closest('button')) e.preventDefault(); };
    root.addEventListener('beforexrselect', block);
    return () => root.removeEventListener('beforexrselect', block);
  }, []);

  // The round ended: leave AR and show the results on the page.
  useEffect(() => {
    if (round.phase === 'results' && rt.current) stop();
  }, [round.phase, stop]);

  useEffect(() => {
    const id = setInterval(() => setClock(formatClock(elapsedMs(useRound.getState().round, performance.now()))), 250);
    return () => clearInterval(id);
  }, []);

  const start = async () => {
    const xr = navigator.xr;
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!xr || !canvas || !overlay) return;
    // ARCore needs the camera for itself.
    closeCamera();
    let session: XRSession;
    try {
      // The request must stay the first await of the tap.
      session = await xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['anchors', 'depth-sensing', 'dom-overlay'],
        depthSensing: { usagePreference: ['cpu-optimized'], dataFormatPreference: ['luminance-alpha', 'float32'] },
        domOverlay: { root: overlay },
      } as XRSessionInit);
    } catch (e) {
      log(`XR session error: ${String(e)}`);
      flash(t.xrError, 3000);
      return;
    }
    apply(() => newRound(useSettings.getState().parent.timeLimitMin * 60_000));
    pending.current.clear();
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    await renderer.xr.setSession(session);
    const refSpace = renderer.xr.getReferenceSpace()!;
    const viewer = await session.requestReferenceSpace('viewer');
    const hitSource = (await session.requestHitTestSource?.({ space: viewer })) ?? null;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.05, 0.07, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffc53d, depthTest: false }),
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    const occluder = createOccluder();
    scene.add(reticle, occluder);
    rt.current = { session, renderer, scene, camera, refSpace, hitSource, reticle, lastHit: null, occluder, depthTexture: null, creatures: [], nextId: 1 };
    const features = (session as XRSession & { enabledFeatures?: string[] }).enabledFeatures;
    log(`XR session: ${features ? features.join(', ') : 'features unknown'}`);
    if (features && !features.includes('depth-sensing')) setDepth(false);

    session.addEventListener('select', e => {
      const now = performance.now();
      const phase = useRound.getState().round.phase;
      if (phase === 'hide' && rt.current?.lastHit) place(rt.current.lastHit, e.frame, now);
      else if (phase === 'seek') tryCatch(e.frame, e.inputSource, now);
    });
    session.addEventListener('end', () => {
      if (rt.current?.session === session) stop();
    });
    renderer.setAnimationLoop((time, frame) => onFrameRef.current(time, frame));
    setRunning(true);
  };

  const again = () => {
    apply(() => newRound(useSettings.getState().parent.timeLimitMin * 60_000));
  };

  const hiddenCount = round.creatures.length;
  const left = remaining(round);

  return (
    <div className="stage xr-stage">
      <canvas ref={canvasRef} style={{ display: running ? 'block' : 'none' }} />
      <div ref={overlayRef} className="xr-overlay">
        {!running && round.phase !== 'results' && (
          <main className="screen">
            <h1 className="title center">{t.xrTitle}</h1>
            <p className="lead">{t.xrBody}</p>
            {depth === false && <p className="small center">{t.xrNoDepth}</p>}
            <div className="grow" />
            <button className="btn btn-primary btn-big" onClick={() => void start()}>{t.xrEnter}</button>
            <button className="link-btn center" onClick={() => setSession({ phase: 'home' })}>{t.menu}</button>
          </main>
        )}

        {running && round.phase === 'hide' && (
          <>
            <div className="hud-top">
              <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <p className="pill" style={{ maxWidth: 240 }}>{t.xrHide}</p>
                {hiddenCount > 0 && <span className="counter">{fill(t.hideCount, { n: hiddenCount })}</span>}
              </div>
              {depth === false && <p className="pill">{t.xrNoDepth}</p>}
            </div>
            <div className="hud-bottom">
              <div className="row">
                <button className="btn btn-glass" onClick={stop}>{t.xrExit}</button>
                <button className="btn btn-primary" disabled={!hiddenCount} onClick={() => { wantHandover.current = true; }}>{t.hideDone}</button>
              </div>
            </div>
          </>
        )}

        {running && round.phase === 'handover' && <Curtain count={hiddenCount} onOpen={() => { lastHintSound.current = 0; apply(toSeek); }} />}

        {running && round.phase === 'seek' && (
          <>
            <div className="hud-top">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="pill timer">{clock}</span>
                <span className="counter">{hiddenCount - left} / {hiddenCount}</span>
              </div>
            </div>
            <div className="hud-bottom">
              <div className="row">
                <button className="btn btn-glass" onClick={() => apply(s => giveUp(s, performance.now()))}>{t.endRound}</button>
              </div>
            </div>
          </>
        )}

        {banner && <p className="toast">{banner}</p>}
      </div>

      {!running && round.phase === 'results' && (
        <div className="results-layer">
          <Results round={round} stills={new Map()} onReplay={again} onHideAgain={again} onMenu={() => setSession({ phase: 'home' })} />
        </div>
      )}
    </div>
  );
}

function centre(c: XrCreature): THREE.Vector3 {
  return c.root.position.clone().add(new THREE.Vector3(0, c.radius, 0));
}

/** Reads the depth for this frame into the occluder. Returns the CPU depth, or null without depth sensing. */
function readDepth(r: XrRuntime, frame: XRFrame, view: XRView): XRCPUDepthInformation | null {
  let info: XRCPUDepthInformation | null;
  try {
    info = frame.getDepthInformation?.(view) ?? null;
  } catch {
    info = null;
  }
  const u = r.occluder.material.uniforms;
  if (!info) { u.uHas!.value = 0; return null; }
  const isFloat = (frame.session as XRSession & { depthDataFormat?: string }).depthDataFormat === 'float32';
  const w = info.width, h = info.height;
  let tex = r.depthTexture;
  if (!tex || tex.image.width !== w || tex.image.height !== h || (tex.type === THREE.FloatType) !== isFloat) {
    tex?.dispose();
    tex = isFloat
      ? new THREE.DataTexture(new Float32Array(w * h), w, h, THREE.RedFormat, THREE.FloatType)
      : new THREE.DataTexture(new Uint8Array(w * h * 2), w, h, THREE.RGFormat, THREE.UnsignedByteType);
    tex.minFilter = tex.magFilter = THREE.NearestFilter;
    tex.flipY = false;
    r.depthTexture = tex;
  }
  (tex.image.data as Uint8Array | Float32Array).set(isFloat ? new Float32Array(info.data) : new Uint8Array(info.data));
  tex.needsUpdate = true;
  const layer = frame.session.renderState.baseLayer;
  u.uDepth!.value = tex;
  u.uHas!.value = 1;
  u.uFloat!.value = isFloat ? 1 : 0;
  u.uRawToMeters!.value = info.rawValueToMeters;
  (u.uUvTransform!.value as THREE.Matrix4).fromArray(info.normDepthBufferFromNormView.matrix);
  (u.uViewport!.value as THREE.Vector2).set(layer?.framebufferWidth ?? innerWidth, layer?.framebufferHeight ?? innerHeight);
  u.uP10!.value = view.projectionMatrix[10];
  u.uP14!.value = view.projectionMatrix[14];
  return info;
}

/** Share of the creature the room leaves in view, from the CPU depth at a few points across it. */
function measureVisible(c: XrCreature, view: XRView, info: XRCPUDepthInformation): number {
  const viewMatrix = new THREE.Matrix4().fromArray(view.transform.inverse.matrix);
  const projection = new THREE.Matrix4().fromArray(view.projectionMatrix);
  const camRight = new THREE.Vector3().setFromMatrixColumn(new THREE.Matrix4().fromArray(view.transform.matrix), 0);
  const camUp = new THREE.Vector3().setFromMatrixColumn(new THREE.Matrix4().fromArray(view.transform.matrix), 1);
  const middle = centre(c);
  const samples: DepthSample[] = [];
  for (const [ox, oy] of SAMPLE_OFFSETS) {
    const world = middle.clone().addScaledVector(camRight, ox * c.radius).addScaledVector(camUp, oy * c.radius);
    const inView = world.clone().applyMatrix4(viewMatrix);
    const expected = -inView.z;
    if (expected <= 0) continue;
    const ndc = inView.clone().applyMatrix4(projection);
    const x = (ndc.x + 1) / 2, y = (1 - ndc.y) / 2;
    if (x < 0 || x > 1 || y < 0 || y > 1) continue;
    let real: number | null;
    try { real = info.getDepthInMeters(x, y); } catch { real = null; }
    samples.push({ expected, real });
  }
  return visibleFraction(samples);
}

/** Direction to the nearest uncaught creature in the phone's frame, for the panned hint. */
function nearest(r: XrRuntime, view: XRView): [number, number, number] | null {
  const viewMatrix = new THREE.Matrix4().fromArray(view.transform.inverse.matrix);
  let best: { d: THREE.Vector3; angle: number } | null = null;
  for (const c of r.creatures) {
    if (c.rig.mood === 'caught') continue;
    const d = centre(c).applyMatrix4(viewMatrix);
    const angle = d.angleTo(new THREE.Vector3(0, 0, -1));
    if (!best || angle < best.angle) best = { d, angle };
  }
  return best ? [best.d.x, best.d.y, best.d.z] : null;
}
