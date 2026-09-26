// Solo mode (spec 4.3, 7.2): the room scan collects hiding spots in every direction, the game hides the
// creatures behind the best of them, spread around the player, and moves them now and then.
import type { Vec3 } from '../perception/motion/rotation';
import type { SpotKind } from './species';

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultyRule {
  count: number;
  /**
   * How far towards the nearer object the creature sits, as a fraction of the way to it: negative peeks
   * out more, positive hides deeper.
   */
  peek: number;
  /** Delay between moves, as a [min, max] range in ms; null when they stay put. */
  moveEveryMs: readonly [number, number] | null;
}

export const DIFFICULTY: Record<Difficulty, DifficultyRule> = {
  easy: { count: 3, peek: -0.5, moveEveryMs: null },
  normal: { count: 5, peek: 0, moveEveryMs: [30_000, 40_000] },
  hard: { count: 7, peek: 0.5, moveEveryMs: [20_000, 30_000] },
};

export const SECTORS = 8;
/** Spots closer than this, in degrees, are the same spot seen twice (spec 7.2: "a few degrees"). */
export const MERGE_DEG = 6;
/** Creatures are hidden at least this far apart, in degrees. */
export const MIN_SPREAD_DEG = 15;
/** Directions seen before the game hides the creatures: half the room. */
export const MIN_SECTORS = 4;

/** Fewest spots a round can be played with, in a room that has little to hide behind. */
export const MIN_SPOTS = 2;

const DEG = Math.PI / 180;

/**
 * Whether the game can hide the creatures: enough spots for the difficulty once half the room was seen, or
 * whatever was found (at least MIN_SPOTS) after a full turn. Without a gyroscope (desktop) directions
 * cannot be counted, so what was found is enough.
 */
export function scanReady(spots: number, coverage: number, count: number, needCoverage: boolean): boolean {
  const few = spots >= Math.min(count, MIN_SPOTS);
  if (!needCoverage || coverage >= SECTORS) return few;
  return spots >= count && coverage >= MIN_SECTORS;
}

export interface ScanSpot {
  /** World direction of the spot. */
  dir: Vec3;
  /** World direction of the nearer object next to it. */
  edgeDir: Vec3;
  disp: number;
  score: number;
  kind: SpotKind;
  /** Mean luminance around the spot (0..255), if the frame could be read. */
  luma: number | null;
  /** The phone's up direction when the spot was seen. */
  up: Vec3;
}

function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

