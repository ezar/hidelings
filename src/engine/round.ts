// One round of pass-and-play hide and seek (spec 4.2, 5), as plain data and pure transitions.
import type { Vec3 } from '../perception/motion/rotation';
import type { SpeciesId } from './species';

export type RoundPhase = 'hide' | 'handover' | 'seek' | 'results';
export type CatchMethod = 'tap' | 'pinch';

export interface HiddenCreature {
  id: number;
  species: SpeciesId;
  /** World direction of the anchor. */
  dir: Vec3;
  /** Relative inverse depth where it sits. */
  disp: number;
  /** The phone's up direction when it was hidden, so it faces the seeker upright. */
  up: Vec3;
  caughtAt: number | null;
  visibleAtCatch: number | null;
  method: CatchMethod | null;
}

export interface RoundState {
  phase: RoundPhase;
  creatures: HiddenCreature[];
  /** Set on the first frame the seeker sees (spec 4.2), not when the curtain button is pressed. */
  seekStartedAt: number | null;
  lastProgressAt: number | null;
  endedAt: number | null;
  outcome: 'all' | 'timeout' | null;
  timeLimitMs: number;
  /** While paused the clock, hints and the time limit stand still. */
  pausedAt: number | null;
}

export const DEFAULT_TIME_LIMIT_MS = 5 * 60 * 1000;
export const MAX_CREATURES = 8;

export function newRound(timeLimitMs = DEFAULT_TIME_LIMIT_MS): RoundState {
  return { phase: 'hide', creatures: [], seekStartedAt: null, lastProgressAt: null, endedAt: null, outcome: null, timeLimitMs, pausedAt: null };
}

/** Keeps the creatures but clears catches, for "otra ronda" with the same hiding places. */
export function replay(state: RoundState): RoundState {
  return {
    ...newRound(state.timeLimitMs),
    phase: 'handover',
    creatures: state.creatures.map(c => ({ ...c, caughtAt: null, visibleAtCatch: null, method: null })),
  };
}

export function hide(state: RoundState, creature: Omit<HiddenCreature, 'caughtAt' | 'visibleAtCatch' | 'method'>): RoundState {
  if (state.phase !== 'hide' || state.creatures.length >= MAX_CREATURES) return state;
  return { ...state, creatures: [...state.creatures, { ...creature, caughtAt: null, visibleAtCatch: null, method: null }] };
}

export function unhide(state: RoundState, id: number): RoundState {
  if (state.phase !== 'hide') return state;
  return { ...state, creatures: state.creatures.filter(c => c.id !== id) };
}

export function toHandover(state: RoundState): RoundState {
  return state.phase === 'hide' && state.creatures.length ? { ...state, phase: 'handover' } : state;
}

export function toSeek(state: RoundState): RoundState {
  return state.phase === 'handover' ? { ...state, phase: 'seek', seekStartedAt: null } : state;
}

/** Starts the clock on the first seeking frame. */
export function startClock(state: RoundState, now: number): RoundState {
  if (state.phase !== 'seek' || state.seekStartedAt !== null) return state;
  return { ...state, seekStartedAt: now, lastProgressAt: now };
}

export function remaining(state: RoundState): number {
  return state.creatures.filter(c => c.caughtAt === null).length;
}

export function catchCreature(state: RoundState, id: number, now: number, visible: number, method: CatchMethod): RoundState {
  if (state.phase !== 'seek' || state.pausedAt !== null) return state;
  const creatures = state.creatures.map(c =>
    c.id === id && c.caughtAt === null ? { ...c, caughtAt: now, visibleAtCatch: visible, method } : c,
  );
  const next = { ...state, creatures, lastProgressAt: now };
  return remaining(next) === 0 ? { ...next, phase: 'results', endedAt: now, outcome: 'all' } : next;
}

export function pause(state: RoundState, now: number): RoundState {
  return state.phase === 'seek' && state.pausedAt === null ? { ...state, pausedAt: now } : state;
}

/** Resumes, moving the clock's start forward by the time spent paused. */
export function resume(state: RoundState, now: number): RoundState {
  if (state.pausedAt === null) return state;
  const d = now - state.pausedAt;
  return {
    ...state,
    pausedAt: null,
    seekStartedAt: state.seekStartedAt === null ? null : state.seekStartedAt + d,
    lastProgressAt: state.lastProgressAt === null ? null : state.lastProgressAt + d,
  };
}

/** Ends the round early at the seeker's request, like a timeout. */
export function giveUp(state: RoundState, now: number): RoundState {
  if (state.phase !== 'seek') return state;
  return { ...resume(state, now), phase: 'results', endedAt: now, outcome: 'timeout' };
}

/** Ends the round when the time limit has passed; the uncaught creatures then show themselves. */
export function checkTimeout(state: RoundState, now: number): RoundState {
  if (state.phase !== 'seek' || state.seekStartedAt === null || state.pausedAt !== null) return state;
  if (now - state.seekStartedAt < state.timeLimitMs) return state;
  return { ...state, phase: 'results', endedAt: now, outcome: 'timeout' };
}

export function elapsedMs(state: RoundState, now: number): number {
  if (state.seekStartedAt === null) return 0;
  return (state.endedAt ?? state.pausedAt ?? now) - state.seekStartedAt;
}

export interface RoundSummary {
  timeMs: number;
  caught: number;
  total: number;
  /** The creature caught with the least of it showing (spec 4.2). */
  hardest: HiddenCreature | null;
}

export function summarize(state: RoundState): RoundSummary {
  const caught = state.creatures.filter(c => c.caughtAt !== null);
  const hardest = caught.reduce<HiddenCreature | null>(
    (best, c) => (best === null || (c.visibleAtCatch ?? 1) < (best.visibleAtCatch ?? 1) ? c : best),
    null,
  );
  return { timeMs: elapsedMs(state, state.endedAt ?? 0), caught: caught.length, total: state.creatures.length, hardest };
}

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
