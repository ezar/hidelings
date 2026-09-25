// Device probe (spec 7.1, 13): what the browser offers, and the depth settings that follow from it.
import type { DepthConfig, DepthSize } from '../depth/types';

export interface DeviceProbe {
  userAgent: string;
  webgpu: boolean;
  shaderF16: boolean;
  gpu?: { vendor?: string; architecture?: string };
  webgpuError?: string;
}

interface GpuAdapterLike {
  features: { has(name: string): boolean };
  info?: { vendor?: string; architecture?: string };
}

export async function probeDevice(): Promise<DeviceProbe> {
  const info: DeviceProbe = { userAgent: navigator.userAgent, webgpu: false, shaderF16: false };
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<GpuAdapterLike | null> } }).gpu;
  if (gpu) {
    try {
      const adapter = await gpu.requestAdapter();
      if (adapter) {
        info.webgpu = true;
        info.shaderF16 = adapter.features.has('shader-f16');
        info.gpu = { vendor: adapter.info?.vendor, architecture: adapter.info?.architecture };
      }
    } catch (e) {
      info.webgpuError = String(e);
    }
  }
  return info;
}

/** M0 (ADR 0001): 196 px by default; fp16 on WebGPU when available. */
export function depthConfigFor(probe: DeviceProbe, size: DepthSize = 196, mock = false): DepthConfig {
  if (mock) return { device: 'mock', dtype: 'fp32', size };
  if (probe.webgpu) return { device: 'webgpu', dtype: probe.shaderF16 ? 'fp16' : 'fp32', size };
  return { device: 'wasm', dtype: 'q8', size };
}

/**
 * First-launch benchmark (spec 7.1): 252 px costs about (252/196)² ≈ 1.65 times the model time at 196,
 * so only pick it when 196 leaves room to stay at 8 fps or more.
 */
export function chooseDepthSize(modelMsAt196: number): DepthSize {
  return modelMsAt196 > 0 && modelMsAt196 * 1.65 + 20 <= 125 ? 252 : 196;
}

export function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}
