import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { STRINGS, detectLang, type Lang, type Strings } from '../i18n/strings';
import type { DepthConfig, DepthSize, LoadProgress } from '../perception/depth/types';
import type { DepthHost } from '../perception/depth/depthService';
import type { DeviceProbe } from '../perception/probe/probe';
import type { Difficulty } from '../engine/solo';

export type Phase = 'welcome' | 'starting' | 'download' | 'calibration' | 'home' | 'game' | 'solo' | 'xr' | 'collection' | 'parent' | 'break' | 'lab' | 'error';
export type StartStep = 'motion' | 'camera' | 'probe' | 'benchmark';

export interface ParentSettings {
  /** Round time limit in minutes (spec 5). */
  timeLimitMin: number;
  /** Seconds without a catch before the first hint (spec 4.2). */
  hintDelaySec: number;
  /** Solo creatures may move between hiding spots (spec 4.3). */
  soloMoving: boolean;
  sound: boolean;
  /** Minutes of play before a break screen; 0 turns it off (spec 12). */
  sessionLimitMin: number;
  /** Name of the room being played, kept with each catch. Empty means the default name. */
  room: string;
}

export const DEFAULT_PARENT: ParentSettings = {
  timeLimitMin: 5,
  hintDelaySec: 60,
  soloMoving: true,
  sound: true,
  sessionLimitMin: 20,
  room: '',
};

/** Settings kept on the device between sessions. */
interface Settings {
  lang: Lang;
  /** Depth size picked by the first-launch benchmark, or chosen by hand. */
  depthSize: DepthSize | null;
  fovDeg: number;
  /** Whether this device went through the field-of-view calibration (spec 8.3). */
  calibrated: boolean;
  /** Catch by pinching in front of the camera (spec 7.3). */
  hands: boolean;
  setHands: (hands: boolean) => void;
  /** Parent area (spec 4.5). */
  parent: ParentSettings;
  setParent: (patch: Partial<ParentSettings>) => void;
  setLang: (lang: Lang) => void;
  setDepthSize: (size: DepthSize) => void;
  setFov: (fovDeg: number, calibrated: boolean) => void;
  /** Last solo difficulty picked (spec 4.3). */
  difficulty: Difficulty;
  setDifficulty: (difficulty: Difficulty) => void;
}

export const useSettings = create<Settings>()(
  persist(
    set => ({
      lang: detectLang(typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]),
      depthSize: null,
      fovDeg: 64,
      calibrated: false,
      hands: false,
      setHands: hands => set({ hands }),
      parent: DEFAULT_PARENT,
      setParent: patch => set(s => ({ parent: { ...s.parent, ...patch } })),
      setLang: lang => set({ lang }),
      setDepthSize: depthSize => set({ depthSize }),
      setFov: (fovDeg, calibrated) => set({ fovDeg, calibrated }),
      difficulty: 'normal',
      setDifficulty: difficulty => set({ difficulty }),
    }),
    {
      name: 'hidelings.settings',
      storage: createJSONStorage(() => localStorage),
      partialize: s => ({ lang: s.lang, depthSize: s.depthSize, fovDeg: s.fovDeg, calibrated: s.calibrated, hands: s.hands, parent: s.parent, difficulty: s.difficulty }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Settings>;
        return { ...current, ...p, parent: { ...DEFAULT_PARENT, ...(p.parent ?? {}) } };
      },
    },
  ),
);

/** State of the current session, not persisted. */
interface Session {
  phase: Phase;
  step: StartStep | null;
  progress: LoadProgress | null;
  probe: DeviceProbe | null;
  config: DepthConfig | null;
  host: DepthHost | null;
  motion: boolean;
  error: 'camera' | 'model' | null;
  errorDetail: string;
  /** When play started in this session, for the parent's session limit. */
  startedAt: number | null;
  set: (patch: Partial<Omit<Session, 'set'>>) => void;
}

export const useSession = create<Session>()(set => ({
  phase: 'welcome',
  step: null,
  progress: null,
  probe: null,
  config: null,
  host: null,
  motion: false,
  error: null,
  errorDetail: '',
  startedAt: null,
  set: patch => set(patch),
}));

export function useT(): Strings {
  return STRINGS[useSettings(s => s.lang)];
}
