// Bestiary (spec 4.4, docs/design Collection and Species card): every species, silhouettes until caught,
// hints for the ones not seen yet, and a card with stats for each.
import { useEffect, useState } from 'react';
import { speciesStats, type SpeciesStats } from '../../data/collection';
import { ALL_SPECIES, SPECIES, type SpeciesId } from '../../engine/species';
import { fill } from '../../i18n/strings';
import { Creature2D } from '../../render/Creature2D';
import { useSession, useSettings, useT } from '../../app/store';
import { QuickLookButton } from './QuickLook';

export function Collection() {
  const t = useT();
  const lang = useSettings(s => s.lang);
  const set = useSession(s => s.set);
  const [stats, setStats] = useState<Map<SpeciesId, SpeciesStats> | null>(null);
  const [open, setOpen] = useState<SpeciesId | null>(null);

  useEffect(() => {
    speciesStats().then(setStats, () => setStats(new Map()));
  }, []);

  const caught = (id: SpeciesId) => (stats?.get(id)?.count ?? 0) > 0;
  const found = ALL_SPECIES.filter(caught).length;
  const date = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString(lang, { day: 'numeric', month: 'short' }) : '');

  if (open) {
    const s = stats?.get(open);
    const sp = SPECIES[open];
    return (
      <main className="screen">
        <div className="row">
          <button className="icon-btn" aria-label={t.back} onClick={() => setOpen(null)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
        </div>
        <div className="species-hero" style={{ background: `${sp.color}55` }}>
          <Creature2D species={open} size={200} />
        </div>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1 className="display" style={{ fontSize: 40 }}>{sp.name}</h1>
          <span className="small">{sp.rare ? t.rare : t.common}</span>
        </div>
        <p className="lead" style={{ fontSize: 17, textAlign: 'left' }}>{t.behaviour[open]}</p>
        <div className="stat-row">
          <div className="stat" style={{ borderColor: 'var(--line)' }}><b>{s?.count ?? 0}</b><span>{t.caughtLabel}</span></div>
          <div className="stat" style={{ borderColor: 'var(--line)' }}>
            <b style={{ fontSize: 22 }}>{date(s?.firstAt ?? null)}</b>
            <span>{fill(t.firstSeen, { room: s?.firstRoom ?? '' })}</span>
          </div>
        </div>
        <div className="stills">
          {(['idle', 'near', 'caught'] as const).map(m => (
            <div key={m} className="still" style={{ background: m === 'caught' ? '#FFEFC2' : 'var(--card)', borderColor: 'var(--line)' }}>
              <Creature2D species={open} mood={m} size={70} />
            </div>
          ))}
        </div>
        <div className="grow" />
        <QuickLookButton species={open} label={t.seeInRoom} />
      </main>
    );
  }

  return (
    <main className="screen">
      <div className="row" style={{ alignItems: 'center' }}>
        <button className="icon-btn" aria-label={t.back} onClick={() => set({ phase: 'home' })}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <h1 className="title grow">{t.collection}</h1>
        <span className="counter" style={{ fontSize: 18 }}>{fill(t.collectionCount, { n: found, total: ALL_SPECIES.length })}</span>
      </div>
      <div className="bestiary">
        {ALL_SPECIES.map(id => {
          const known = caught(id);
          const sp = SPECIES[id];
          const hint = sp.rare ? t.hintRare : sp.prefers === 'dark' ? t.hintDark : t.hintUnknown;
          return (
            <button
              key={id}
              className={`species-tile${known ? '' : ' locked'}${sp.rare && !known ? ' rare' : ''}`}
              disabled={!known}
              onClick={() => setOpen(id)}
            >
              <Creature2D species={id} size={96} silhouette={!known} />
              <b>{known ? sp.name : t.unknown}</b>
              <span>{known ? fill(t.caughtTimes, { n: stats!.get(id)!.count }) : hint}</span>
            </button>
          );
        })}
      </div>
    </main>
  );
}
