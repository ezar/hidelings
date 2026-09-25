// MediaPipe Hand Landmarker (spec 7.3): GPU delegate, VIDEO mode, up to two hands. Runs on the main thread
// with the video element. The WASM files are served from our origin; the model comes from Google's
// storage and the service worker caches it after the first use.
import type { HandLandmarker } from '@mediapipe/tasks-vision';
import type { Landmark } from './pinch';

export const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

let landmarker: HandLandmarker | null = null;
let loading: Promise<void> | null = null;
let lastTs = 0;

/**
 * Loads the landmarker and runs one detection to warm it up. The first detection compiles GPU shaders and
 * froze the M0 PoC for about 8 s (ADR 0001), so call this behind a screen that hides the pause.
 */
export function loadHands(video: HTMLVideoElement | null): Promise<void> {
  loading ??= (async () => {
    const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(new URL(`${import.meta.env.BASE_URL}mediapipe/`, location.href).href);
    landmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 2,
    });
    if (video?.videoWidth) detectHands(video);
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

export const handsReady = (): boolean => !!landmarker;

/** Landmarks of each hand in normalized video coordinates. */
export function detectHands(video: HTMLVideoElement): Landmark[][] {
  if (!landmarker || !video.videoWidth) return [];
  const ts = Math.max(lastTs + 1, Math.round(performance.now()));
  lastTs = ts;
  return landmarker.detectForVideo(video, ts).landmarks ?? [];
}
