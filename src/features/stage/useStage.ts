// Shared camera stage: the live video plus the Three.js overlay, kept in sync with the video size and the
// calibrated field of view. Screens drive their own loops on top of it.
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { live, openCamera } from '../../app/session';
import { log } from '../../app/report';
import { useSettings } from '../../app/store';
import { OcclusionRenderer } from '../../render/occlusionRenderer';

export function useStage(videoRef: RefObject<HTMLVideoElement | null>, glRef: RefObject<HTMLCanvasElement | null>) {
  const rendererRef = useRef<OcclusionRenderer | null>(null);
  const viewKey = useRef('');

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let alive = true;
    // The camera is closed after the WebXR mode; open it again (permission is already granted).
    (live.stream ? Promise.resolve(live.stream) : openCamera()).then(
      stream => {
        if (!alive) return;
        video.srcObject = stream;
        video.play().catch(e => log(`Video play: ${String(e)}`));
      },
      e => log(`Camera error: ${String(e)}`),
    );
    return () => { alive = false; };
  }, [videoRef]);

  useEffect(() => {
    const canvas = glRef.current;
    if (!canvas) return;
    const renderer = new OcclusionRenderer(canvas);
    rendererRef.current = renderer;
    viewKey.current = '';
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [glRef]);

  /** Updates the renderer's view if the canvas, video or field of view changed. Call once per frame. */
  const syncView = useCallback((fovOverride?: number) => {
    const renderer = rendererRef.current;
    const canvas = glRef.current;
    const video = videoRef.current;
    if (!renderer || !canvas || !video) return null;
    const fov = fovOverride ?? useSettings.getState().fovDeg;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const next = `${canvas.clientWidth}x${canvas.clientHeight}@${dpr} ${video.videoWidth}x${video.videoHeight} ${fov}`;
    if (next !== viewKey.current) {
      viewKey.current = next;
      renderer.setView(canvas.clientWidth, canvas.clientHeight, dpr, video.videoWidth, video.videoHeight, fov);
    }
    return renderer;
  }, [glRef, videoRef]);

  return { rendererRef, syncView };
}
