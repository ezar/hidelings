// Solo room scan (docs/design SoloScan): "Enséñame la habitación" with a coverage ring of eight directions,
// the number of spots found and the difficulty, then a short countdown while the creatures hide.
import { DIFFICULTY, SECTORS, scanReady, type Difficulty } from '../../engine/solo';
import { fill } from '../../i18n/strings';
import { Creature2D } from '../../render/Creature2D';
import { useSettings, useT } from '../../app/store';

function arc(i: number): string {
  const a0 = (i / SECTORS) * Math.PI * 2 - Math.PI / 2 + 0.06;
  const a1 = ((i + 1) / SECTORS) * Math.PI * 2 - Math.PI / 2 - 0.06;
  const p = (a: number) => `${(48 + Math.cos(a) * 38).toFixed(1)} ${(48 + Math.sin(a) * 38).toFixed(1)}`;
  return `M${p(a0)} A38 38 0 0 1 ${p(a1)}`;
}

export function CoverageRing({ seen, size = 72 }: { seen: readonly number[]; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
      {Array.from({ length: SECTORS }, (_, i) => (
        <path key={i} d={arc(i)} fill="none" strokeLinecap="round" strokeWidth="10" stroke={seen.includes(i) ? '#2FA36B' : '#E3D6C2'} />
      ))}
      <circle cx="48" cy="48" r="7" fill="var(--ink)" />
      <path d="M48 20 L54 44 L42 44 Z" fill="var(--honey)" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function SoloScanHud({ spots, seen, needCoverage, countdown, onGo, onMenu }: {
  spots: number;
  seen: readonly number[];
  needCoverage: boolean;
  countdown: number | null;
  onGo: (difficulty: Difficulty) => void;
  onMenu: () => void;
}) {
  const t = useT();
  const { difficulty, setDifficulty } = useSettings();
  const rule = DIFFICULTY[difficulty];
  const ready = scanReady(spots, seen.length, rule.count, needCoverage);
  const summary = difficulty === 'easy' ? t.diffEasy : difficulty === 'normal' ? t.diffNormal : t.diffHard;

  if (countdown !== null) {
    return (
      <div className="solo-countdown" role="status">
        <Creature2D species="pompon" mood="near" size={140} />
        <h1 className="title">{t.soloHiding}</h1>
        <b className="solo-count">{countdown}</b>
      </div>
    );
  }

  return (
    <>
      <div className="hud-top">
        <div className="solo-card">
          <CoverageRing seen={seen} />
          <div style={{ flex: 1 }}>
            <h1 className="title" style={{ fontSize: 24 }}>{t.soloScanTitle}</h1>
            <p className="small">{t.soloScanBody}</p>
          </div>
        </div>
        <span className="solo-spots">{fill(t.soloSpots, { n: spots })}</span>
      </div>
      <div className="hud-bottom">
        <div className="solo-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <span className="small" style={{ letterSpacing: '0.04em' }}>{t.difficulty}</span>
          <div className="segmented" role="group" aria-label={t.difficulty} style={{ alignSelf: 'stretch' }}>
            {(['easy', 'normal', 'hard'] as const).map(d => (
              <button key={d} style={{ flex: 1 }} aria-pressed={difficulty === d} onClick={() => setDifficulty(d)}>{t[d]}</button>
            ))}
          </div>
          <p className="small">{summary}</p>
        </div>
        <div className="row">
          <button className="btn btn-glass" style={{ flex: '0 0 auto' }} onClick={onMenu}>{t.menu}</button>
          <button className="btn btn-primary" disabled={!ready} onClick={() => onGo(difficulty)}>
            {ready ? t.soloGo : t.soloNeedMore}
          </button>
        </div>
      </div>
    </>
  );
}