export function angleBetween(a: Vec3, b: Vec3): number {
  const dot = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / ((Math.hypot(...a) || 1) * (Math.hypot(...b) || 1));
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

/** Compass angle of a world direction (world z is up), or null when it points nearly straight up or down. */
export function yawOf(dir: Vec3): number | null {
  const n = normalize(dir);
  if (Math.abs(n[2]) > 0.85) return null;
  return Math.atan2(n[0], n[1]);
}

export function sectorOf(yaw: number): number {
  const a = ((yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return Math.min(SECTORS - 1, Math.floor(a / ((2 * Math.PI) / SECTORS)));
}

/** Where to put a creature for this spot: between the spot and the nearer object, by `peek`. */
export function placementDir(spot: ScanSpot, peek: number): Vec3 {
  const t = Math.max(-1, Math.min(1, peek));
  return normalize([
    spot.dir[0] + (spot.edgeDir[0] - spot.dir[0]) * t,
    spot.dir[1] + (spot.edgeDir[1] - spot.dir[1]) * t,
    spot.dir[2] + (spot.edgeDir[2] - spot.dir[2]) * t,
  ]);
}

function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

/** Everything learnt while the player shows the room. */
export class RoomScan {
  spots: ScanSpot[] = [];
  readonly seen = new Set<number>();
  private lumas: number[] = [];

  /** Marks the direction the camera looks at as seen, with the frame's mean luminance. */
  addView(forward: Vec3, luma: number | null) {
    const yaw = yawOf(forward);
    if (yaw !== null) this.seen.add(sectorOf(yaw));
    if (luma !== null) {
      this.lumas.push(luma);
      if (this.lumas.length > 240) this.lumas.shift();
    }
  }

  /** Adds spots, merging each with a known one within MERGE_DEG and keeping the better of the two. */
  addSpots(list: readonly ScanSpot[]) {
    for (const s of list) {
      const i = this.spots.findIndex(k => angleBetween(k.dir, s.dir) < MERGE_DEG * DEG);
      if (i < 0) this.spots.push(s);
      else if (s.score > this.spots[i]!.score) this.spots[i] = s;
    }
  }

  get coverage(): number {
    return this.seen.size;
  }

  /** Median luminance of the room over the scan, or null before any frame was read. */
  roomLuma(): number | null {
    return median(this.lumas);
  }

  ready(count: number, needCoverage: boolean): boolean {
    return scanReady(this.spots.length, this.coverage, count, needCoverage);
  }

  /** A darker spot than most of the room: Dormilón likes those (spec 6.1). */
  isDark(spot: ScanSpot): boolean {
    const room = this.roomLuma();
    return spot.luma !== null && room !== null && spot.luma < room * 0.7;
  }

  /**
   * Up to `count` spots, spread around the player: one direction after another (in random order), best
   * first within each, never two closer than MIN_SPREAD_DEG.
   */
  pick(count: number, random: () => number): ScanSpot[] {
    const groups = new Map<number, ScanSpot[]>();
    for (const s of this.spots) {
      const yaw = yawOf(s.dir);
      const key = yaw === null ? -1 : sectorOf(yaw);
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    const order = [...groups.keys()]
      .map(k => ({ k, r: random() }))
      .sort((a, b) => a.r - b.r)
      .map(x => x.k);
    for (const k of order) groups.get(k)!.sort((a, b) => b.score - a.score);
    const picked: ScanSpot[] = [];
    let progress = true;
    while (picked.length < count && progress) {
      progress = false;
      for (const k of order) {
        const g = groups.get(k)!;
        while (g.length) {
          const s = g.shift()!;
          if (picked.every(p => angleBetween(p.dir, s.dir) >= MIN_SPREAD_DEG * DEG)) {
            picked.push(s);
            progress = true;
            break;
          }
        }
        if (picked.length >= count) break;
      }
    }
    return picked;
  }
}

/**
 * A spot for a creature to move to: not within MIN_SPREAD_DEG of any creature, and not in view (nobody sees
 * it move). Null when there is none.
 */
export function moveTarget(
  spots: readonly ScanSpot[],
  occupied: readonly Vec3[],
  inView: (dir: Vec3) => boolean,
  random: () => number,
): ScanSpot | null {
  const free = spots.filter(s => !inView(s.dir) && occupied.every(o => angleBetween(o, s.dir) >= MIN_SPREAD_DEG * DEG));
  if (!free.length) return null;
  return free[Math.min(free.length - 1, Math.floor(random() * free.length))]!;
}

export function nextMoveDelay(rule: DifficultyRule, random: () => number): number | null {
  if (!rule.moveEveryMs) return null;
  const [a, b] = rule.moveEveryMs;
  return a + (b - a) * random();
}

/** Hint loudness by how far the creature is from where the phone looks: louder when nearly in view. */
export function hintGain(angleRad: number): number {
  return 0.35 + 0.65 * Math.max(0, 1 - angleRad / Math.PI);
}

/** Mean luminance (Rec. 601) of RGBA pixels, over the whole buffer or a box around (u, v). */
export function meanLuma(data: Uint8ClampedArray, width: number, height: number, at?: { u: number; v: number; r: number }): number {
  let x0 = 0, y0 = 0, x1 = width, y1 = height;
  if (at) {
    const cx = Math.floor(at.u * width), cy = Math.floor(at.v * height), r = Math.max(1, Math.round(at.r * width));
    x0 = Math.max(0, cx - r); x1 = Math.min(width, cx + r + 1);
    y0 = Math.max(0, cy - r); y1 = Math.min(height, cy + r + 1);
  }
  let sum = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      sum += 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      n++;
    }
  }
  return n ? sum / n : 0;
}
