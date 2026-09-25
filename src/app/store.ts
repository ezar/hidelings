import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { STRINGS, detectLang, type Lang, type Strings } from '../i18n/strings';
import type { DepthConfig, DepthSize, LoadProgress } from '../perception/depth/types';
import type { DepthHost } from '../perception/depth/depthService';
import type { DeviceProbe } from '../perception/probe/probe';

export type Phase = 'welcome' | 'starting' | 'download' | 'preview' | 'error';
export type StartStep = 'motion' | 'camera' | 'probe' | 'benchmark';

/** Settings kept on the device between sessions. */
interface Settings {
  lang: Lang;
  /** Depth size picked by the first-launch benchmark, or chosen by hand. */
  depthSize: DepthSize | null;
  fovDeg: number;
  setLang: (lang: Lang) => void;
  setDepthSize: (size: DepthSize) => void;
}

export const useSettings = create<Settings>()(
  persist(
    set => ({
      lang: detectLang(typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]),
      depthSize: null,
      fovDeg: 64,
      setLang: lang => set({ lang }),
      setDepthSize: depthSize => set({ depthSize }),
    }),
    {
      name: 'hidelings.settings',
      storage: createJSONStorage(() => localStorage),
      partialize: s => ({ lang: s.lang, depthSize: s.depthSize, fovDeg: s.fovDeg }),
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
  set: patch => set(patch),
}));

export function useT(): Strings {
  return STRINGS[useSettings(s => s.lang)];
}
