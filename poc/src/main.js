// Hidelings M0: creatures that hide behind real objects, in Safari on iPhone.
// Depth Anything gives per-pixel relative depth, the gyroscope anchors creatures in space (3DoF),
// and MediaPipe hands let players catch them with a pinch.
import { probeDevice, runtime } from './runtime.js';
import { initLog, log, record, timed, median, buildReport } from './report.js';
import * as ori from './orientation.js';
import * as H from './hidelings.js';

const $ = id => document.getElementById(id);
const video = $('video');
const overlay = $('overlay');
const ctx = overlay.getContext('2d');
const grab = document.createElement('canvas');
const gctx = grab.getContext('2d', { willReadFrequently: true });
const inset = document.createElement('canvas');
const ictx = inset.getContext('2d');

let depth = null; // module, loaded lazily so the intro renders fast
let hands = null;

const state = {
  started: false,
  mode: 'hide', // 'hide' or 'seek'
  fovDeg: 64,
  depthSize: 252,
  showDepth: false,
  handsOn: false,
  depthMap: null, // { w, h, data, M }
  depthFps: 0,
  oriRate: 0,
  oriMaxGap: 0,
  hidelings: [],
  seekStart: 0,
  pinching: false,
  handPoints: [],
  frameNo: 0,
  probe: null,
  dtype: null,
};

initLog($('log'));

// Camera geometry.
function tans() {
  const vw = video.videoWidth || 1;
  const vh = video.videoHeight || 1;
  const t = Math.tan((state.fovDeg * Math.PI) / 360);
  return vw >= vh ? { tx: t, ty: (t * vh) / vw } : { ty: t, tx: (t * vw) / vh };
}

// Maps normalized video coordinates to canvas pixels, matching object-fit: cover.
function getView() {
  const W = overlay.width;
  const Hh = overlay.height;
  const vw = video.videoWidth || W;
  const vh = video.videoHeight || Hh;
  const scale = Math.max(W / vw, Hh / vh);
  const dispW = vw * scale;
  const dispH = vh * scale;
  return { W, H: Hh, dispW, dispH, offX: (W - dispW) / 2, offY: (Hh - dispH) / 2 };
}

function resizeOverlay() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = Math.round(overlay.clientWidth * dpr);
  const h = Math.round(overlay.clientHeight * dpr);
  if (overlay.width !== w || overlay.height !== h) {
    overlay.width = w;
    overlay.height = h;
  }
}

const canvasToVideo = (x, y, view) => ({ u: (x - view.offX) / view.dispW, v: (y - view.offY) / view.dispH });

// Start: permissions, camera, depth model.
$('btn-start').addEventListener('click', async () => {
  const btn = $('btn-start');
  btn.disabled = true;
  const status = $('intro-status');
  try {
    const oriOk = await ori.enable(); // first await: must stay inside the tap gesture on iOS
    log(`Orientation: ${oriOk ? 'enabled' : 'unavailable'}`);
    status.textContent = 'Abriendo la cámara…';
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    log(`Camera ${video.videoWidth}x${video.videoHeight}`);

    status.textContent = 'Analizando el dispositivo…';
    state.probe = await probeDevice();
    log(`Runtime: ${runtime.device}${runtime.f16 ? ' + fp16' : ''}`);

    status.textContent = 'Cargando el modelo de profundidad (unos 50 MB la primera vez)…';
    depth = await import('./depth.js');
    state.dtype = await timed('load.depth', () => depth.load(state.depthSize));

    $('intro').hidden = true;
    $('hud').hidden = false;
    $('bar').hidden = false;
    state.started = true;
    updateHud();
    depthLoop();
    requestAnimationFrame(frame);
    setInterval(updateStats, 1000);
    if (!oriOk) flash('Sin giroscopio: las criaturas se quedarán fijas en la pantalla', 3000);
  } catch (e) {
    status.textContent = `No se ha podido empezar: ${e.message}`;
    log(`Start error: ${e.message}`);
    btn.disabled = false;
  }
});

