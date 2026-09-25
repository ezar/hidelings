// Main-thread side of depth estimation. Prefers the worker; falls back to the main thread when the
// worker cannot reach WebGPU but the page can (older WebKit builds expose WebGPU only to windows).
import type { FromWorker, ToWorker } from './protocol';
import type { DepthConfig, DepthEngine, DepthResult, DepthSize, FramePixels, LoadProgress } from './types';

export type DepthHost = 'worker' | 'main';

interface Pending {
  resolve: (r: DepthResult) => void;
  reject: (e: Error) => void;
}

export class DepthService {
  host: DepthHost = 'worker';
  private worker: Worker | null = null;
  private engine: DepthEngine | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();

  async start(config: DepthConfig, onProgress?: (p: LoadProgress) => void): Promise<DepthHost> {
    const worker = new Worker(new URL('./depth.worker.ts', import.meta.url), { type: 'module' });
    this.worker = worker;

    if (config.device === 'webgpu') {
      const probe = await this.request(worker, { type: 'probe' }, 'probe');
      if (!probe.webgpu) {
        worker.terminate();
        this.worker = null;
        this.host = 'main';
        const { createDepthEngine, setLocalRuntime } = await import('./engine');
        setLocalRuntime(new URL(import.meta.env.BASE_URL, location.href).href);
        this.engine = await createDepthEngine(config, onProgress);
        return this.host;
      }
    }

    await new Promise<void>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<FromWorker>) => {
        const msg = e.data;
        if (msg.type === 'progress') onProgress?.(msg.progress);
        else if (msg.type === 'ready') resolve();
        else if (msg.type === 'error') reject(new Error(msg.message));
      };
      worker.onerror = e => reject(new Error(e.message || 'Depth worker failed to start'));
      this.send({ type: 'init', config, baseUrl: new URL(import.meta.env.BASE_URL, location.href).href });
    });

    worker.onmessage = (e: MessageEvent<FromWorker>) => this.onResult(e.data);
    worker.onerror = e => this.failAll(new Error(e.message || 'Depth worker crashed'));
    this.host = 'worker';
    return this.host;
  }

  setSize(size: DepthSize) {
    if (this.engine) this.engine.setSize(size);
    else this.send({ type: 'size', size });
  }

  /** Estimates depth for one frame. The frame's pixel buffer is transferred to the worker. */
  estimate(frame: FramePixels): Promise<DepthResult> {
    if (this.engine) return this.engine.estimate(frame);
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const pixels = frame.data.buffer as ArrayBuffer;
      this.send({ type: 'estimate', id, width: frame.width, height: frame.height, pixels }, [pixels]);
    });
  }

  stop() {
    this.worker?.terminate();
    this.worker = null;
    this.engine = null;
    this.failAll(new Error('Depth stopped'));
  }

  private send(msg: ToWorker, transfer: Transferable[] = []) {
    this.worker?.postMessage(msg, transfer);
  }

  private request<T extends FromWorker['type']>(worker: Worker, msg: ToWorker, reply: T) {
    return new Promise<Extract<FromWorker, { type: T }>>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<FromWorker>) => {
        if (e.data.type === reply) resolve(e.data as Extract<FromWorker, { type: T }>);
      };
      worker.onerror = e => reject(new Error(e.message || 'Depth worker failed to start'));
      worker.postMessage(msg);
    });
  }

  private onResult(msg: FromWorker) {
    if (msg.type === 'result') {
      this.pending.get(msg.id)?.resolve(msg.result);
      this.pending.delete(msg.id);
    } else if (msg.type === 'error') {
      const err = new Error(msg.message);
      if (msg.id === undefined) this.failAll(err);
      else {
        this.pending.get(msg.id)?.reject(err);
        this.pending.delete(msg.id);
      }
    }
  }

  private failAll(err: Error) {
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
  }
}
