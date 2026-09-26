import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { setMuted } from '../audio/audio';
import { Collection } from '../features/collection/Collection';
import { Home } from '../features/home/Home';
import { Parent } from '../features/parent/Parent';
import { Break } from '../features/safety/Safety';
import { useRound } from '../features/game/roundStore';
import { sessionOver } from '../perception/motion/speed';
import { Calibration } from '../features/calibration/Calibration';
import { Game } from '../features/game/Game';
import { XrGame } from '../features/xr/XrGame';
import { Lab } from '../features/lab/Lab';
import { Download } from '../features/onboarding/Download';
import { ErrorScreen } from '../features/onboarding/ErrorScreen';
import { Welcome } from '../features/onboarding/Welcome';
import { useSession, useSettings, useT } from './store';

function LandscapeBlocker() {
  const t = useT();
  return (
    <div className="landscape" role="alert">
      <svg width="120" height="120" viewBox="0 0 200 200" aria-hidden="true">
        <rect x="44" y="70" width="112" height="64" rx="12" fill="#fff" stroke="#D8C8B0" strokeWidth="4" strokeDasharray="8 8" />
        <rect x="72" y="36" width="56" height="112" rx="12" fill="#fff" stroke="var(--ink)" strokeWidth="5" />
        <path d="M150 50 A 64 64 0 0 1 166 104" fill="none" stroke="var(--honey)" strokeWidth="7" strokeLinecap="round" />
      </svg>
      <div>
        <h1 className="title">{t.rotateTitle}</h1>
        <p className="lead">{t.rotateBody}</p>
      </div>
    </div>
  );
}

export function App() {
  const phase = useSession(s => s.phase);
  const sound = useSettings(s => s.parent.sound);

  useEffect(() => setMuted(!sound), [sound]);

  // Session limit (spec 4.5, 12): after the parent's limit, a break screen, never in the middle of a search.
  useEffect(() => {
    const id = setInterval(() => {
      const { startedAt, phase: current, set } = useSession.getState();
      const limit = useSettings.getState().parent.sessionLimitMin;
      if (!startedAt || !sessionOver(startedAt, Date.now(), limit)) return;
      if (!['home', 'game', 'solo', 'xr', 'collection'].includes(current)) return;
      if ((current === 'game' || current === 'solo' || current === 'xr') && useRound.getState().round.phase === 'seek') return;
      set({ phase: 'break' });
    }, 10_000);
    return () => clearInterval(id);
  }, []);

  const screen =
    phase === 'home' ? <Home /> :
    phase === 'collection' ? <Collection /> :
    phase === 'parent' ? <Parent /> :
    phase === 'break' ? <Break /> :
    phase === 'game' ? <Game mode="pass" /> :
    phase === 'solo' ? <Game mode="solo" /> :
    phase === 'xr' ? <XrGame /> :
    phase === 'lab' ? <Lab /> :
    phase === 'calibration' ? <Calibration /> :
    phase === 'download' ? <Download /> :
    phase === 'error' ? <ErrorScreen /> :
    <Welcome />;
  const key = phase === 'starting' ? 'welcome' : phase;

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {screen}
        </motion.div>
      </AnimatePresence>
      <LandscapeBlocker />
    </>
  );
}
