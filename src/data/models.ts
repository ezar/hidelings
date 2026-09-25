// Model catalog and cache management (spec 7.4, 13). Transformers.js keeps downloaded files in the
// Cache API under TRANSFORMERS_CACHE; we version that cache with MODEL_CATALOG_VERSION.
import type { DepthDtype } from '../perception/depth/types';

export const TRANSFORMERS_CACHE = 'transformers-cache';

/** Bump when a model id, revision or dtype changes, so old files are dropped on the next start. */
export const MODEL_CATALOG_VERSION = 1;

export const DEPTH_MODEL = {
  id: 'onnx-community/depth-anything-v2-small',
  revision: 'main',
  license: 'Apache-2.0',
  /** Approximate download per dtype, shown before downloading. Progress reports the exact total. */
  approxBytes: { fp16: 50e6, fp32: 99e6, q8: 27e6 } satisfies Record<DepthDtype, number>,
} as const;

const VERSION_KEY = 'hidelings.modelCatalogVersion';

function cacheAvailable() {
  return typeof caches !== 'undefined';
}

/** Deletes cached model files left by an older catalog version. */
export async function migrateModelCache(): Promise<void> {
  if (!cacheAvailable()) return;
  let stored: string | null = null;
  try { stored = localStorage.getItem(VERSION_KEY); } catch { /* storage blocked */ }
  if (stored !== null && Number(stored) !== MODEL_CATALOG_VERSION) await caches.delete(TRANSFORMERS_CACHE);
  try { localStorage.setItem(VERSION_KEY, String(MODEL_CATALOG_VERSION)); } catch { /* storage blocked */ }
}

/** Whether the depth model's weights for this dtype are already in the cache. */
export async function isDepthModelCached(dtype: DepthDtype): Promise<boolean> {
  if (!cacheAvailable()) return false;
  const cache = await caches.open(TRANSFORMERS_CACHE);
  const suffix = dtype === 'fp32' ? 'onnx/model.onnx' : dtype === 'fp16' ? 'onnx/model_fp16.onnx' : 'onnx/model_quantized.onnx';
  const keys = await cache.keys();
  return keys.some(k => k.url.includes(DEPTH_MODEL.id) && k.url.endsWith(suffix));
}

/** Total bytes of cached model files, when the browser exposes Content-Length. */
export async function cachedModelBytes(): Promise<number> {
  if (!cacheAvailable()) return 0;
  const cache = await caches.open(TRANSFORMERS_CACHE);
  let total = 0;
  for (const req of await cache.keys()) {
    const res = await cache.match(req);
    total += Number(res?.headers.get('content-length') ?? 0);
  }
  return total;
}

export async function deleteModels(): Promise<void> {
  if (cacheAvailable()) await caches.delete(TRANSFORMERS_CACHE);
}

/** Asks the browser not to evict the models under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / 1e6)} MB`;
}
