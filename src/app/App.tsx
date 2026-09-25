import { AnimatePresence, motion } from 'framer-motion';
import { DepthPreview } from '../features/debug/DepthPreview';
import { Download } from '../features/onboarding/Download';
import { ErrorScreen } from '../features/onboarding/ErrorScreen';
import { Welcome } from '../features/onboarding/Welcome';
import { useSession, useT } from './store';

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
  const screen =
    phase === 'preview' ? <DepthPreview /> :
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
