// The "Empezar" flow (spec 4.1): motion permission, camera, device probe, model download, benchmark.
import { unlockAudio } from '../audio/audio';
import { isDepthModelCached, migrateModelCache, requestPersistentStorage } from '../data/models';
import { DepthService } from '../perception/depth/depthService';
import { grabFrame } from '../perception/depth/grab';
import { enableOrientation } from '../perception/motion/orientation';
import { chooseDepthSize, depthConfigFor, median, probeDevice } from '../perception/probe/probe';
import { log, record } from './report';
import { useSession, useSettings } from './store';

/** Live resources of the running session, shared by the screens. */
export const live: { stream: MediaStream | null; depth: DepthService | null } = { stream: null, depth: null };

const isMock = () => new URLSearchParams(location.search).has('mock');

/** Must be called directly from the tap handler: the motion permission request is its first await. */
export async function startSession(): Promise<void> {
  const session = useSession.getState();
  session.set({ phase: 'starting', step: 'motion', error: null, errorDetail: '', progress: null });

  // Synchronous: audio must be unlocked inside the tap, and the motion request below stays the first await.
  unlockAudio();
  const motion = await enableOrientation();
  log(`Orientation: ${motion ? 'enabled' : 'unavailable'}`);
  session.set({ motion, step: 'camera' });

  try {
    live.stream ??= await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (e) {
    log(`Camera error: ${String(e)}`);
    session.set({ phase: 'error', error: 'camera', errorDetail: String(e) });
    return;
  }

  session.set({ step: 'probe' });
  const probe = await probeDevice();
  const settings = useSettings.getState();
  const config = depthConfigFor(probe, settings.depthSize ?? 196, isMock());
  log(`Probe: ${probe.webgpu ? 'webgpu' : 'no webgpu'}${probe.shaderF16 ? ' + f16' : ''}; ${config.device} ${config.dtype}`);
  session.set({ probe, config });

  await migrateModelCache();
  const cached = config.device === 'mock' || (await isDepthModelCached(config.dtype));
  if (!cached) session.set({ phase: 'download' });

  const depth = new DepthService();
  try {
    const start = performance.now();
    const host = await depth.start(config, progress => useSession.getState().set({ progress }));
    record('load.depth', performance.now() - start);
    log(`Depth ready on ${host} (${cached ? 'cached' : 'downloaded'})`);
    live.depth?.stop();
    live.depth = depth;
    session.set({ host });
  } catch (e) {
    depth.stop();
    log(`Depth load error: ${String(e)}`);
    session.set({ phase: 'error', error: 'model', errorDetail: String(e) });
    return;
  }

  if (settings.depthSize === null && config.device !== 'mock') {
    session.set({ phase: 'starting', step: 'benchmark' });
    const size = await benchmark(depth, live.stream);
    useSettings.getState().setDepthSize(size);
    depth.setSize(size);
    session.set({ config: { ...config, size } });
    log(`Benchmark picked ${size} px`);
  }

  void requestPersistentStorage();
  session.set({ phase: useSettings.getState().calibrated ? 'game' : 'calibration', step: null });
}

/** Times the model at 196 px on real camera frames and picks the size (spec 7.1). */
async function benchmark(depth: DepthService, stream: MediaStream): Promise<196 | 252> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play().catch(() => undefined);
  const samples: number[] = [];
  for (let i = 0; i < 8; i++) {
    const frame = grabFrame(video);
    if (!frame) {
      await new Promise(r => setTimeout(r, 50));
      continue;
    }
    const result = await depth.estimate(frame);
    if (i >= 3) samples.push(result.timings.model);
  }
  video.srcObject = null;
  const ms = median(samples);
  record('benchmark.model196', ms);
  return chooseDepthSize(ms) as 196 | 252;
}
