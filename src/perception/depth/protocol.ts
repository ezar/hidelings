import type { DepthConfig, DepthResult, DepthSize, LoadProgress } from './types';

export type ToWorker =
  | { type: 'probe' }
  | { type: 'init'; config: DepthConfig; baseUrl: string }
  | { type: 'size'; size: DepthSize }
  | { type: 'estimate'; id: number; width: number; height: number; pixels: ArrayBuffer };

export type FromWorker =
  | { type: 'probe'; webgpu: boolean }
  | { type: 'progress'; progress: LoadProgress }
  | { type: 'ready' }
  | { type: 'result'; id: number; result: DepthResult }
  | { type: 'error'; id?: number; message: string };
