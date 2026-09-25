// Handover curtain (spec 4.2, docs/design Handover): hides the camera while the phone changes hands.
// The seeker holds the button for 600 ms, so the hider cannot skip it by accident.
import { useEffect, useRef, useState } from 'react';
import { fill } from '../../i18n/strings';
import { PomponPeeking } from '../../render/Pompon';
import { useT } from '../../app/store';

const HOLD_MS = 600;

function valance(): string {
  let d = 'M0 60';
  const n = 7;
  const w = 390 / n;
  for (let i = 0; i < n; i++) d += ` Q${(i + 0.5) * w} 120 ${(i + 1) * w} 60`;
  return `${d} V0 H0 Z`;
}
const VALANCE = valance();

export function Curtain({ count, onOpen }: { count: number; onOpen: () => void }) {
  const t = useT();
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef(0);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const tick = (ts: number) => {
    if (startRef.current === null) return;
    if (startRef.current < 0) startRef.current = ts;
    const p = Math.min(1, (ts - startRef.current) / HOLD_MS);
    setProgress(p);
    if (p >= 1) {
      startRef.current = null;
      onOpen();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  };
  const press = () => {
    startRef.current = -1; // set to the first frame's timestamp
    rafRef.current = requestAnimationFrame(tick);
  };
  const release = () => {
    startRef.current = null;
    cancelAnimationFrame(rafRef.current);
    setProgress(0);
  };

  return (
    <div className="curtain">
      <svg viewBox="0 0 390 844" preserveAspectRatio="none" className="curtain-bg" aria-hidden="true">
        <rect x="0" y="0" width="195" height="844" fill="#5B4BDB" />
        <rect x="195" y="0" width="195" height="844" fill="#5446D1" />
        <path d="M30 0 V844 M72 0 V844 M114 0 V844 M156 0 V844 M234 0 V844 M276 0 V844 M318 0 V844 M360 0 V844" stroke="#3F31B8" strokeWidth="10" />
        <line x1="195" y1="0" x2="195" y2="844" stroke="#2B2140" strokeWidth="4" />
        <path d={VALANCE} fill="#FFC53D" stroke="#2B2140" strokeWidth="4" strokeLinejoin="round" />
        <rect x="0" y="0" width="390" height="58" fill="#FFC53D" />
      </svg>
      <div className="curtain-card">
        <h1 className="display" style={{ fontSize: 40 }}>{t.curtainTitle}</h1>
        <p className="lead">{fill(t.curtainBody, { n: count })}</p>
      </div>
      <div className="curtain-peek" aria-hidden="true"><PomponPeeking size={130} /></div>
      <div className="curtain-actions">
        <button
          className="btn btn-primary btn-big hold"
          style={{ ['--hold' as string]: `${Math.round(progress * 100)}%` }}
          onPointerDown={press}
          onPointerUp={release}
          onPointerLeave={release}
          onPointerCancel={release}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onOpen(); }}
        >
          {t.curtainHold}
        </button>
        <p className="small center" style={{ color: '#fff' }}>{t.curtainHoldHelp}</p>
      </div>
    </div>
  );
}