// Depth runs in its own loop, as fast as the device allows.
async function depthLoop() {
  let frames = 0;
  let windowStart = performance.now();
  for (;;) {
    if (!video.videoWidth) { await sleep(100); continue; }
    const M = ori.getMatrix().slice();
    const w = 320;
    const h = Math.round((w * video.videoHeight) / video.videoWidth);
    const cycleStart = performance.now();
    grab.width = w;
    grab.height = h;
    gctx.drawImage(video, 0, 0, w, h);
    const t = performance.now();
    try {
      const pixels = gctx.getImageData(0, 0, w, h);
      record('depth.grab', performance.now() - cycleStart, true);
      const map = await depth.estimate(pixels);
      state.depthMap = { ...map, M };
      record('depth.prep', map.timings.prep, true);
      record('depth.model', map.timings.model, true);
      record('depth.post', map.timings.post, true);
      if (state.showDepth) drawInset(map);
    } catch (e) {
      log(`Depth error: ${e.message}`);
      flash('El modelo de profundidad ha fallado. Mira el registro en Ajustes.', 4000);
      return;
    }
    record('depth.infer', performance.now() - t, true);
    frames++;
    const elapsed = performance.now() - windowStart;
    if (elapsed > 1000) {
      state.depthFps = (frames * 1000) / elapsed;
      frames = 0;
      windowStart = performance.now();
    }
    await new Promise(requestAnimationFrame);
    record('depth.cycle', performance.now() - cycleStart, true);
  }
}

// Render loop: camera is the live video element; the canvas draws creatures, hands and the depth inset.
function frame(now) {
  const t0 = performance.now();
  resizeOverlay();
  const view = getView();
  ctx.clearRect(0, 0, view.W, view.H);
  const { tx, ty } = tans();
  const M = ori.getMatrix();
  const dm = state.depthMap;

  for (const h of state.hidelings) {
    if (h.gone) continue;
    const p = ori.project(ori.toDevice(M, h.dir), tx, ty);
    if (!p) { h.screen = null; continue; }
    const dp = dm ? ori.project(ori.toDevice(dm.M, h.dir), tx, ty) : null;
    H.render(ctx, h, p, dp, dm, view, now);
  }

  if (state.handsOn && hands?.isReady() && video.readyState >= 2) {
    if (state.frameNo % 2 === 0) {
      const t = performance.now();
      try {
        state.handPoints = hands.detect(video);
      } catch (e) {
        log(`Hands error: ${e.message}`);
        state.handsOn = false;
      }
      record('hands.detect', performance.now() - t, true);
    }
    handleHands(view);
  }

  if (state.showDepth && dm) {
    const iw = view.W * 0.3;
    const ih = iw * (view.dispH / view.dispW);
    ctx.globalAlpha = 0.85;
    ctx.drawImage(inset, view.W - iw - 12, view.H * 0.12, iw, ih);
    ctx.globalAlpha = 1;
  }

  state.frameNo++;
  record('render.frame', performance.now() - t0, true);
  requestAnimationFrame(frame);
}

