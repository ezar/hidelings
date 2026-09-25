// A synthetic depth engine for desktop development and tests (`?mock` in the URL).
// Nearer at the bottom of the frame, with a near "sofa" band and a near blob that follows brightness.
import type { DepthEngine, DepthResult, DepthSize, FramePixels } from './types';

export function createMockDepthEngine(initialSize: DepthSize): DepthEngine {
  let size: DepthSize = initialSize;
  return {
    setSize(s) { size = s; },
    async estimate(frame: FramePixels): Promise<DepthResult> {
      const t0 = performance.now();
      const w = size;
      const h = Math.round((size * frame.height) / frame.width);
      const data = new Float32Array(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const fx = Math.floor((x / w) * frame.width);
          const fy = Math.floor((y / h) * frame.height);
          const i = (fy * frame.width + fx) * 4;
          const luma = (frame.data[i]! + frame.data[i + 1]! + frame.data[i + 2]!) / 765;
          const floor = y / h;
          const sofa = y > h * 0.5 && y < h * 0.75 && x > w * 0.35 ? 0.35 : 0;
          data[y * w + x] = Math.min(1, 0.6 * floor + sofa + 0.2 * luma);
        }
      }
      await new Promise(r => setTimeout(r, 30));
      const t1 = performance.now();
      return { width: w, height: h, data, timings: { prep: 0, model: t1 - t0, post: 0 } };
    },
  };
}
