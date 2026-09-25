// Creatures: creation, procedural drawing, depth-based occlusion and hiding-spot search.
const COLORS = ['#7be0ad', '#b69cff', '#ffb38a', '#7cc6fe', '#ff8fb8', '#f6e27a'];
const MARGIN = 0.04; // how much closer the scene must be to hide a creature pixel
const SOFT = 0.03; // half width of the soft occlusion edge

const sprite = document.createElement('canvas');
const sctx = sprite.getContext('2d', { willReadFrequently: true });
const temp = document.createElement('canvas');
const tctx = temp.getContext('2d');

let nextId = 1;

export function create(dir, disp) {
  return {
    id: nextId++,
    dir, // world-space direction of its anchor
    disp: Math.min(0.98, Math.max(0.02, disp)), // normalized inverse depth where it sits
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    seed: Math.random(),
    visible: 1, // fraction of the sprite not occluded, updated every frame
    screen: null, // { x, y, r } in canvas pixels while on screen
    caughtAt: 0,
    gone: false,
  };
}

export function sampleDepth(dm, u, v) {
  if (!dm || u < 0 || u >= 1 || v < 0 || v >= 1) return -1;
  return dm.data[Math.floor(v * dm.h) * dm.w + Math.floor(u * dm.w)];
}

// Looks for far points right next to a much nearer object: the edge of a sofa, a chair leg, a door frame.
export function findHidingSpots(dm, n) {
  const { w, h, data } = dm;
  const k = Math.max(3, Math.round(w * 0.04));
  const probes = [[k, 0], [-k, 0], [0, k], [k, k], [-k, k], [0, -k]];
  const candidates = [];
  for (let i = 0; i < 1800; i++) {
    const x = Math.floor(w * (0.1 + 0.8 * Math.random()));
    const y = Math.floor(h * (0.15 + 0.7 * Math.random()));
    const d = data[y * w + x];
    if (d > 0.75) continue;
    let best = 0;
    for (const [dx, dy] of probes) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      best = Math.max(best, data[yy * w + xx] - d);
    }
    if (best > 0.18) candidates.push({ u: (x + 0.5) / w, v: (y + 0.5) / h, disp: d, score: best });
  }
  candidates.sort((a, b) => b.score - a.score);
  const picked = [];
  for (const c of candidates) {
    if (picked.every(p => Math.hypot(p.u - c.u, p.v - c.v) > 0.18)) picked.push(c);
    if (picked.length >= n) break;
  }
  return picked;
}

// p: current projection in normalized video coords. dp: projection in the frame the depth map came from.
// view: { W, H, offX, offY, dispW, dispH } maps normalized video coords to canvas pixels (object-fit: cover).
export function render(ctx, h, p, dp, dm, view, now) {
  const cx = view.offX + p.u * view.dispW;
  const cy = view.offY + p.v * view.dispH;
  let r = Math.min(view.W, view.H) * 0.075 * (0.7 + 0.6 * h.disp);
  let alpha = 1;
  if (h.caughtAt) {
    const t = (now - h.caughtAt) / 450;
    if (t >= 1) { h.gone = true; h.screen = null; return; }
    r *= 1 + t * 0.8;
    alpha = 1 - t;
  }
  const size = Math.ceil(r * (h.caughtAt ? 3.8 : 2.6));
  const x0 = Math.round(cx - size / 2);
  const y0 = Math.round(cy - size / 2);
  h.screen = { x: cx, y: cy, r };
  if (x0 > view.W || y0 > view.H || x0 + size < 0 || y0 + size < 0) { h.screen = null; return; }

  sprite.width = size;
  sprite.height = size;
  drawCreature(sctx, size / 2, size / 2, r, h, now);
  if (h.caughtAt) drawSparkles(sctx, size / 2, size / 2, r, (now - h.caughtAt) / 450);

  if (!dm || !dp || h.caughtAt) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x0, y0);
    ctx.globalAlpha = 1;
    return;
  }

  // Per-pixel occlusion: hide sprite pixels where the real scene is nearer than the creature.
  const img = sctx.getImageData(0, 0, size, size);
  const px = img.data;
  const du = dp.u - p.u;
  const dv = dp.v - p.v;
  const edge = h.disp + MARGIN;
  let total = 0, shown = 0;
  for (let j = 0; j < size; j++) {
    const v = (y0 + j - view.offY) / view.dispH + dv;
    const row = v < 0 || v >= 1 ? -1 : Math.floor(v * dm.h) * dm.w;
    for (let i = 0; i < size; i++) {
      const ai = (j * size + i) * 4 + 3;
      const a = px[ai];
      if (!a) continue;
      total += a;
      const u = (x0 + i - view.offX) / view.dispW + du;
      if (row < 0 || u < 0 || u >= 1) { shown += a; continue; }
      const s = dm.data[row + Math.floor(u * dm.w)];
      let f;
      if (s <= edge - SOFT) f = 1;
      else if (s >= edge + SOFT) f = 0;
      else f = (edge + SOFT - s) / (2 * SOFT);
      const na = a * f;
      px[ai] = na;
      shown += na;
    }
  }
  h.visible = total ? shown / total : 0;
  temp.width = size;
  temp.height = size;
  tctx.putImageData(img, 0, 0);
  ctx.drawImage(temp, x0, y0);
}

