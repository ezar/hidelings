import { describe, expect, it } from 'vitest';
import {
  catchCreature,
  checkTimeout,
  elapsedMs,
  formatClock,
  giveUp,
  pause,
  resume,
  hide,
  newRound,
  remaining,
  replay,
  startClock,
  summarize,
  toHandover,
  toSeek,
  unhide,
  type RoundState,
} from './round';
import { NearlyFoundTracker, RetreatTracker, hiddenEnough, hintStage, panFor, pickCatchTarget } from './rules';
import { SPECIES, speciesForSpot } from './species';

const creature = (id: number) => ({ id, species: 'pompon' as const, dir: [0, 1, 0] as const, disp: 0.3, up: [0, 0, 1] as const });

function seeking(n = 2): RoundState {
  let s = newRound(60_000);
  for (let i = 1; i <= n; i++) s = hide(s, creature(i));
  return startClock(toSeek(toHandover(s)), 1000);
}

describe('round', () => {
  it('goes hide → handover → seek → results', () => {
    let s = newRound();
    expect(toHandover(s).phase).toBe('hide'); // nothing hidden yet
    s = hide(s, creature(1));
    s = toHandover(s);
    expect(s.phase).toBe('handover');
    s = toSeek(s);
    expect(s.phase).toBe('seek');
    expect(s.seekStartedAt).toBeNull();
    s = startClock(s, 500);
    expect(s.seekStartedAt).toBe(500);
    s = catchCreature(s, 1, 2500, 0.3, 'tap');
    expect(s.phase).toBe('results');
    expect(s.outcome).toBe('all');
    expect(summarize(s).timeMs).toBe(2000);
  });

  it('only hides and unhides during the hiding phase', () => {
    let s = hide(newRound(), creature(1));
    s = unhide(s, 1);
    expect(s.creatures).toHaveLength(0);
    const seek = seeking();
    expect(hide(seek, creature(9)).creatures).toHaveLength(2);
  });

  it('does not start the clock twice', () => {
    const s = startClock(seeking(), 9999);
    expect(s.seekStartedAt).toBe(1000);
  });

  it('ignores a second catch of the same creature', () => {
    let s = catchCreature(seeking(), 1, 2000, 0.5, 'tap');
    s = catchCreature(s, 1, 3000, 0.9, 'pinch');
    expect(s.creatures[0]!.caughtAt).toBe(2000);
    expect(remaining(s)).toBe(1);
  });

  it('ends on timeout', () => {
    const s = checkTimeout(seeking(), 61_001);
    expect(s.phase).toBe('results');
    expect(s.outcome).toBe('timeout');
    expect(checkTimeout(seeking(), 30_000).phase).toBe('seek');
  });

  it('reports the hardest catch', () => {
    let s = catchCreature(seeking(3), 2, 2000, 0.14, 'pinch');
    s = catchCreature(s, 1, 3000, 0.6, 'tap');
    s = catchCreature(s, 3, 4000, 0.3, 'tap');
    const sum = summarize(s);
    expect(sum.caught).toBe(3);
    expect(sum.hardest?.id).toBe(2);
  });

  it('replays with the same hiding places', () => {
    const done = catchCreature(catchCreature(seeking(), 1, 2000, 0.5, 'tap'), 2, 3000, 0.5, 'tap');
    const again = replay(done);
    expect(again.phase).toBe('handover');
    expect(remaining(again)).toBe(2);
  });

  it('stops the clock and the time limit while paused', () => {
    let s = pause(seeking(), 11_000);
    expect(elapsedMs(s, 50_000)).toBe(10_000);
    expect(checkTimeout(s, 100_000).phase).toBe('seek');
    expect(catchCreature(s, 1, 12_000, 0.5, 'tap').creatures[0]!.caughtAt).toBeNull();
    s = resume(s, 41_000);
    expect(elapsedMs(s, 41_000)).toBe(10_000);
    expect(checkTimeout(s, 90_000).phase).toBe('seek');
    expect(checkTimeout(s, 92_000).phase).toBe('results');
  });

  it('ends early when the seeker gives up', () => {
    const s = giveUp(pause(seeking(), 5000), 6000);
    expect(s.phase).toBe('results');
    expect(s.outcome).toBe('timeout');
    expect(s.pausedAt).toBeNull();
  });

  it('formats the clock', () => {
    expect(formatClock(84_900)).toBe('1:24');
    expect(formatClock(5_000)).toBe('0:05');
  });
});

