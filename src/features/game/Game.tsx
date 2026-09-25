// Pass-and-play hide and seek (spec 4.2). One camera stage stays alive through the whole round, so the
// creatures and the depth loop survive the handover; each phase adds its own HUD on top.
import { useCallback, useEffect, useRef, useState } from 'react';
import { play } from '../../audio/audio';
import {
  catchCreature,
  checkTimeout,
  elapsedMs,
  formatClock,
  giveUp,
  hide,
  newRound,
  pause,
  remaining,
  replay,
  resume,
  startClock,
  toHandover,
  toSeek,
  unhide,
  type CatchMethod,
} from '../../engine/round';
import { NearlyFoundTracker, RetreatTracker, hiddenEnough, hintStage, panFor, pickCatchTarget } from '../../engine/rules';
import { M3_SPECIES, SPECIES, speciesForSpot, type SpeciesId, type SpotKind } from '../../engine/species';
import { fill } from '../../i18n/strings';
import type { PosedDepthMap } from '../../perception/depth/temporal';
import { detectHands, handsReady, loadHands } from '../../perception/hands/landmarker';
import { PinchStarts, fingerPairs, type FingerPair } from '../../perception/hands/pinch';
import { getOrientation } from '../../perception/motion/orientation';
import { cameraTans, project, ray, toDevice, toWorld, type Vec3 } from '../../perception/motion/rotation';
import { findHidingSpots } from '../../perception/spots/spots';
import { coverMapping, screenToVideo, videoToScreen, visibleVideoRect } from '../../render/viewMapping';
import { buildReport, log } from '../../app/report';
import { useSession, useSettings, useT } from '../../app/store';
import { useDepthLoop } from '../stage/useDepthLoop';
import { useStage } from '../stage/useStage';
import { Curtain } from './Curtain';
import { Results } from './Results';
import { useRound } from './roundStore';

const HINT_DELAY_MS = 60_000;
const HINT_SOUND_EVERY_MS = 6_000;
const SNAP_PX = 44;
const PENDING_CHECK_MS = 900;

interface Spot {
  dir: Vec3;
  disp: number;
  kind: SpotKind;
}

type SpeciesChoice = SpeciesId | 'auto';