function handleHands(view) {
  let pinchAt = null;
  for (const hand of state.handPoints) {
    const thumb = hand[4];
    const index = hand[8];
    if (!thumb || !index) continue;
    const a = { x: view.offX + thumb.x * view.dispW, y: view.offY + thumb.y * view.dispH };
    const b = { x: view.offX + index.x * view.dispW, y: view.offY + index.y * view.dispH };
    const pinched = Math.hypot(a.x - b.x, a.y - b.y) < Math.min(view.W, view.H) * 0.06;
    ctx.fillStyle = pinched ? '#ffd23f' : 'rgba(238,243,248,.85)';
    for (const pt of [a, b]) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    if (pinched) pinchAt = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  if (pinchAt && !state.pinching && state.mode === 'seek') tryCatch(pinchAt.x, pinchAt.y, 'pinch');
  state.pinching = !!pinchAt;
}

// Placing creatures.
function placeAt(u, v) {
  const { tx, ty } = tans();
  const dir = ori.toWorld(ori.getMatrix(), ori.ray(u, v, tx, ty));
  let disp = 0.5;
  const dm = state.depthMap;
  if (dm) {
    const dp = ori.project(ori.toDevice(dm.M, dir), tx, ty);
    const s = dp ? H.sampleDepth(dm, dp.u, dp.v) : -1;
    if (s >= 0) disp = s - 0.02;
  }
  state.hidelings.push(H.create(dir, disp));
  log(`Placed creature at depth ${disp.toFixed(2)}`);
  updateHud();
}

function autoHide(n) {
  const dm = state.depthMap;
  if (!dm) { flash('Aún no hay mapa de profundidad', 1500); return; }
  const { tx, ty } = tans();
  const spots = H.findHidingSpots(dm, n);
  for (const s of spots) {
    const dir = ori.toWorld(dm.M, ori.ray(s.u, s.v, tx, ty));
    state.hidelings.push(H.create(dir, s.disp - 0.02));
  }
  log(`Auto hide: ${spots.length} spots found`);
  if (spots.length < n) {
    flash(spots.length ? `Solo he encontrado ${spots.length} escondites aquí. Prueba en otra zona.` : 'No veo escondites. Apunta a muebles con fondo detrás.', 2500);
  }
  updateHud();
}

function tryCatch(x, y, how) {
  const target = state.hidelings
    .filter(h => !h.gone && !h.caughtAt && h.screen)
    .map(h => ({ h, d: Math.hypot(h.screen.x - x, h.screen.y - y) }))
    .filter(({ h, d }) => d < h.screen.r * 1.15 && h.visible > 0.12)
    .sort((a, b) => a.d - b.d)[0];
  if (!target) return;
  target.h.caughtAt = performance.now();
  log(`Caught by ${how} (visible ${Math.round(target.h.visible * 100)}%)`);
  navigator.vibrate?.(40);
  updateHud();
  const left = remaining();
  if (left === 0) {
    const secs = Math.round((performance.now() - state.seekStart) / 1000);
    record('game.seekSeconds', secs * 1000);
    setTimeout(() => flash(`¡Todas encontradas en ${secs} s!`, 3500), 450);
  }
}

const remaining = () => state.hidelings.filter(h => !h.gone && !h.caughtAt).length;

overlay.addEventListener('pointerdown', e => {
  if (!state.started) return;
  const r = overlay.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * overlay.width;
  const y = ((e.clientY - r.top) / r.height) * overlay.height;
  if (state.mode === 'hide') {
    const { u, v } = canvasToVideo(x, y, getView());
    if (u >= 0 && u <= 1 && v >= 0 && v <= 1) placeAt(u, v);
  } else {
    tryCatch(x, y, 'tap');
  }
});

// Controls.
$('btn-auto').addEventListener('click', () => autoHide(5));

$('btn-mode').addEventListener('click', () => {
  if (state.mode === 'hide') {
    if (!remaining()) { flash('Primero esconde alguna criatura', 1500); return; }
    state.mode = 'seek';
    state.seekStart = performance.now();
  } else {
    state.mode = 'hide';
  }
  updateHud();
});

$('btn-hands').addEventListener('click', async () => {
  const btn = $('btn-hands');
  if (state.handsOn) {
    state.handsOn = false;
    btn.setAttribute('aria-pressed', 'false');
    return;
  }
  btn.disabled = true;
  try {
    if (!hands) {
      flash('Cargando el modelo de manos…', 1500);
      hands = await import('./hands.js');
      await timed('load.hands', () => hands.load());
    }
    state.handsOn = true;
    btn.setAttribute('aria-pressed', 'true');
  } catch (e) {
    log(`Hands load error: ${e.message}`);
    flash('No se ha podido cargar el modelo de manos', 2500);
  } finally {
    btn.disabled = false;
  }
});

$('btn-settings').addEventListener('click', () => {
  const sheet = $('sheet');
  sheet.hidden = !sheet.hidden;
  $('btn-settings').setAttribute('aria-expanded', String(!sheet.hidden));
});

$('depth-size').addEventListener('change', e => {
  state.depthSize = Number(e.target.value);
  depth?.setSize(state.depthSize);
  log(`Depth size ${state.depthSize}`);
});

$('fov').addEventListener('input', e => {
  state.fovDeg = Number(e.target.value);
  $('fov-out').textContent = `${state.fovDeg}°`;
});

$('show-depth').addEventListener('change', e => { state.showDepth = e.target.checked; });

$('btn-reset').addEventListener('click', () => {
  state.hidelings = [];
  state.mode = 'hide';
  updateHud();
});

$('btn-report').addEventListener('click', async () => {
  const report = buildReport({
    probe: state.probe,
    depth: { model: depth?.MODEL_ID, dtype: state.dtype, size: state.depthSize, fps: Number(state.depthFps.toFixed(1)) },
    camera: { width: video.videoWidth, height: video.videoHeight, fovDeg: state.fovDeg },
    orientation: { active: ori.isActive(), eventsPerSecond: state.oriRate, maxGapMs: Math.round(state.oriMaxGap) },
    hands: state.handsOn,
    creatures: state.hidelings.length,
  });
  const json = JSON.stringify(report, null, 2);
  try {
    await navigator.clipboard.writeText(json);
    flash('Informe copiado', 1200);
  } catch {
    $('log').textContent = json;
  }
});

// HUD, stats, helpers.
function updateHud() {
  const total = state.hidelings.filter(h => !h.gone || h.caughtAt).length;
  const left = remaining();
  const count = $('hud-count');
  if (state.mode === 'hide') {
    $('hud-text').textContent = 'Toca justo detrás de un mueble para esconder una criatura, o pulsa Esconder 5. Luego pasa el móvil y pulsa Buscar.';
    $('btn-mode').textContent = 'Buscar';
    count.hidden = !left;
    count.textContent = `${left} escondidas`;
  } else {
    $('hud-text').textContent = state.handsOn
      ? 'Busca a las criaturas. Tócalas o pellízcalas con los dedos delante de la cámara.'
      : 'Busca a las criaturas y tócalas cuando asomen.';
    $('btn-mode').textContent = 'Esconder';
    count.hidden = false;
    count.textContent = `${total - left} / ${total}`;
  }
}

function updateStats() {
  state.oriRate = ori.takeEventCount();
  state.oriMaxGap = ori.takeMaxGap();
  if (ori.isActive()) record('ori.maxGap', state.oriMaxGap, true);
  const landscape = innerWidth > innerHeight;
  if (landscape && state.started) flash('Pon el móvil en vertical', 1200);
  $('stats').textContent = [
    `Profundidad: ${state.depthFps.toFixed(1)} fps, ${median('depth.infer') ?? '-'} ms (${runtime.device}, ${state.dtype ?? '-'}, ${state.depthSize}px)`,
    `  captura ${median('depth.grab') ?? '-'} · prep ${median('depth.prep') ?? '-'} · modelo ${median('depth.model') ?? '-'} · post ${median('depth.post') ?? '-'} · ciclo ${median('depth.cycle') ?? '-'} ms`,
    `Pintado: ${median('render.frame') ?? '-'} ms por fotograma`,
    `Manos: ${state.handsOn ? `${median('hands.detect') ?? '-'} ms` : 'apagadas'}`,
    `Giroscopio: ${ori.isActive() ? `${state.oriRate} eventos/s, hueco máx ${Math.round(state.oriMaxGap)} ms` : 'sin datos'}`,
    `Criaturas: ${state.hidelings.filter(h => !h.gone).length}`,
  ].join('\n');
}

function drawInset(map) {
  inset.width = map.w;
  inset.height = map.h;
  const img = ictx.createImageData(map.w, map.h);
  for (let i = 0; i < map.data.length; i++) {
    const d = map.data[i];
    img.data[i * 4] = 40 + 215 * d;
    img.data[i * 4 + 1] = 60 + 150 * d;
    img.data[i * 4 + 2] = 140 - 100 * d;
    img.data[i * 4 + 3] = 255;
  }
  ictx.putImageData(img, 0, 0);
}

let flashTimer = 0;
function flash(text, ms) {
  const b = $('banner');
  b.textContent = text;
  b.hidden = false;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { b.hidden = true; }, ms);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

window.addEventListener('error', e => log(`Unhandled: ${e.message}`));
window.addEventListener('unhandledrejection', e => log(`Unhandled: ${e.reason?.message ?? e.reason}`));
log('Ready');
