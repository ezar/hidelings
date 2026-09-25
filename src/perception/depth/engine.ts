// Depth Anything V2 Small through Transformers.js (spec 7.1). Runs in the depth worker, or on the
// main thread when the worker cannot reach WebGPU.
import { AutoModel, AutoProcessor, RawImage, env } from '@huggingface/transformers';
import { DEPTH_MODEL } from '../../data/models';
import { normalizeDepth, toFloat32 } from './normalize';
import type { DepthConfig, DepthEngine, DepthResult, DepthSize, FramePixels, LoadProgress } from './types';

interface ProgressEvent {
  status: string;
  file?: string;
  loaded?: number;
  total?: number;
}

interface ImageProcessorLike {
  size?: unknown;
  keep_aspect_ratio?: boolean;
}

/** Points ONNX Runtime at the WASM files we serve ourselves, so they are precached for offline use. */
export function setLocalRuntime(baseUrl: string) {
  const onnx = env.backends.onnx as { wasm?: { wasmPaths?: string } };
  if (onnx.wasm) onnx.wasm.wasmPaths = new URL('ort/', baseUrl).href;
}

export async function createDepthEngine(
  config: DepthConfig,
  onProgress?: (p: LoadProgress) => void,
): Promise<DepthEngine> {
  const files = new Map<string, LoadProgress>();
  const progress_callback = (e: ProgressEvent) => {
    if (e.status !== 'progress' || !e.file || !e.total) return;
    files.set(e.file, { loaded: e.loaded ?? 0, total: e.total });
    let loaded = 0, total = 0;
    for (const f of files.values()) { loaded += f.loaded; total += f.total; }
    onProgress?.({ loaded, total });
  };

  const options = { revision: DEPTH_MODEL.revision, progress_callback };
  const processor = await AutoProcessor.from_pretrained(DEPTH_MODEL.id, options);
  const model = await AutoModel.from_pretrained(DEPTH_MODEL.id, {
    ...options,
    device: config.device === 'webgpu' ? 'webgpu' : 'wasm',
    dtype: config.dtype,
  });

  const imageProcessor = ((processor as unknown as { image_processor?: ImageProcessorLike }).image_processor ??
    processor) as ImageProcessorLike;
  const setSize = (size: DepthSize) => {
    imageProcessor.size = { width: size, height: size };
    if ('keep_aspect_ratio' in imageProcessor) imageProcessor.keep_aspect_ratio = false;
  };
  setSize(config.size);

  return {
    setSize,
    async estimate(frame: FramePixels): Promise<DepthResult> {
      const t0 = performance.now();
      const image = new RawImage(frame.data, frame.width, frame.height, 4).rgb();
      const inputs = await processor(image);
      const t1 = performance.now();
      const out = (await model(inputs)) as Record<string, { dims: number[]; data: ArrayLike<number> }>;
      const tensor = out.predicted_depth ?? Object.values(out)[0]!;
      const raw = tensor.data;
      const t2 = performance.now();
      const data = normalizeDepth(toFloat32(raw));
      const t3 = performance.now();
      return {
        width: tensor.dims.at(-1)!,
        height: tensor.dims.at(-2)!,
        data,
        timings: { prep: t1 - t0, model: t2 - t1, post: t3 - t2 },
      };
    },
  };
}
