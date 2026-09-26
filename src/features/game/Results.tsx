// Results (spec 4.2, docs/design Results): time, creatures caught, the hardest catch and a still of every
// catch. Stills live in memory only (spec 11).
import { summarize, formatClock, type RoundState } from '../../engine/round';
import { SPECIES } from '../../engine/species';
import { fill } from '../../i18n/strings';
import { useT } from '../../app/store';

export function Results({ round, stills, onReplay, onHideAgain, onMenu }: {
  round: RoundState;
  stills: ReadonlyMap<number, string>;
  onReplay: () => void;
  onHideAgain: () => void;
  onMenu: () => void;
}) {
  const t = useT();
  const s = summarize(round);
  const hardestStill = s.hardest ? stills.get(s.hardest.id) : undefined;
  const caught = round.creatures.filter(c => c.caughtAt !== null).sort((a, b) => a.caughtAt! - b.caughtAt!);

  return (
    <main className="screen results">
      <h1 className="title center">{s.caught === s.total ? t.resultsAll : t.resultsSome}</h1>
      <div className="stat-row">
        <div className="stat"><b>{formatClock(s.timeMs)}</b><span>{t.resultsTime}</span></div>
        <div className="stat stat-honey"><b>{s.caught} / {s.total}</b><span>{t.resultsCaught}</span></div>
      </div>

      {s.hardest && (
        <div className="card hardest">
          {hardestStill && <img src={hardestStill} alt={SPECIES[s.hardest.species].name} />}
          <div style={{ padding: '10px 14px' }}>
            <span className="small" style={{ letterSpacing: '0.04em' }}>{t.resultsHardest.toUpperCase()}</span>
            <p style={{ margin: 0, font: '600 20px var(--font-display)' }}>{SPECIES[s.hardest.species].name}</p>
            <p className="small">
              {fill(t.resultsHardestDetail, {
                pct: Math.round((s.hardest.visibleAtCatch ?? 0) * 100),
                method: s.hardest.method === 'pinch' ? t.methodPinch : t.methodTap,
              })}
            </p>
          </div>
        </div>
      )}

      {caught.length > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="small" style={{ letterSpacing: '0.04em' }}>{t.resultsEach.toUpperCase()}</span>
          <div className="stills">
            {caught.map(c => (
              <div key={c.id} className="still" style={{ background: SPECIES[c.species].color }}>
                {stills.get(c.id) ? <img src={stills.get(c.id)} alt={SPECIES[c.species].name} /> : <span>{SPECIES[c.species].name}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grow" />
      <button className="link-btn center" onClick={onMenu}>{t.menu}</button>
      <p className="small center">{t.playAgainHelp}</p>
      <div className="row">
        <button className="btn" onClick={onHideAgain}>{t.hideAgain}</button>
        <button className="btn btn-primary" onClick={onReplay}>{t.playAgain}</button>
      </div>
    </main>
  );
}
