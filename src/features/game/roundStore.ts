import { create } from 'zustand';
import { newRound, type RoundState } from '../../engine/round';

interface RoundStore {
  round: RoundState;
  /** Applies a pure transition from engine/round.ts. */
  apply: (fn: (r: RoundState) => RoundState) => void;
}

export const useRound = create<RoundStore>()(set => ({
  round: newRound(),
  apply: fn => set(s => ({ round: fn(s.round) })),
}));
