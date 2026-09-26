// Safety (spec 12): notices when the phone is swung around fast, a sign the seeker is running or spinning.
import type { Mat3 } from './rotation';

/** Angle between two rotations, in degrees. */
export function rotationBetween(a: Mat3, b: Mat3): number {
  const trace = a[0] * b[0] + a[3] * b[3] + a[6] * b[6] + a[1] * b[1] + a[4] * b[4] + a[7] * b[7] + a[2] * b[2] + a[5] * b[5] + a[8] * b[8];
  return (Math.acos(Math.min(1, Math.max(-1, (trace - 1) / 2))) * 180) / Math.PI;
}

/**
 * "Más despacio": on after the phone turns faster than `limitDegPerS` for `onAfterMs`, off again after
 * `offAfterMs` of calm. Smooths the speed so a single jolt does not trigger it.
 */
export class SpeedWatch {
  private last: { pose: Mat3; at: number } | null = null;
  private speed = 0;
  private fastSince: number | null = null;
  private calmSince: number | null = null;
  tooFast = false;

  constructor(
    private readonly limitDegPerS = 150,
    private readonly onAfterMs = 250,
    private readonly offAfterMs = 1500,
  ) {}

  get degPerSecond(): number {
    return this.speed;
  }

  update(pose: Mat3, now: number): boolean {
    const last = this.last;
    this.last = { pose, at: now };
    if (!last || now <= last.at) return this.tooFast;
    const instant = (rotationBetween(last.pose, pose) * 1000) / (now - last.at);
    this.speed += (instant - this.speed) * 0.3;
    if (this.speed > this.limitDegPerS) {
      this.calmSince = null;
      this.fastSince ??= now;
      if (now - this.fastSince >= this.onAfterMs) this.tooFast = true;
    } else {
      this.fastSince = null;
      this.calmSince ??= now;
      if (now - this.calmSince >= this.offAfterMs) this.tooFast = false;
    }
    return this.tooFast;
  }
}

/** Minutes played in this session against the parent's limit (spec 4.5, 12). */
export function sessionOver(startedAt: number, now: number, limitMin: number): boolean {
  return limitMin > 0 && now - startedAt >= limitMin * 60_000;
}
