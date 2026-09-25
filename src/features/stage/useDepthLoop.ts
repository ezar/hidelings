// Depth loop shared by the game and the lab: grab a frame with the pose, estimate depth, blend with the
// previous map and hand it to the renderer. One frame in flight at a time.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { live } from '../../app/session';
import { log, record } from '../../app/report';
import { useSettings } from '../../app/store';
import { grabFrame } from '../../perception/depth/grab';
import { blendWithPrevious, type PosedDepthMap } from '../../perception/depth/temporal';
import { getOrientation } from '../../perception/motion/orientation';
import { cameraTans } from '../../perception/motion/rotation';
import type { OcclusionRenderer } from '../../render/occlusionRenderer';

export function useDepthLoop(
  videoRef: RefObject<HTMLVideoElement | null>,
  rendererRef: RefObject<OcclusionRenderer | null>,
  onMap?: (map: PosedDepthMap, video: HTMLVideoElement) => void,
) {
  const mapRef = useRef<PosedDepthMap | null>(null);
  const onMapRef = useRef(onMap);
  const [fps, setFps] = useState(0);

  useEffect(() => { onMapRef.current = onMap; }, [onMap]);

  useEffect(() => {
    let running = true;
    let frames = 0;
    let windowStart = performance.now();
    (async () => {
      while (running) {
        const video = videoRef.current;
        const cycleStart = performance.now();
        const pose = getOrientation();
        const frame = video ? grabFrame(video) : null;
        if (!frame || !live.depth || !video) {
          await new Promise(r => setTimeout(r, 50));
          continue;
        }
        record('depth.grab', performance.now() - cycleStart);
        const t0 = performance.now();
        try {
          const result = await live.depth.estimate(frame);
          record('depth.prep', result.timings.prep);
          record('depth.model', result.timings.model);
          record('depth.post', result.timings.post);
          const t1 = performance.now();
          const tans = cameraTans(useSettings.getState().fovDeg, video.videoWidth, video.videoHeight);
          const posed = blendWithPrevious(mapRef.current, { ...result, pose }, tans);
          record('depth.blend', performance.now() - t1);
          mapRef.current = posed;
          rendererRef.current?.setDepth(posed);
          onMapRef.current?.(posed, video);
        } catch (e) {
          if (!running) break;
          log(`Depth error: ${String(e)}`);
          await new Promise(r => setTimeout(r, 500));
          continue;
        }
        record('depth.infer', performance.now() - t0);
        record('depth.cycle', performance.now() - cycleStart);
        frames++;
        const elapsed = performance.now() - windowStart;
        if (elapsed >= 1000) {
          setFps((frames * 1000) / elapsed);
          frames = 0;
          windowStart = performance.now();
        }
      }
    })();
    return () => { running = false; };
  }, [videoRef, rendererRef]);

  return { mapRef, fps };
}
