# 0002: M1 runtime choices

Date: 2026-09-25. Status: accepted.

## Context

M1 builds the app's foundations (spec section 17). Three choices came up that the spec leaves open.

## Decisions

### Depth runs in a module worker, with a main-thread fallback

ADR 0001 showed that heavy depth frames starve the gyroscope on the main thread, so the model runs in a Web Worker (`src/perception/depth/depth.worker.ts`). The worker checks WebGPU for itself: some WebKit builds expose WebGPU to windows but not to workers. When the page has WebGPU and the worker does not, `DepthService` runs the same engine on the main thread and the debug HUD shows "hilo principal". Frames go to the worker as transferred pixel buffers (320 px wide, about 5 ms to grab); depth maps come back the same way.

### ONNX Runtime WASM is served from our own origin

Transformers.js loads ONNX Runtime's `.wasm` and `.mjs` from jsDelivr by default. The build copies them to `ort/` and `setLocalRuntime()` points ONNX Runtime there, so the service worker precaches them and the model works after an offline reload. Model weights stay in Transformers.js's own Cache API store (`transformers-cache`), versioned by `MODEL_CATALOG_VERSION` in `src/data/models.ts`.

The precache is about 23 MB (the 21.6 MB WASM file plus the app). The model itself is about 50 MB at fp16 and downloads on first start.

### Settings in localStorage until there is real data

The spec puts settings, calibrations and the collection in IndexedDB with Dexie (section 11). M1 only stores three settings (language, depth size, field of view), so they live in `localStorage` through Zustand's `persist`. Dexie arrives with the first real data (calibrations in M2, the collection in M4).

## Consequences

- The first launch benchmarks the model at 196 px on camera frames and keeps 252 only if it would still reach 8 fps (`chooseDepthSize`). On the M0 iPhone (97 ms at 196) it stays at 196.
- `?mock` in the URL swaps the model for a synthetic depth engine, for desktop work and browser tests without the download.
