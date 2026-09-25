import type { FramePixels } from './types';

const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
const ctx = canvas?.getContext('2d', { willReadFrequently: true }) ?? null;

/** Copies the current video frame, downscaled to `width`, into a fresh pixel buffer (safe to transfer). */
export function grabFrame(video: HTMLVideoElement, width = 320): FramePixels | null {
  if (!canvas || !ctx || !video.videoWidth || !video.videoHeight) return null;
  const height = Math.round((width * video.videoHeight) / video.videoWidth);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  ctx.drawImage(video, 0, 0, width, height);
  const img = ctx.getImageData(0, 0, width, height);
  return { width, height, data: img.data };
}
