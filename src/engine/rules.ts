// Game rules (spec 5 and 6.2). Pure functions and small trackers: no rendering, no AI.

/** A catch needs at least this much of the creature visible, so tapping blindly on a sofa does nothing. */
export const CATCH_MIN_VISIBLE = 0.12;
/** Hiding refuses spots where the creature would be this visible, unless the hider insists. */
export const HIDE_MAX_VISIBLE = 0.85;
/** A catch tap or pinch may land slightly outside the creature's radius. */
export const CATCH_RADIUS_SLACK = 1.15;

export interface ScreenCircle {
  x: number;
  y: number;
  r: number;
}

export interface Catchable {
  id: number;
  screen: ScreenCircle | null;
  visible: number | null;
  caught: boolean;
}

/** The creature a tap or pinch at (x, y) catches, if any: the nearest visible enough one under the finger. */
export function pickCatchTarget(creatures: readonly Catchable[], x: number, y: number): number | null {
  let best: { id: number; d: number } | null = null;
  for (const c of creatures) {
    if (c.caught || !c.screen || (c.visible ?? 0) < CATCH_MIN_VISIBLE) continue;
    const d = Math.hypot(c.screen.x - x, c.screen.y - y);
    if (d > c.screen.r * CATCH_RADIUS_SLACK) continue;
    if (!best || d < best.d) best = { id: c.id, d };
  }
  return best?.id ?? null;
}

/** Hide rule: whether a freshly placed creature is hidden enough to keep without the hider insisting. */
export function hiddenEnough(visible: number): boolean {
  return visible <= HIDE_MAX_VISIBLE;
}

/**
 * Nearly found (spec 6.2): more than 40% visible and near the middle of the screen for 250 ms. Fires once,
 * then waits 4 s before it can fire again for the same creature.
 */
export class NearlyFoundTracker {
  private since = new Map<number, number>();
  private lastFired = new Map<number, number>();

  constructor(
    private readonly minVisible = 0.4,
    private readonly centre = 0.2,
    private readonly dwellMs = 250,
    private readonly cooldownMs = 4000,
  ) {}

  /** Returns true on the frame the reaction should start. */
  update(id: number, screen: ScreenCircle | null, visible: number | null, width: number, height: number, now: number): boolean {
    const near =
      !!screen &&
      (visible ?? 0) > this.minVisible &&
      Math.abs(screen.x / width - 0.5) < this.centre &&
      Math.abs(screen.y / height - 0.5) < this.centre;
    if (!near) {
      this.since.delete(id);
      return false;
    }
    const start = this.since.get(id) ?? now;
    this.since.set(id, start);
    const last = this.lastFired.get(id) ?? -Infinity;
    if (now - start >= this.dwellMs && now - last >= this.cooldownMs) {
      this.lastFired.set(id, now);
      return true;
    }
    return false;
  }
}

/** Tímido's shyness (spec 6.1): true while it should be pulled back. */
export class RetreatTracker {
  private visibleSince = new Map<number, number>();
  private retreatUntil = new Map<number, number>();

  constructor(private readonly visibleAbove: number, private readonly afterMs: number, private readonly durationMs: number) {}

  update(id: number, visible: number | null, now: number): boolean {
    const until = this.retreatUntil.get(id) ?? 0;
    if (now < until) return true;
    if ((visible ?? 0) > this.visibleAbove) {
      const since = this.visibleSince.get(id) ?? now;
      this.visibleSince.set(id, since);
      if (now - since >= this.afterMs) {
        this.retreatUntil.set(id, now + this.durationMs);
        this.visibleSince.delete(id);
        return true;
      }
    } else {
      this.visibleSince.delete(id);
    }
    return false;
  }
}

/**
 * Hints (spec 4.2): nothing until `delayMs` without a catch, then a sound from the creature's direction,
 * then 20 s later an arrow at the screen edge as well.
 */
export function hintStage(now: number, lastProgressAt: number, delayMs: number, arrowAfterMs = 20000): 0 | 1 | 2 {
  const idle = now - lastProgressAt;
  if (idle < delayMs) return 0;
  return idle < delayMs + arrowAfterMs ? 1 : 2;
}

/** Stereo pan for a sound hint: -1 (left) .. 1 (right) from the creature's horizontal angle to the phone. */
export function panFor(deviceDir: readonly [number, number, number]): number {
  const angle = Math.atan2(deviceDir[0], -deviceDir[2]);
  return Math.max(-1, Math.min(1, angle / (Math.PI / 2)));
}
