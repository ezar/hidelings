/// <reference lib="webworker" />
// Depth worker (spec 7.1): runs the model off the main thread so rendering and the gyroscope stay smooth.
import type { FromWorker, ToWorker } from './protocol';
import type { DepthEngine } from './types';

const scope = self as unknown as DedicatedWorkerGlobalScope;
let engine: DepthEngine | null = null;

const post = (msg: FromWorker, transfer: Transferable[] = []) => scope.postMessage(msg, transfer);

async function hasWebGPU(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    return !!(await gpu.requestAdapter());
  } catch {
    return false;
  }
}

scope.onmessage = async (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  try {
    switch (msg.type) {
      case 'probe':
        post({ type: 'probe', webgpu: await hasWebGPU() });
        break;
      case 'init':
        if (msg.config.device === 'mock') {
          const { createMockDepthEngine } = await import('./mockEngine');
          engine = createMockDepthEngine(msg.config.size);
        } else {
          const { createDepthEngine, setLocalRuntime } = await import('./engine');
          setLocalRuntime(msg.baseUrl);
          engine = await createDepthEngine(msg.config, progress => post({ type: 'progress', progress }));
        }
        post({ type: 'ready' });
        break;
      case 'size':
        engine?.setSize(msg.size);
        break;
      case 'estimate': {
        if (!engine) throw new Error('Depth engine not loaded');
        const result = await engine.estimate({
          width: msg.width,
          height: msg.height,
          data: new Uint8ClampedArray(msg.pixels),
        });
        post({ type: 'result', id: msg.id, result }, [result.data.buffer]);
        break;
      }
    }
  } catch (err) {
    post({ type: 'error', id: msg.type === 'estimate' ? msg.id : undefined, message: String((err as Error)?.message ?? err) });
  }
};
