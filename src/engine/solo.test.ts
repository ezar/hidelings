import { describe, expect, it } from 'vitest';
import { seededRandom } from '../perception/spots/spots';
import type { Vec3 } from '../perception/motion/rotation';
import { relocate, hide, newRound, toHandover, toSeek } from './round';
import {
  DIFFICULTY,
  MIN_SECTORS,
  RoomScan,
  angleBetween,
  hintGain,
  meanLuma,
  moveTarget,
  nextMoveDelay,
  placementDir,
  scanReady,
  sectorOf,
  yawOf,
  type ScanSpot,
} from './solo';

const DEG = Math.PI / 180;
/** Horizontal world direction at a compass angle (world z is up). */
const at = (yawDeg: number, pitchDeg = 0): Vec3 => [
  Math.sin(yawDeg * DEG) * Math.cos(pitchDeg * DEG),
  Math.cos(yawDeg * DEG) * Math.cos(pitchDeg * DEG),
  Math.sin(pitchDeg * DEG),
];
const spot = (yawDeg: number, score = 0.3, extra: Partial<ScanSpot> = {}): ScanSpot => ({
  dir: at(yawDeg),
  edgeDir: at(yawDeg, -2),
  disp: 0.4,
  score,
  kind: 'horizontal',
  luma: 120,
  up: [0, 0, 1],
  ...extra,
});

describe('directions', () => {
  it('reads the compass angle and its sector', () => {
    expect(yawOf(at(90))! / DEG).toBeCloseTo(90);
    expect(yawOf(at(0, 89))).toBeNull();
    expect(sectorOf(0)).toBe(0);
    expect(sectorOf(-10 * DEG)).toBe(7);
    expect(sectorOf(100 * DEG)).toBe(2);
  });

  it('moves the placement between the spot and the nearer object', () => {
    const s = spot(0);
    expect(angleBetween(placementDir(s, 0), s.dir)).toBeCloseTo(0);
    expect(angleBetween(placementDir(s, 1), s.edgeDir)).toBeCloseTo(0);
    // Peeking out moves away from the nearer object.
    const out = placementDir(s, -0.5);
    expect(angleBetween(out, s.edgeDir)).toBeGreaterThan(angleBetween(s.dir, s.edgeDir));
  });
});

describe('RoomScan', () => {
  it('merges spots seen twice and keeps the better one', () => {
    const scan = new RoomScan();
    scan.addSpots([spot(10, 0.2)]);
    scan.addSpots([spot(13, 0.4), spot(40, 0.3)]);
    expect(scan.spots).toHaveLength(2);
    expect(scan.spots[0]!.score).toBe(0.4);
  });

  it('counts coverage by direction and needs half the room', () => {
    const scan = new RoomScan();
    scan.addSpots([0, 50, 100, 150, 200].map(y => spot(y)));
    for (const y of [0, 50]) scan.addView(at(y), 100);
    expect(scan.coverage).toBe(2);
    expect(scan.ready(5, true)).toBe(false);
    expect(scan.ready(5, false)).toBe(true);
    for (const y of [100, 150, 200]) scan.addView(at(y), 100);
    expect(scan.coverage).toBeGreaterThanOrEqual(MIN_SECTORS);
    expect(scan.ready(5, true)).toBe(true);
    expect(scan.ready(7, true)).toBe(false);
  });

  it('plays with fewer spots after a full turn, or without a gyroscope', () => {
    expect(scanReady(3, 5, 7, true)).toBe(false);
    expect(scanReady(3, 8, 7, true)).toBe(true);
    expect(scanReady(1, 8, 7, true)).toBe(false);
    expect(scanReady(2, 0, 5, false)).toBe(true);
  });

  it('spreads creatures around the player', () => {
    const scan = new RoomScan();
    // Many good spots in one direction, a few weaker ones elsewhere.
    scan.addSpots([0, 8, 16, 24, 32].map(y => spot(y, 0.9)));
    scan.addSpots([120, 240].map(y => spot(y, 0.2)));
    const picked = scan.pick(3, seededRandom(3));
    expect(picked).toHaveLength(3);
    const sectors = new Set(picked.map(p => sectorOf(yawOf(p.dir)!)));
    expect(sectors.size).toBe(3);
    for (const a of picked) for (const b of picked) if (a !== b) expect(angleBetween(a.dir, b.dir)).toBeGreaterThanOrEqual(15 * DEG - 1e-9);
  });

  it('fills up from the same direction when the room has few', () => {
    const scan = new RoomScan();
    scan.addSpots([0, 20, 40, 60].map(y => spot(y)));
    expect(scan.pick(4, seededRandom(1))).toHaveLength(4);
    expect(scan.pick(9, seededRandom(1))).toHaveLength(4);
  });

  it('finds dark spots relative to the room', () => {
    const scan = new RoomScan();
    for (let i = 0; i < 5; i++) scan.addView(at(0), 150);
    expect(scan.isDark(spot(0, 0.3, { luma: 60 }))).toBe(true);
    expect(scan.isDark(spot(0, 0.3, { luma: 140 }))).toBe(false);
    expect(scan.isDark(spot(0, 0.3, { luma: null }))).toBe(false);
  });
});

describe('moving creatures', () => {
  it('moves only to free spots out of view', () => {
    const spots = [spot(0), spot(90), spot(180)];
    const inView = (d: Vec3) => angleBetween(d, at(0)) < 30 * DEG;
    const target = moveTarget(spots, [at(90)], inView, seededRandom(2));
    expect(target && yawOf(target.dir)! / DEG).toBeCloseTo(180);
    expect(moveTarget(spots, [at(90), at(180)], inView, seededRandom(2))).toBeNull();
  });

  it('schedules moves by difficulty', () => {
    expect(nextMoveDelay(DIFFICULTY.easy, Math.random)).toBeNull();
    const d = nextMoveDelay(DIFFICULTY.hard, () => 0.5)!;
    expect(d).toBeGreaterThanOrEqual(20_000);
    expect(d).toBeLessThanOrEqual(30_000);
    expect(DIFFICULTY.easy.count).toBeLessThan(DIFFICULTY.normal.count);
    expect(DIFFICULTY.normal.count).toBeLessThan(DIFFICULTY.hard.count);
  });

  it('relocates a creature only while seeking', () => {
    let r = hide(newRound(), { id: 1, species: 'pompon', dir: at(0), disp: 0.4, up: [0, 0, 1] });
    expect(relocate(r, 1, at(90), 0.3, [0, 0, 1])).toBe(r);
    r = toSeek(toHandover(r));
    const moved = relocate(r, 1, at(90), 0.3, [0, 0, 1]);
    expect(moved.creatures[0]!.dir).toEqual(at(90));
    expect(moved.creatures[0]!.disp).toBe(0.3);
  });
});

describe('sound and light', () => {
  it('makes hints louder as the creature comes into view', () => {
    expect(hintGain(0)).toBeCloseTo(1);
    expect(hintGain(Math.PI)).toBeCloseTo(0.35);
    expect(hintGain(0.5)).toBeGreaterThan(hintGain(1.5));
  });

  it('measures luminance over a frame or around a point', () => {
    const w = 10, h = 10;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const v = i % w < 5 ? 0 : 255;
      data.set([v, v, v, 255], i * 4);
    }
    expect(meanLuma(data, w, h)).toBeCloseTo(127.5);
    expect(meanLuma(data, w, h, { u: 0.1, v: 0.5, r: 0.1 })).toBeCloseTo(0);
    expect(meanLuma(data, w, h, { u: 0.9, v: 0.5, r: 0.1 })).toBeCloseTo(255);
  });
});
