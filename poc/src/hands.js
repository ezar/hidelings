// MediaPipe hand landmarks, used to catch creatures with a pinch.
const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

let landmarker = null;
let lastTs = 0;

export async function load() {
  const { FilesetResolver, HandLandmarker } = await import(`${VISION}/vision_bundle.mjs`);
  const fileset = await FilesetResolver.forVisionTasks(`${VISION}/wasm`);
  landmarker = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numHands: 2,
  });
}

export const isReady = () => !!landmarker;

// Returns an array of hands, each an array of 21 normalized landmarks.
export function detect(video) {
  const ts = Math.max(lastTs + 1, Math.round(performance.now()));
  lastTs = ts;
  return landmarker.detectForVideo(video, ts).landmarks ?? [];
}
