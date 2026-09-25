// Monocular depth with Depth Anything V2 Small (Apache 2.0) through Transformers.js.
// Output is relative inverse depth, normalized per frame to 0 (far) .. 1 (near).
import { TRANSFORMERS, runtime } from './runtime.js';

const { AutoModel, AutoProcessor, RawImage } = await import(TRANSFORMERS);

export const MODEL_ID = 'onnx-community/depth-anything-v2-small';
let model = null;
let processor = null;
let size = 252;

export async function load(initialSize) {
  size = initialSize;
  const dtype = runtime.device === 'webgpu' ? (runtime.f16 ? 'fp16' : 'fp32') : 'q8';
  processor = await AutoProcessor.from_pretrained(MODEL_ID);
  model = await AutoModel.from_pretrained(MODEL_ID, { device: runtime.device, dtype });
  applySize();
  return dtype;
}

function applySize() {
  const ip = processor.image_processor ?? processor.feature_extractor ?? processor;
  ip.size = { width: size, height: size };
  if ('keep_aspect_ratio' in ip) ip.keep_aspect_ratio = false;
}

export function setSize(s) {
  size = s;
  if (processor) applySize();
}

// Returns the normalized map plus a timing breakdown in ms:
// prep (resize and normalize the input), model (inference and readback), post (fp16 decode and normalization).
export async function estimate(imageData) {
  const t0 = performance.now();
  const image = new RawImage(imageData.data, imageData.width, imageData.height, 4).rgb();
  const inputs = await processor(image);
  const t1 = performance.now();
  const out = await model(inputs);
  const tensor = out.predicted_depth ?? Object.values(out)[0];
  const raw = tensor.data;
  const t2 = performance.now();
  const h = tensor.dims.at(-2);
  const w = tensor.dims.at(-1);
  const data = normalize(toFloat32(raw));
  const t3 = performance.now();
  return { w, h, data, timings: { prep: t1 - t0, model: t2 - t1, post: t3 - t2 } };
}

function halfToFloat(h) {
  const sign = h & 0x8000 ? -1 : 1;
  const exp = (h >> 10) & 0x1f;
  const frac = h & 0x3ff;
  if (exp === 0) return sign * 2 ** -14 * (frac / 1024);
  if (exp === 31) return frac ? NaN : sign * Infinity;
  return sign * 2 ** (exp - 15) * (1 + frac / 1024);
}

function toFloat32(data) {
  if (data instanceof Float32Array) return data;
  if (typeof Float16Array !== 'undefined' && data instanceof Float16Array) return Float32Array.from(data);
  if (data instanceof Uint16Array) {
    const out = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) out[i] = halfToFloat(data[i]);
    return out;
  }
  return Float32Array.from(data);
}

// Robust per-frame normalization using the 2nd and 98th percentiles.
function normalize(raw) {
  const n = raw.length;
  const stride = Math.max(1, Math.floor(n / 3000));
  const sample = [];
  for (let i = 0; i < n; i += stride) if (Number.isFinite(raw[i])) sample.push(raw[i]);
  sample.sort((a, b) => a - b);
  const lo = sample[Math.floor(sample.length * 0.02)] ?? 0;
  const hi = sample[Math.floor(sample.length * 0.98)] ?? 1;
  const span = hi - lo || 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = (raw[i] - lo) / span;
    out[i] = v < 0 ? 0 : v > 1 ? 1 : v;
  }
  return out;
}
