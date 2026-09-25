// M1 depth preview (spec 17, M1 acceptance): camera, live depth overlay, timings, gyroscope stats and a
// drift check that doubles as an anchoring test. Everything here is for measuring, not for players.
import { useEffect, useRef, useState } from 'react';
import { deleteModels } from '../../data/models';
import { fill } from '../../i18n/strings';
import { grabFrame } from '../../perception/depth/grab';
import { DEPTH_SIZES, type DepthMap, type DepthSize } from '../../perception/depth/types';
import { getOrientation, isOrientationActive, takeOrientationStats } from '../../perception/motion/orientation';
import { angleBetween, cameraTans, project, ray, toDevice, toWorld, type Vec3 } from '../../perception/motion/rotation';
import { coverMapping, screenToVideo, videoToScreen } from '../../render/viewMapping';
import { buildReport, log, medianOf, record } from '../../app/report';
import { live } from '../../app/session';
import { useSession, useSettings, useT } from '../../app/store';

interface Mark {
  dir: Vec3;
  at: number;
}

type DriftMode = 'idle' | 'mark' | 'measure';

export function DepthPreview() {
  const t = useT();
  const { config, host, probe, motion, set } = useSession();
  const { fovDeg, lang, setLang, setDepthSize } = useSettings();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<DepthMap | null>(null);
  const markRef = useRef<Mark | null>(null);
  const [showDepth, setShowDepth] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [driftMode, setDriftMode] = useState<DriftMode>('idle');
  const [driftText, setDriftText] = useState('');
  const [toast, setToast] = useState('');
  const [stats, setStats] = useState({ fps: 0, gyroEvents: 0, gyroGap: 0 });
  const [hasMark, setHasMark] = useState(false);
  const showDepthRef = useRef(showDepth);
  useEffect(() => { showDepthRef.current = showDepth; }, [showDepth]);

  // Camera
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !live.stream) return;
    video.srcObject = live.stream;
    video.play().catch(e => log(`Video play: ${String(e)}`));
  }, []);

  // Depth loop: one frame in flight at a time, as fast as the model allows.
  useEffect(() => {
    let running = true;
    let frames = 0;
    let windowStart = performance.now();
    (async () => {
      while (running) {
        const video = videoRef.current;
        const cycleStart = performance.now();
        const frame = video ? grabFrame(video) : null;
        if (!frame || !live.depth) {
          await new Promise(r => setTimeout(r, 50));
          continue;
        }
        record('depth.grab', performance.now() - cycleStart);
        const t0 = performance.now();
        try {
          const result = await live.depth.estimate(frame);
          mapRef.current = result;
          record('depth.prep', result.timings.prep);
          record('depth.model', result.timings.model);
          record('depth.post', result.timings.post);
        } catch (e) {
          if (!running) break;
          log(`Depth error: ${String(e)}`);
          await new Promise(r => setTimeout(r, 500));
          continue;
        }
        record('depth.infer', performance.now() - t0);
        record('depth.cycle', performance.now() - cycleStart);
        frames++;
        const elapsed = performance.now() - windowStart;
        if (elapsed >= 1000) {
          const fps = (frames * 1000) / elapsed;
          frames = 0;
          windowStart = performance.now();
          setStats(s => ({ ...s, fps }));
        }
      }
    })();
    return () => { running = false; };
  }, []);

  // Gyroscope stats once per second.
  useEffect(() => {
    const id = setInterval(() => {
      const { events, maxGapMs } = takeOrientationStats();
      if (isOrientationActive()) record('ori.maxGap', maxGapMs);
      setStats(s => ({ ...s, gyroEvents: events, gyroGap: maxGapMs }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Render loop: depth overlay and the drift mark, anchored with the gyroscope.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const depthCanvas = document.createElement('canvas');
    const dctx = depthCanvas.getContext('2d')!;
    let drawnMap: DepthMap | null = null;
    let raf = 0;

    const frame = () => {
      const video = videoRef.current;
      const dpr = Math.min(2, devicePixelRatio || 1);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      ctx.clearRect(0, 0, w, h);
      const view = coverMapping(w, h, video?.videoWidth ?? 0, video?.videoHeight ?? 0);

      const map = mapRef.current;
      if (showDepthRef.current && map) {
        if (map !== drawnMap) {
          paintDepth(dctx, depthCanvas, map);
          drawnMap = map;
        }
        ctx.globalAlpha = 0.6;
        ctx.drawImage(depthCanvas, view.offsetX, view.offsetY, view.videoWidth, view.videoHeight);
        ctx.globalAlpha = 1;
      }

      const mark = markRef.current;
      if (mark && video) {
        const tans = cameraTans(useSettings.getState().fovDeg, video.videoWidth, video.videoHeight);
        const p = project(toDevice(getOrientation(), mark.dir), tans);
        if (p) {
          const s = videoToScreen(view, p);
          ctx.lineWidth = 4 * dpr;
          ctx.strokeStyle = '#FFC53D';
          ctx.beginPath();
          ctx.arc(s.x, s.y, 22 * dpr, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#FFC53D';
          ctx.beginPath();
          ctx.arc(s.x, s.y, 5 * dpr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const flash = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(''), 1600);
  };

  const onTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const video = videoRef.current;
    if (driftMode === 'idle' || !video) return;
    const r = e.currentTarget.getBoundingClientRect();
    const view = coverMapping(r.width, r.height, video.videoWidth, video.videoHeight);
    const p = screenToVideo(view, e.clientX - r.left, e.clientY - r.top);
    const dir = toWorld(getOrientation(), ray(p, cameraTans(fovDeg, video.videoWidth, video.videoHeight)));
    if (driftMode === 'mark') {
      markRef.current = { dir, at: performance.now() };
      setHasMark(true);
      setDriftMode('measure');
      setDriftText('');
      log('Drift mark set');
    } else if (markRef.current) {
      const deg = angleBetween(markRef.current.dir, dir);
      const min = (performance.now() - markRef.current.at) / 60000;
      record('drift.deg', deg);
      log(`Drift ${deg.toFixed(1)}° after ${min.toFixed(1)} min`);
      setDriftText(fill(t.driftResult, { deg: deg.toFixed(1), min: min.toFixed(1) }));
      setDriftMode('idle');
    }
  };

  const changeSize = (size: DepthSize) => {
    setDepthSize(size);
    live.depth?.setSize(size);
    if (config) set({ config: { ...config, size } });
    log(`Depth size ${size}`);
  };

  const copyReport = async () => {
    const video = videoRef.current;
    const report = buildReport({
      probe,
      depth: { ...config, host, fps: Number(stats.fps.toFixed(1)) },
      camera: { width: video?.videoWidth, height: video?.videoHeight, fovDeg },
      orientation: { active: isOrientationActive(), eventsPerSecond: stats.gyroEvents, maxGapMs: Math.round(stats.gyroGap) },
      online: navigator.onLine,
      standalone: matchMedia('(display-mode: standalone)').matches,
    });
    const json = JSON.stringify(report, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      flash(t.reportCopied);
    } catch {
      setDriftText(json);
    }
  };

  const m = (name: string) => medianOf(name) ?? '-';

  return (
    <div className="stage">
      <video ref={videoRef} playsInline muted />
      <canvas ref={canvasRef} onPointerDown={onTap} />

      <div className="hud-top">
        <div className="pill mono">
          {`${t.depthFps}: ${stats.fps.toFixed(1)} fps · ${config?.size ?? '-'} px · ${config?.device ?? '-'} ${config?.dtype ?? ''} · ${host ? t.host[host] : '-'}\n`}
          {fill(t.breakdown, { grab: m('depth.grab'), prep: m('depth.prep'), model: m('depth.model'), post: m('depth.post'), cycle: m('depth.cycle') })}
          {`\n${t.gyro}: `}
          {isOrientationActive() ? fill(t.gyroValue, { events: stats.gyroEvents, gap: Math.round(stats.gyroGap) }) : t.gyroNone}
        </div>
        {!motion && <div className="pill">{t.noMotion}</div>}
        {driftMode !== 'idle' && <div className="pill">{driftMode === 'mark' ? t.driftHelpMark : t.driftHelpMeasure}</div>}
        {driftText && <div className="pill mono" style={{ pointerEvents: 'auto', maxHeight: '40vh', overflow: 'auto' }}>{driftText}</div>}
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
              <button className="btn" onClick={() => void copyReport()}>{t.report}</button>
              <button className="btn" onClick={() => void deleteModels().then(() => flash(t.modelsDeleted))}>{t.deleteModels}</button>
            </div>
          </div>
        )}
        <div className="row">
          <button className="btn btn-glass" aria-pressed={showDepth} onClick={() => setShowDepth(v => !v)}>{t.overlay}</button>
          <button
            className={`btn ${driftMode === 'idle' ? 'btn-glass' : 'btn-primary'}`}
            onClick={() => setDriftMode(hasMark && driftMode === 'idle' ? 'measure' : 'mark')}
          >
            {hasMark && driftMode !== 'mark' ? t.driftMeasure : t.driftMark}
          </button>
          <button className="btn btn-glass" aria-expanded={sheet} onClick={() => setSheet(v => !v)}>{sheet ? t.close : t.settings}</button>
        </div>
      </div>
      {toast && <p className="toast">{toast}</p>}
    </div>
  );
}

function paintDepth(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, map: DepthMap) {
  if (canvas.width !== map.width) canvas.width = map.width;
  if (canvas.height !== map.height) canvas.height = map.height;
  const img = ctx.createImageData(map.width, map.height);
  for (let i = 0; i < map.data.length; i++) {
    const d = map.data[i]!;
    img.data[i * 4] = 40 + 215 * d;
    img.data[i * 4 + 1] = 60 + 150 * d;
    img.data[i * 4 + 2] = 140 - 100 * d;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