describe('rules', () => {
  const c = (id: number, x: number, visible: number, caught = false) => ({ id, screen: { x, y: 100, r: 30 }, visible, caught });

  it('catches the nearest creature that is visible enough', () => {
    expect(pickCatchTarget([c(1, 100, 0.5), c(2, 120, 0.5)], 118, 100)).toBe(2);
  });

  it('ignores creatures showing less than 12%, caught ones and far taps', () => {
    expect(pickCatchTarget([c(1, 100, 0.1)], 100, 100)).toBeNull();
    expect(pickCatchTarget([c(1, 100, 0.5, true)], 100, 100)).toBeNull();
    expect(pickCatchTarget([c(1, 100, 0.5)], 200, 100)).toBeNull();
    expect(pickCatchTarget([c(1, 100, 0.12)], 100, 100)).toBe(1);
  });

  it('refuses spots where the creature is more than 85% visible', () => {
    expect(hiddenEnough(0.85)).toBe(true);
    expect(hiddenEnough(0.9)).toBe(false);
  });

  it('fires nearly found after the dwell time, then waits for the cooldown', () => {
    const t = new NearlyFoundTracker();
    const centre = { x: 195, y: 422, r: 30 };
    expect(t.update(1, centre, 0.6, 390, 844, 0)).toBe(false);
    expect(t.update(1, centre, 0.6, 390, 844, 300)).toBe(true);
    expect(t.update(1, centre, 0.6, 390, 844, 600)).toBe(false);
    expect(t.update(1, { ...centre, x: 20 }, 0.6, 390, 844, 700)).toBe(false);
    expect(t.update(1, centre, 0.6, 390, 844, 4500)).toBe(false); // dwell restarts
    expect(t.update(1, centre, 0.6, 390, 844, 4800)).toBe(true);
    expect(t.update(2, centre, 0.3, 390, 844, 5000)).toBe(false); // not visible enough
  });

  it('makes Tímido pull back after being half visible for too long', () => {
    const { visibleAbove, afterMs, durationMs } = SPECIES.timido.retreat!;
    const t = new RetreatTracker(visibleAbove, afterMs, durationMs);
    expect(t.update(1, 0.7, 0)).toBe(false);
    expect(t.update(1, 0.7, 1600)).toBe(true);
    expect(t.update(1, 0.1, 3000)).toBe(true); // still retreating
    expect(t.update(1, 0.1, 4200)).toBe(false);
  });

  it('stages hints: nothing, then sound, then sound and arrow', () => {
    expect(hintStage(10_000, 0, 60_000)).toBe(0);
    expect(hintStage(61_000, 0, 60_000)).toBe(1);
    expect(hintStage(81_000, 0, 60_000)).toBe(2);
  });

  it('pans hint sounds towards the creature', () => {
    expect(panFor([0, 0, -1])).toBeCloseTo(0);
    expect(panFor([1, 0, -1])).toBeCloseTo(0.5);
    expect(panFor([-1, 0, 0])).toBeCloseTo(-1);
  });
});

describe('species', () => {
  it('picks species that like the spot', () => {
    expect(speciesForSpot('vertical', 0)).not.toBe('pompon');
    expect(speciesForSpot('horizontal', 0.99)).not.toBe('fideo');
    expect(speciesForSpot(null, 0.5)).toBeDefined();
  });
});

describe('species conditions', () => {
  it('only offers Brillo in a dark room', async () => {
    const { availableSpecies } = await import('./species');
    expect(availableSpecies(150)).not.toContain('brillo');
    expect(availableSpecies(40)).toContain('brillo');
    expect(availableSpecies(null)).not.toContain('brillo');
  });

  it('puts Dormilón in dark spots and never picks Brillo outside the pool', async () => {
    const { speciesForSpot, COMMON_SPECIES } = await import('./species');
    expect(speciesForSpot({ kind: 'horizontal', dark: true }, 0.2, COMMON_SPECIES)).toBe('dormilon');
    for (let r = 0; r < 1; r += 0.05) expect(speciesForSpot({ kind: 'vertical' }, r, COMMON_SPECIES)).not.toBe('brillo');
    expect(speciesForSpot({ kind: 'vertical' }, 0.1, [...COMMON_SPECIES, 'brillo'])).toBe('brillo');
  });
});
