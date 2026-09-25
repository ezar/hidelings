import type { VideoPoint } from '../perception/motion/rotation';

/**
 * Maps normalized video coordinates to screen pixels and back for a video shown with
 * `object-fit: cover` (spec 8.2). Every conversion between the two goes through here.
 */
export interface ViewMapping {
  /** Viewport size in pixels. */
  width: number;
  height: number;
  /** Displayed video size in pixels, larger than or equal to the viewport. */
  videoWidth: number;
  videoHeight: number;
  /** Offset of the displayed video's top-left corner, zero or negative. */
  offsetX: number;
  offsetY: number;
}

export function coverMapping(width: number, height: number, sourceWidth: number, sourceHeight: number): ViewMapping {
  const sw = sourceWidth || width || 1;
  const sh = sourceHeight || height || 1;
  const scale = Math.max(width / sw, height / sh);
  const videoWidth = sw * scale;
  const videoHeight = sh * scale;
  return { width, height, videoWidth, videoHeight, offsetX: (width - videoWidth) / 2, offsetY: (height - videoHeight) / 2 };
}

export function videoToScreen(m: ViewMapping, p: VideoPoint): { x: number; y: number } {
  return { x: m.offsetX + p.u * m.videoWidth, y: m.offsetY + p.v * m.videoHeight };
}

export function screenToVideo(m: ViewMapping, x: number, y: number): VideoPoint {
  return { u: (x - m.offsetX) / m.videoWidth, v: (y - m.offsetY) / m.videoHeight };
}

/** The visible part of the video, in normalized video coordinates. */
export function visibleVideoRect(m: ViewMapping): { u0: number; v0: number; u1: number; v1: number } {
  const a = screenToVideo(m, 0, 0);
  const b = screenToVideo(m, m.width, m.height);
  return { u0: a.u, v0: a.v, u1: b.u, v1: b.v };
}
