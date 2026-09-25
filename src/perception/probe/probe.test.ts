import { describe, expect, it } from 'vitest';
import { chooseDepthSize, depthConfigFor, median, type DeviceProbe } from './probe';

const probe = (p: Partial<DeviceProbe>): DeviceProbe => ({ userAgent: '', webgpu: false, shaderF16: false, ...p });

describe('depthConfigFor', () => {
  it('uses fp16 on WebGPU with shader-f16', () => {
    expect(depthConfigFor(probe({ webgpu: true, shaderF16: true }))).toEqual({ device: 'webgpu', dtype: 'fp16', size: 196 });
  });
  it('uses fp32 on WebGPU without shader-f16', () => {
    expect(depthConfigFor(probe({ webgpu: true })).dtype).toBe('fp32');
  });
  it('falls back to q8 on WASM', () => {
    expect(depthConfigFor(probe({}))).toEqual({ device: 'wasm', dtype: 'q8', size: 196 });
  });
  it('supports the mock engine', () => {
    expect(depthConfigFor(probe({ webgpu: true }), 196, true).device).toBe('mock');
  });
});

describe('chooseDepthSize', () => {
  it('keeps 196 on the M0 iPhone (97 ms at 196)', () => {
    expect(chooseDepthSize(97)).toBe(196);
  });
  it('picks 252 on a device fast enough to hold 8 fps there', () => {
    expect(chooseDepthSize(50)).toBe(252);
  });
  it('keeps 196 without a measurement', () => {
    expect(chooseDepthSize(0)).toBe(196);
  });
});

describe('median', () => {
  it('picks the middle value', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([])).toBe(0);
  });
});
