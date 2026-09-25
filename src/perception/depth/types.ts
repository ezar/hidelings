export type DepthDevice = 'webgpu' | 'wasm' | 'mock';
export type DepthDtype = 'fp16' | 'fp32' | 'q8';

/** Input sizes the processor accepts (multiples of 14, spec 7.1). */
export const DEPTH_SIZES = [196, 252, 308, 364] as const;
export type DepthSize = (typeof DEPTH_SIZES)[number];

export interface DepthConfig {
  device: DepthDevice;
  dtype: DepthDtype;
  size: DepthSize;
}

/** Relative inverse depth, 0 (far) .. 1 (near), row-major. */
export interface DepthMap {
  width: number;
  height: number;
  data: Float32Array;
}

export interface DepthTimings {
  prep: number;
  model: number;
  post: number;
}

export interface DepthResult extends DepthMap {
  timings: DepthTimings;
}

/** RGBA pixels of a camera frame. */
export interface FramePixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface LoadProgress {
  loaded: number;
  total: number;
}

export interface DepthEngine {
  estimate(frame: FramePixels): Promise<DepthResult>;
  setSize(size: DepthSize): void;
}
