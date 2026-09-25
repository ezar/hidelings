// Live device orientation from DeviceOrientation events, plus the stats the debug report needs.
import { IDENTITY, fromEuler, type Mat3 } from './rotation';

interface OrientationRequest {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

let matrix: Mat3 = IDENTITY;
let active = false;
let listening = false;
let eventCount = 0;
let lastEventAt = 0;
let maxGap = 0;

/**
 * Asks for motion permission and starts listening. On iOS this must be the first await inside the
 * tap handler, or Safari rejects the request as not coming from a user gesture.
 */
export async function enableOrientation(): Promise<boolean> {
  if (typeof DeviceOrientationEvent === 'undefined') return false;
  const request = (DeviceOrientationEvent as unknown as OrientationRequest).requestPermission;
  if (typeof request === 'function') {
    try {
      if ((await request()) !== 'granted') return false;
    } catch {
      return false;
    }
  }
  if (!listening) {
    window.addEventListener('deviceorientation', onEvent);
    listening = true;
  }
  return true;
}

function onEvent(e: DeviceOrientationEvent) {
  if (e.alpha == null || e.beta == null || e.gamma == null) return;
  matrix = fromEuler(e.alpha, e.beta, e.gamma);
  active = true;
  eventCount++;
  const now = performance.now();
  if (lastEventAt) maxGap = Math.max(maxGap, now - lastEventAt);
  lastEventAt = now;
}

/** Latest device-to-world rotation. The identity until the first event arrives. */
export const getOrientation = (): Mat3 => matrix;
export const isOrientationActive = (): boolean => active;

/** Events received and longest gap between two events since the previous call. */
export function takeOrientationStats(): { events: number; maxGapMs: number } {
  const stats = { events: eventCount, maxGapMs: maxGap };
  eventCount = 0;
  maxGap = 0;
  return stats;
}