export function Game() {
  const t = useT();
  const setSession = useSession(s => s.set);
  const { lang, setLang, hands, setHands } = useSettings();
  const round = useRound(s => s.round);
  const apply = useRound(s => s.apply);

  const videoRef = useRef<HTMLVideoElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const { rendererRef, syncView } = useStage(videoRef, glRef);

  const spotsRef = useRef<Spot[]>([]);
  const lastSpotScan = useRef(0);
  const pending = useRef(new Map<number, { at: number; insisted: boolean; auto: boolean }>());
  const rejected = useRef<{ x: number; y: number; at: number } | null>(null);
  const nearly = useRef(new NearlyFoundTracker());
  const retreat = useRef(new RetreatTracker(SPECIES.timido.retreat!.visibleAbove, SPECIES.timido.retreat!.afterMs, SPECIES.timido.retreat!.durationMs));
  const pinch = useRef(new PinchStarts());
  const fingers = useRef<FingerPair[]>([]);
  const lastHintSound = useRef(0);
  const forcedHintUntil = useRef(0);
  const frameNo = useRef(0);

  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);
  const [choice, setChoice] = useState<SpeciesChoice>('auto');
  const [banner, setBanner] = useState('');
  const [sheet, setSheet] = useState(false);
  const [handsState, setHandsState] = useState<'off' | 'loading' | 'on'>('off');
  const [timeUpSeen, setTimeUpSeen] = useState(false);
  const [clock, setClock] = useState('0:00');
  const [stills, setStills] = useState<ReadonlyMap<number, string>>(new Map());

  const flash = useCallback((text: string, ms = 2200) => {
    setBanner(text);
    window.setTimeout(() => setBanner(b => (b === text ? '' : b)), ms);
  }, []);

  // Hiding spots are re-scanned from the latest depth map about once a second during the hiding phase.
  const onMap = useCallback((map: PosedDepthMap, video: HTMLVideoElement) => {
    if (useRound.getState().round.phase !== 'hide') return;
    const now = performance.now();
    if (now - lastSpotScan.current < 1000) return;
    lastSpotScan.current = now;
    const tans = cameraTans(useSettings.getState().fovDeg, video.videoWidth, video.videoHeight);
    const canvas = glRef.current;
    const bounds = canvas ? visibleVideoRect(coverMapping(canvas.clientWidth, canvas.clientHeight, video.videoWidth, video.videoHeight)) : undefined;
    spotsRef.current = findHidingSpots(map, 6, { bounds }).map(s => ({
      dir: toWorld(map.pose, ray({ u: s.u, v: s.v }, tans)),
      disp: s.disp,
      kind: s.kind,
    }));
  }, []);
  const { mapRef } = useDepthLoop(videoRef, rendererRef, onMap);

  const view = () => {
    const canvas = glRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return null;
    return {
      canvas,
      video,
      mapping: coverMapping(canvas.clientWidth, canvas.clientHeight, video.videoWidth, video.videoHeight),
      tans: cameraTans(useSettings.getState().fovDeg, video.videoWidth, video.videoHeight),
    };
  };

  // ---------- Hiding ----------

  const place = (dir: Vec3, disp: number, kind: SpotKind | null, insisted: boolean, now: number, auto = false) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const species = choice === 'auto' ? speciesForSpot(kind, Math.random()) : choice;
    const up = toWorld(getOrientation(), [0, 1, 0]);
    const c = renderer.addCreature(dir, disp, up, species, now);
    apply(r => hide(r, { id: c.id, species, dir, disp, up }));
    pending.current.set(c.id, { at: now, insisted, auto });
    play('place');
    log(`Hid ${species} at depth ${disp.toFixed(2)}${insisted ? ' (insisted)' : ''}`);
  };

  const depthAt = (dir: Vec3): number | null => {
    const map = mapRef.current;
    const v = view();
    if (!map || !v) return null;
    const p = project(toDevice(map.pose, dir), v.tans);
    if (!p || p.u < 0 || p.u >= 1 || p.v < 0 || p.v >= 1) return null;
    return map.data[Math.floor(p.v * map.height) * map.width + Math.floor(p.u * map.width)]!;
  };

  const hideAt = (x: number, y: number) => {
    const v = view();
    if (!v) return;
    if (!mapRef.current) { flash(t.hideNoDepth); return; }
    const pose = getOrientation();
    const now = performance.now();
    // Snap to a suggested spot under the finger.
    let best: { spot: Spot; d: number } | null = null;
    for (const spot of spotsRef.current) {
      const p = project(toDevice(pose, spot.dir), v.tans);
      if (!p) continue;
      const s = videoToScreen(v.mapping, p);
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < SNAP_PX && (!best || d < best.d)) best = { spot, d };
    }
    const r = rejected.current;
    const insisted = !!r && now - r.at < 6000 && Math.hypot(r.x - x, r.y - y) < SNAP_PX;
    rejected.current = null;
    if (best) {
      place(best.spot.dir, Math.max(0.02, best.spot.disp - 0.02), best.spot.kind, insisted, now);
      spotsRef.current = spotsRef.current.filter(s => s !== best!.spot);
      return;
    }
    const dir = toWorld(pose, ray(screenToVideo(v.mapping, x, y), v.tans));
    const d = depthAt(dir);
    if (d === null) return;
    place(dir, Math.max(0.02, d - 0.02), null, insisted, now);
  };

  const hideForMe = (n = 3) => {
    const spots = [...spotsRef.current];
    if (!spots.length) { flash(t.hideNoSpots); return; }
    const now = performance.now();
    // The game obeys the hide rule too: spots where a creature would show too much are dropped.
    spots.slice(0, n).forEach((s, i) => place(s.dir, Math.max(0.02, s.disp - 0.02), s.kind, false, now + i, true));
    spotsRef.current = spots.slice(n);
  };

  const undo = () => {
    const last = useRound.getState().round.creatures.at(-1);
    if (!last) return;
    rendererRef.current?.removeCreature(last.id);
    apply(r => unhide(r, last.id));
  };

  // ---------- Seeking ----------

  const tryCatch = (x: number, y: number, method: CatchMethod) => {
    const renderer = rendererRef.current;
    const r = useRound.getState().round;
    if (!renderer || r.phase !== 'seek' || r.pausedAt !== null) return;
    const caught = new Set(r.creatures.filter(c => c.caughtAt !== null).map(c => c.id));
    const id = pickCatchTarget(renderer.list.map(c => ({ id: c.id, screen: c.screen, visible: c.visible, caught: caught.has(c.id) })), x, y);
    if (id === null) return;
    const c = renderer.list.find(x => x.id === id)!;
    const visible = c.visible ?? 0;
    renderer.requestStill(id, url => { if (url) setStills(m => new Map(m).set(id, url)); });
    renderer.setMood(id, 'caught');
    window.setTimeout(() => rendererRef.current?.removeCreature(id), 500);
    apply(state => catchCreature(state, id, performance.now(), visible, method));
    play('catch');
    navigator.vibrate?.(40);
    log(`Caught ${c.species} by ${method} (visible ${Math.round(visible * 100)}%)`);
  };

  const toggleHands = async () => {
    if (handsState === 'on') { setHandsState('off'); setHands(false); return; }
    setHands(true);
    setHandsState('loading');
    try {
      await loadHands(videoRef.current);
      setHandsState('on');
    } catch (e) {
      log(`Hands load error: ${String(e)}`);
      setHandsState('off');
    }
  };

  // Warm up hands behind the curtain (ADR 0001: the first detection can freeze the page for seconds).
  useEffect(() => {
    if (round.phase !== 'handover' || !hands || handsReady()) return;
    loadHands(videoRef.current).then(() => setHandsState('on'), e => log(`Hands load error: ${String(e)}`));
  }, [round.phase, hands]);

  // ---------- Frame loop ----------

  useEffect(() => {
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const renderer = syncView();
      const v = view();
      if (!renderer || !v) return;
      renderer.setVideo(v.video);
      const pose = getOrientation();
      let r = useRound.getState().round;

      if (r.phase === 'seek' && r.seekStartedAt === null) {
        apply(state => startClock(state, now));
        r = useRound.getState().round;
      }

      // Behaviour before drawing, so moods apply this frame.
      if (r.phase === 'seek') {
        for (const c of renderer.list) {
          if (c.rig.mood === 'caught') continue;
          if (SPECIES[c.species].retreat) {
            const back = retreat.current.update(c.id, c.visible, now);
            if (back && c.rig.mood !== 'retreat') renderer.setMood(c.id, 'retreat', now);
            if (!back && c.rig.mood === 'retreat') renderer.setMood(c.id, 'idle', now);
          }
          if (nearly.current.update(c.id, c.screen, c.visible, v.mapping.width, v.mapping.height, now)) {
            renderer.setMood(c.id, 'near', now);
            play('near', panFor(toDevice(pose, c.dir)));
          }
        }
      }

      renderer.render(pose, now);

      if (r.phase === 'hide') {
        for (const [id, p] of pending.current) {
          const c = renderer.list.find(x => x.id === id);
          if (!c) { pending.current.delete(id); continue; }
          if (now - p.at < PENDING_CHECK_MS || c.visible === null) continue;
          pending.current.delete(id);
          if (!p.insisted && !hiddenEnough(c.visible) && c.screen) {
            renderer.removeCreature(id);
            apply(state => unhide(state, id));
            if (!p.auto) {
              rejected.current = { x: c.screen.x, y: c.screen.y, at: now };
              flash(tRef.current.hideTooVisible, 3500);
            }
          }
        }
      }

      if (r.phase === 'seek' && r.pausedAt === null) {
        if (useSettings.getState().hands && handsReady() && frameNo.current % 2 === 0) {
          fingers.current = fingerPairs(detectHands(v.video), v.mapping);
          const at = pinch.current.update(fingers.current);
          if (at) tryCatch(at.x, at.y, 'pinch');
        }
        const timedOut = checkTimeout(r, now);
        if (timedOut !== r) {
          apply(() => timedOut);
          renderer.reveal(timedOut.creatures.filter(c => c.caughtAt === null).map(c => c.id));
        }
      }
      frameNo.current++;
      drawOverlay(overlayRef.current, v.mapping.width, v.mapping.height, now, r.phase, pose, v.tans, v.mapping);
    };

    const drawOverlay = (
      canvas: HTMLCanvasElement | null,
      w: number,
      h: number,
      now: number,
      phase: string,
      pose: ReturnType<typeof getOrientation>,
      tans: ReturnType<typeof cameraTans>,
      mapping: ReturnType<typeof coverMapping>,
    ) => {
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      const dpr = Math.min(2, devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
      if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const r = useRound.getState().round;

      if (phase === 'hide') {
        // Shimmering spot hints (docs/design Hiding phase).
        const pulse = 0.5 + 0.5 * Math.sin(now / 260);
        for (const spot of spotsRef.current) {
          const p = project(toDevice(pose, spot.dir), tans);
          if (!p) continue;
          const s = videoToScreen(mapping, p);
          ctx.fillStyle = `rgba(255,197,61,${0.12 + 0.12 * pulse})`;
          ctx.beginPath(); ctx.arc(s.x, s.y, 20 + 3 * pulse, 0, Math.PI * 2); ctx.fill();
          ctx.setLineDash([4, 5]);
          ctx.lineDashOffset = -now / 60;
          ctx.strokeStyle = '#FFC53D'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(s.x, s.y, 12, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#FFC53D'; ctx.strokeStyle = '#2B2140'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      }

      if (phase === 'seek') {
        for (const f of fingers.current) {
          ctx.strokeStyle = f.pinched ? '#FFC53D' : 'rgba(255,255,255,.85)';
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(f.thumb.x, f.thumb.y); ctx.lineTo(f.index.x, f.index.y); ctx.stroke();
          for (const pt of [f.thumb, f.index]) {
            ctx.fillStyle = f.pinched ? '#FFC53D' : '#fff';
            ctx.beginPath(); ctx.arc(pt.x, pt.y, 10, 0, Math.PI * 2); ctx.fill();
          }
        }
        // Hints: a panned sound, then an arrow at the screen edge (spec 4.2).
        const stage = r.pausedAt !== null ? 0 : Math.max(hintStage(now, r.lastProgressAt ?? now, HINT_DELAY_MS), now < forcedHintUntil.current ? 2 : 0);
        const target = nearestUncaught(pose);
        if (stage >= 1 && target && now - lastHintSound.current > HINT_SOUND_EVERY_MS) {
          lastHintSound.current = now;
          play('hint', panFor(toDevice(pose, target)));
        }
        if (stage >= 2 && target) drawEdgeArrow(ctx, w, h, toDevice(pose, target), tans, mapping);
      }

      if (phase === 'results' && r.outcome === 'timeout') {
        // Time up: rings around the uncaught creatures, now drawn whole.
        const renderer = rendererRef.current;
        for (const c of renderer?.list ?? []) {
          if (!c.screen) continue;
          ctx.setLineDash([8, 6]);
          ctx.strokeStyle = '#FFC53D'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(c.screen.x, c.screen.y, c.screen.r * 1.35, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    };

    const nearestUncaught = (pose: ReturnType<typeof getOrientation>): Vec3 | null => {
      const r = useRound.getState().round;
      let best: { dir: Vec3; angle: number } | null = null;
      for (const c of r.creatures) {
        if (c.caughtAt !== null) continue;
        const d = toDevice(pose, c.dir);
        const angle = Math.acos(Math.max(-1, Math.min(1, -d[2] / Math.hypot(d[0], d[1], d[2]))));
        if (!best || angle < best.angle) best = { dir: c.dir, angle };
      }
      return best?.dir ?? null;
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // The loop reads live state through refs and the store; it must not restart on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncView]);

  // Test hook for browser tests with ?mock: where the creatures are on screen.
  useEffect(() => {
    if (!new URLSearchParams(location.search).has('mock')) return;
    const w = window as unknown as { __hidelings?: unknown };
    w.__hidelings = {
      creatures: () => rendererRef.current?.list.map(c => ({ id: c.id, species: c.species, screen: c.screen, visible: c.visible })) ?? [],
    };
    return () => { delete w.__hidelings; };
  }, [rendererRef]);

  // Clock and HUD refresh.
  useEffect(() => {
    const id = setInterval(() => setClock(formatClock(elapsedMs(useRound.getState().round, performance.now()))), 250);
    return () => clearInterval(id);
  }, []);

  // ---------- Transitions ----------

  const toCurtain = () => {
    pending.current.clear();
    apply(toHandover);
  };
  const openCurtain = () => {
    nearly.current = new NearlyFoundTracker();
    lastHintSound.current = 0;
    apply(toSeek);
  };
  const replayRound = () => {
    const renderer = rendererRef.current;
    renderer?.clear();
    setStills(new Map());
    setTimeUpSeen(false);
    apply(replay);
    const now = performance.now();
    for (const c of useRound.getState().round.creatures) renderer?.addCreature(c.dir, c.disp, c.up, c.species, now, c.id);
  };
  const hideAgain = () => {
    rendererRef.current?.clear();
    setStills(new Map());
    setTimeUpSeen(false);
    apply(() => newRound());
  };
  const endRound = () => {
    apply(r => giveUp(r, performance.now()));
    rendererRef.current?.reveal(useRound.getState().round.creatures.filter(c => c.caughtAt === null).map(c => c.id));
  };

  const copyReport = async () => {
    const json = JSON.stringify(buildReport({ round: { phase: round.phase, creatures: round.creatures.length } }), null, 2);
    try { await navigator.clipboard.writeText(json); flash(t.reportCopied, 1200); } catch { /* clipboard blocked */ }
  };

  const onTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (round.phase === 'hide') hideAt(x, y);
    else if (round.phase === 'seek') tryCatch(x, y, 'tap');
  };

  const paused = round.pausedAt !== null;
  const setPaused = (value: boolean) => apply(r => (value ? pause(r, performance.now()) : resume(r, performance.now())));
  const showResults = round.phase === 'results' && (round.outcome === 'all' || timeUpSeen);
  const hiddenCount = round.creatures.length;
  const left = remaining(round);

  return (
    <div className="stage">
      <video ref={videoRef} playsInline muted />
      <canvas ref={glRef} onPointerDown={onTap} />
      <canvas ref={overlayRef} style={{ pointerEvents: 'none' }} />

      {round.phase === 'hide' && (
        <>
          <div className="hud-top">
            <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <p className="pill" style={{ maxWidth: 240 }}>{hiddenCount ? t.hideHint : t.firstGame}</p>
              {hiddenCount > 0 && <span className="counter">{fill(t.hideCount, { n: hiddenCount })}</span>}
            </div>
          </div>
          <div className="hud-bottom">
            {sheet && (
              <div className="sheet">
                <label>
                  {t.language}
                  <span className="segmented" style={{ borderColor: '#fff' }}>
                    <button aria-pressed={lang === 'es'} onClick={() => setLang('es')}>ES</button>
                    <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
                  </span>
                </label>
                <div className="row">
                  <button className="btn" onClick={() => setSession({ phase: 'calibration' })}>{t.calibrate}</button>
                  <button className="btn" onClick={() => setSession({ phase: 'lab' })}>{t.lab}</button>
                </div>
                <div className="row">
                  <button className="btn" onClick={() => void copyReport()}>{t.report}</button>
                  <button className="btn" onClick={undo} disabled={!hiddenCount}>{t.hideUndo}</button>
                </div>
              </div>
            )}
            <div className="chips-bar" role="group">
              <button aria-pressed={choice === 'auto'} className="species-chip auto" onClick={() => setChoice('auto')}>{t.hideAuto}</button>
              {M3_SPECIES.map(id => (
                <button key={id} aria-pressed={choice === id} aria-label={SPECIES[id].name} className="species-chip" style={{ background: SPECIES[id].color }} onClick={() => setChoice(id)} />
              ))}
              <span className="chip-name">{choice === 'auto' ? '' : SPECIES[choice].name}</span>
            </div>
            <div className="row">
              <button className="btn btn-glass" aria-expanded={sheet} onClick={() => setSheet(s => !s)} aria-label={t.settings} style={{ flex: '0 0 56px', padding: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></svg>
              </button>
              <button className="btn" onClick={() => hideForMe(3)}>{t.hideForMe}</button>
              <button className="btn btn-primary" disabled={!hiddenCount} onClick={toCurtain}>{t.hideDone}</button>
            </div>
          </div>
        </>
      )}

      {round.phase === 'handover' && <Curtain count={hiddenCount} onOpen={openCurtain} />}

      {round.phase === 'seek' && (
        <>
          <div className="hud-top">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="pill timer">{clock}</span>
              <span className="counter">{hiddenCount - left} / {hiddenCount}</span>
            </div>
            <p className="pill" style={{ alignSelf: 'center' }}>{t.seekLook}</p>
          </div>
          <div className="hud-bottom">
            {paused && (
              <div className="sheet">
                <button className="btn btn-primary" onClick={() => setPaused(false)}>{t.resume}</button>
                <button className="btn" onClick={endRound}>{t.endRound}</button>
              </div>
            )}
            <div className="row">
              <button className="btn btn-glass" onClick={() => { forcedHintUntil.current = performance.now() + 5000; lastHintSound.current = 0; }}>{t.hint}</button>
              <button className={`btn ${handsState === 'on' ? 'btn-primary' : 'btn-glass'}`} aria-pressed={handsState === 'on'} disabled={handsState === 'loading'} onClick={() => void toggleHands()}>
                {handsState === 'loading' ? '…' : t.hands}
              </button>
              <button className="btn btn-glass" aria-pressed={paused} onClick={() => setPaused(!paused)}>{t.pause}</button>
            </div>
          </div>
        </>
      )}

      {round.phase === 'results' && round.outcome === 'timeout' && !timeUpSeen && (
        <>
          <div className="hud-top">
            <div className="card" style={{ border: '2px solid var(--ink)', background: 'var(--paper)', textAlign: 'center' }}>
              <h1 className="title">{t.timeUpTitle}</h1>
              <p style={{ margin: '6px 0 0', fontWeight: 700 }}>{fill(t.timeUpBody, { caught: hiddenCount - left, total: hiddenCount })}</p>
            </div>
          </div>
          <div className="hud-bottom">
            <button className="btn btn-primary btn-big" onClick={() => setTimeUpSeen(true)}>{t.seeResults}</button>
          </div>
        </>
      )}

      {showResults && (
        <div className="results-layer">
          <Results round={round} stills={stills} onReplay={replayRound} onHideAgain={hideAgain} />
        </div>
      )}

      {banner && <p className="toast">{banner}</p>}
      {handsState === 'loading' && round.phase === 'seek' && <p className="toast">{t.handsLoading}</p>}
    </div>
  );
}

/** Arrow at the screen edge pointing towards an off-screen or hard-to-see creature. */
function drawEdgeArrow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  deviceDir: Vec3,
  tans: ReturnType<typeof cameraTans>,
  mapping: ReturnType<typeof coverMapping>,
) {
  const p = project(deviceDir, tans);
  let ax: number, ay: number;
  if (p) {
    const s = videoToScreen(mapping, p);
    ax = s.x - w / 2;
    ay = s.y - h / 2;
  } else {
    ax = deviceDir[0];
    ay = -deviceDir[1];
  }
  const len = Math.hypot(ax, ay) || 1;
  ax /= len;
  ay /= len;
  // Point where the direction leaves a rectangle inset from the edges.
  const m = 36;
  const k = Math.min((w / 2 - m) / Math.abs(ax || 1e-6), (h / 2 - m - 60) / Math.abs(ay || 1e-6));
  const x = w / 2 + ax * k;
  const y = h / 2 + ay * k;
  const angle = Math.atan2(ay, ax);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(30,22,46,.74)';
  ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#FFC53D'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-6, -10); ctx.lineTo(8, 0); ctx.lineTo(-6, 10); ctx.stroke();
  ctx.restore();
}
