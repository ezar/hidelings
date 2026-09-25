// Shared runtime flags, filled in by the device probe.
export const TRANSFORMERS = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3';
export const runtime = { device: 'wasm', f16: false };

export async function probeDevice() {
  const info = { userAgent: navigator.userAgent, webgpu: false, shaderF16: false };
  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        info.webgpu = true;
        info.shaderF16 = adapter.features.has('shader-f16');
        const a = adapter.info ?? {};
        info.gpu = { vendor: a.vendor, architecture: a.architecture };
      }
    } catch (e) {
      info.webgpuError = String(e);
    }
  }
  runtime.device = info.webgpu ? 'webgpu' : 'wasm';
  runtime.f16 = info.shaderF16;
  return info;
}
