// M2 occlusion lab (spec 17, M2 acceptance): hide Pompón behind real furniture and watch the partial
// silhouette while turning slowly. Shows the visible fraction and the flicker rate, keeps M1's depth
// measurements and drift check, and copies everything into the report.
import { useEffect, useRef, useState } from 'react';
import { deleteModels } from '../../data/models';
import { fill } from '../../i18n/strings';
import { FlickerMeter, type PosedDepthMap } from '../../perception/depth/temporal';
import { DEPTH_SIZES, type DepthSize } from '../../perception/depth/types';
import { getOrientation, isOrientationActive, takeOrientationStats } from '../../perception/motion/orientation';
import { angleBetween, cameraTans, project, ray, toDevice, toWorld, type Vec3 } from '../../perception/motion/rotation';
import { coverMapping, screenToVideo } from '../../render/viewMapping';
import { buildReport, log, medianOf, record } from '../../app/report';
import { live } from '../../app/session';
import { useSession, useSettings, useT } from '../../app/store';
import { useDepthLoop } from '../stage/useDepthLoop';
import { useStage } from '../stage/useStage';

const MAX_CREATURES = 5;
type TapMode = 'hide' | 'mark' | 'measure';

export function Lab() {
  const t = useT();
  const { config, host, probe, motion, set } = useSession();
  const { fovDeg, lang, setLang, setDepthSize } = useSettings();
  const videoRef = useRef<HTMLVideoElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const depthCanvasRef = useRef<HTMLCanvasElement>(null);
  const { rendererRef, syncView } = useStage(videoRef, glRef);
  const flicker = useRef(new FlickerMeter());
  const markRef = useRef<{ dir: Vec3; at: number } | null>(null);
  const [showDepth, setShowDepth] = useState(false);
  const showDepthRef = useRef(showDepth);
  const [sheet, setSheet] = useState(false);
  const [mode, setMode] = useState<TapMode>('hide');
  const [hasMark, setHasMark] = useState(false);
  const [note, setNote] = useState('');
  const [toast, setToast] = useState('');
  const [stats, setStats] = useState({ gyroEvents: 0, gyroGap: 0, visible: null as number | null, flicker: 0, samples: 0 });

  useEffect(() => { showDepthRef.current = showDepth; }, [showDepth]);
  const { mapRef, fps } = useDepthLoop(videoRef, rendererRef, (map, video) => {
    if (showDepthRef.current) paintDepth(depthCanvasRef.current, map, video.videoWidth, video.videoHeight);
  });

  // Render loop, visibility and flicker.
  useEffect(() => {
    let raf = 0;
    const seen = new Map<number, number>();
    const frame = (now: number) => {
      const t0 = performance.now();
      const renderer = syncView();
      if (renderer) {
        renderer.render(getOrientation(), now);
        for (const c of renderer.list) {
          if (c.visible !== null && seen.get(c.id) !== c.measurements) {
            seen.set(c.id, c.measurements);
            flicker.current.add(c.id, c.visible);
          }
        }
      }
      record('render.frame', performance.now() - t0);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [syncView]);

  // HUD refresh once per second.
  useEffect(() => {
    const id = setInterval(() => {
      const { events, maxGapMs } = takeOrientationStats();
      if (isOrientationActive()) record('ori.maxGap', maxGapMs);
      const list = rendererRef.current?.list ?? [];
      const last = list.at(-1);
      setStats(s => ({
        ...s,
        gyroEvents: events,
        gyroGap: maxGapMs,
        visible: last?.visible ?? null,
        flicker: flicker.current.ratio,
        samples: flicker.current.samples,
      }));
    }, 1000);
    return () => clearInterval(id);
  }, [rendererRef]);

  const flash = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(''), 1600);
  };

  const onTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const video = videoRef.current;
    const renderer = rendererRef.current;
    if (!video || !renderer) return;
    const r = e.currentTarget.getBoundingClientRect();
    const view = coverMapping(r.width, r.height, video.videoWidth, video.videoHeight);
    const p = screenToVideo(view, e.clientX - r.left, e.clientY - r.top);
    const tans = cameraTans(fovDeg, video.videoWidth, video.videoHeight);
    const dir = toWorld(getOrientation(), ray(p, tans));

    if (mode === 'hide') {
      const map = mapRef.current;
      if (!map) return;
      const dp = project(toDevice(map.pose, dir), tans);
      if (!dp || dp.u < 0 || dp.u >= 1 || dp.v < 0 || dp.v >= 1) return;
      // Tapping just behind an object samples the far surface; sit slightly behind it, as in the PoC.
      const disp = Math.max(0.02, map.data[Math.floor(dp.v * map.height) * map.width + Math.floor(dp.u * map.width)]! - 0.02);
      if (renderer.list.length >= MAX_CREATURES) renderer.removeCreature(renderer.list[0]!.id);
      const c = renderer.addCreature(dir, disp, toWorld(getOrientation(), [0, 1, 0]));
      flicker.current.forget(c.id);
      log(`Hid Pompón at depth ${disp.toFixed(2)}`);
    } else if (mode === 'mark') {
      markRef.current = { dir, at: performance.now() };
      setHasMark(true);
      setMode('hide');
      setNote('');
      log('Drift mark set');
    } else if (markRef.current) {
      const deg = angleBetween(markRef.current.dir, dir);
      const min = (performance.now() - markRef.current.at) / 60000;
      record('drift.deg', deg);
      log(`Drift ${deg.toFixed(1)}° after ${min.toFixed(1)} min`);
      setNote(fill(t.driftResult, { deg: deg.toFixed(1), min: min.toFixed(1) }));
      setMode('hide');
    }
  };

  const changeSize = (size: DepthSize) => {
    setDepthSize(size);
    live.depth?.setSize(size);
    mapRef.current = null;
    if (config) set({ config: { ...config, size } });
    log(`Depth size ${size}`);
  };

  const copyReport = async () => {
    const video = videoRef.current;
    const report = buildReport({
      probe,
      depth: { ...config, host, fps: Number(fps.toFixed(1)) },
      camera: { width: video?.videoWidth, height: video?.videoHeight, fovDeg, calibrated: useSettings.getState().calibrated },
      orientation: { active: isOrientationActive(), eventsPerSecond: stats.gyroEvents, maxGapMs: Math.round(stats.gyroGap) },
      occlusion: {
        creatures: rendererRef.current?.list.length ?? 0,
        flickerRatio: Number(flicker.current.ratio.toFixed(3)),
        flickerSamples: flicker.current.samples,
      },
      online: navigator.onLine,
      standalone: matchMedia('(display-mode: standalone)').matches,
    });
    const json = JSON.stringify(report, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      flash(t.reportCopied);
    } catch {
      setNote(json);
    }
  };

  const m = (name: string) => medianOf(name) ?? '-';
  const pct = (v: number | null) => (v === null ? '-' : `${Math.round(v * 100)}%`);
  const help = mode === 'mark' ? t.driftHelpMark : mode === 'measure' ? t.driftHelpMeasure : t.labHint;

  return (
    <div className="stage">
      <video ref={videoRef} playsInline muted />
      <canvas ref={depthCanvasRef} hidden={!showDepth} style={{ opacity: 0.6, pointerEvents: 'none', objectFit: 'cover' }} />
      <canvas ref={glRef} onPointerDown={onTap} />

      <div className="hud-top">
        <div className="pill mono">
          {`${t.depthFps}: ${fps.toFixed(1)} fps · ${config?.size ?? '-'} px · ${config?.device ?? '-'} ${config?.dtype ?? ''} · ${host ? t.host[host] : '-'}\n`}
          {fill(t.breakdown, { grab: m('depth.grab'), prep: m('depth.prep'), model: m('depth.model'), post: m('depth.post'), cycle: m('depth.cycle') })}
          {`\n${t.gyro}: `}
          {isOrientationActive() ? fill(t.gyroValue, { events: stats.gyroEvents, gap: Math.round(stats.gyroGap) }) : t.gyroNone}
          {`\n${fill(t.labStats, { visible: pct(stats.visible), flicker: pct(stats.flicker), samples: stats.samples })}`}
        </div>
        {!motion && <div className="pill">{t.noMotion}</div>}
        <div className="pill">{help}</div>
        {note && <div className="pill mono" style={{ pointerEvents: 'auto', maxHeight: '40vh', overflow: 'auto' }}>{note}</div>}
      </div>

      <div className="hud-bottom">
        {sheet && (
          <div className="sheet">
            <label>
              {t.size}
              <select value={config?.size ?? 196} onChange={e => changeSize(Number(e.target.value) as DepthSize)}>
                {DEPTH_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>
              {t.language}
              <span className="segmented" style={{ borderColor: '#fff' }}>
                <button aria-pressed={lang === 'es'} onClick={() => setLang('es')}>ES</button>
                <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
              </span>
            </label>
            <div className="row">
              <button className="btn" aria-pressed={showDepth} onClick={() => setShowDepth(v => !v)}>{t.overlay}</button>
              <button className="btn" onClick={() => set({ phase: 'calibration' })}>{t.calibrate}</button>
            </div>
            <div className="row">
              <button className="btn" onClick={() => void copyReport()}>{t.report}</button>
              <button className="btn" onClick={() => void deleteModels().then(() => flash(t.modelsDeleted))}>{t.deleteModels}</button>
            </div>
          </div>
        )}
        <div className="row">
          <button className="btn btn-glass" onClick={() => { rendererRef.current?.clear(); flicker.current.reset(); }}>{t.clear}</button>
          <button
            className={`btn ${mode === 'hide' ? 'btn-glass' : 'btn-primary'}`}
            onClick={() => setMode(mode !== 'hide' ? 'hide' : hasMark ? 'measure' : 'mark')}
          >
            {mode !== 'hide' ? t.hide : hasMark ? t.driftMeasure : t.driftMark}
          </button>
          <button className="btn btn-glass" aria-expanded={sheet} onClick={() => setSheet(v => !v)}>{sheet ? t.close : t.settings}</button>
        </div>
      </div>
      {toast && <p className="toast">{toast}</p>}
    </div>
  );
}

const scratch = typeof document === 'undefined' ? null : document.createElement('canvas');

/**
 * Depth preview. The map covers the whole video frame (the model sees it squashed to a square), so it is
 * stretched back to the video's aspect ratio; CSS object-fit: cover then crops it exactly like the video.
 */
function paintDepth(canvas: HTMLCanvasElement | null, map: PosedDepthMap, videoWidth: number, videoHeight: number) {
  const ctx = canvas?.getContext('2d');
  const sctx = scratch?.getContext('2d');
  if (!canvas || !ctx || !scratch || !sctx || !videoWidth) return;
  scratch.width = map.width;
  scratch.height = map.height;
  const img = sctx.createImageData(map.width, map.height);
  for (let i = 0; i < map.data.length; i++) {
    const d = map.data[i]!;
    img.data[i * 4] = 40 + 215 * d;
    img.data[i * 4 + 1] = 60 + 150 * d;
    img.data[i * 4 + 2] = 140 - 100 * d;
    img.data[i * 4 + 3] = 255;
  }
  sctx.putImageData(img, 0, 0);
  const w = Math.round(videoWidth / 4);
  const h = Math.round(videoHeight / 4);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  ctx.drawImage(scratch, 0, 0, w, h);
}