// An original fuzzy round creature with big eyes. Procedural, no assets.
function drawCreature(c, x, y, r, h, now) {
  const t = now / 1000 + h.seed * 10;
  y += Math.sin(t * 2.2) * r * 0.06;

  c.fillStyle = h.color;
  c.beginPath();
  const tufts = 22;
  for (let i = 0; i <= tufts * 2; i++) {
    const a = (i / (tufts * 2)) * Math.PI * 2;
    const rr = r * (i % 2 ? 0.92 : 1.03 + 0.03 * Math.sin(t * 3 + i));
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr * 0.95;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
  c.fill();

  c.fillStyle = 'rgba(255,255,255,.2)';
  c.beginPath();
  c.ellipse(x, y + r * 0.32, r * 0.55, r * 0.38, 0, 0, Math.PI * 2);
  c.fill();

  const blink = Math.sin(t * 0.9 + h.seed * 7) > 0.985 ? 0.12 : 1;
  const lookX = Math.sin(t * 0.7) * r * 0.06;
  const lookY = Math.cos(t * 0.5) * r * 0.04;
  for (const side of [-1, 1]) {
    const ex = x + side * r * 0.36;
    const ey = y - r * 0.15;
    c.fillStyle = '#fff';
    c.beginPath();
    c.ellipse(ex, ey, r * 0.24, r * 0.28 * blink, 0, 0, Math.PI * 2);
    c.fill();
    if (blink > 0.5) {
      c.fillStyle = '#10161f';
      c.beginPath();
      c.arc(ex + lookX, ey + lookY, r * 0.12, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(ex + lookX + r * 0.04, ey + lookY - r * 0.05, r * 0.04, 0, Math.PI * 2);
      c.fill();
    }
  }

  c.fillStyle = 'rgba(255,120,150,.55)';
  for (const side of [-1, 1]) {
    c.beginPath();
    c.ellipse(x + side * r * 0.6, y + r * 0.12, r * 0.12, r * 0.07, 0, 0, Math.PI * 2);
    c.fill();
  }

  c.fillStyle = '#10161f';
  c.beginPath();
  c.ellipse(x, y + r * 0.18, r * 0.09, r * 0.07 + Math.abs(Math.sin(t * 1.3)) * r * 0.04, 0, 0, Math.PI * 2);
  c.fill();
}

function drawSparkles(c, x, y, r, t) {
  c.fillStyle = '#ffd23f';
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const d = r * (0.8 + t * 0.9);
    c.beginPath();
    c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.08 * (1 - t), 0, Math.PI * 2);
    c.fill();
  }
}
