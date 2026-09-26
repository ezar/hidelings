// Main menu: the two ways to play, the collection and, tucked away, the grown-ups' area.
import { useEffect, useState } from 'react';
import { totalCatches } from '../../data/collection';
import { newRound } from '../../engine/round';
import { Creature2D } from '../../render/Creature2D';
import { useSession, useSettings, useT } from '../../app/store';
import { useRound } from '../game/roundStore';
import { xrSupported } from '../xr/XrGame';

export function Home() {
  const t = useT();
  const set = useSession(s => s.set);
  const { lang, setLang, parent } = useSettings();
  const [catches, setCatches] = useState<number | null>(null);

  const [xr, setXr] = useState(false);

  useEffect(() => {
    totalCatches().then(setCatches, () => setCatches(null));
    xrSupported().then(setXr, () => setXr(false));
  }, []);

  const play = (phase: 'game' | 'solo') => {
    useRound.getState().apply(() => newRound(parent.timeLimitMin * 60_000));
    set({ phase });
  };

  return (
    <main className="screen">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="link-btn" onClick={() => set({ phase: 'parent' })}>{t.parentArea}</button>
        <div className="segmented" role="group" aria-label={t.language}>
          <button aria-pressed={lang === 'es'} onClick={() => setLang('es')}>ES</button>
          <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
        </div>
      </div>
      <h1 className="title center" style={{ marginTop: 8 }}>{t.homeTitle}</h1>

      <button className="mode-card" onClick={() => play('game')}>
        <span className="mode-art" aria-hidden="true">
          <Creature2D species="pompon" size={84} />
          <Creature2D species="fideo" size={84} />
        </span>
        <span className="mode-text">
          <b>{t.modePass}</b>
          <span>{t.modePassHelp}</span>
        </span>
      </button>

      <button className="mode-card mode-card-solo" onClick={() => play('solo')}>
        <span className="mode-art" aria-hidden="true">
          <Creature2D species="curioso" size={84} />
          <Creature2D species="timido" size={70} />
        </span>
        <span className="mode-text">
          <b>{t.modeSolo}</b>
          <span>{t.modeSoloHelp}</span>
        </span>
      </button>

      {xr && (
        <button className="mode-card mode-card-xr" onClick={() => set({ phase: 'xr' })}>
          <span className="mode-text">
            <b>{t.modeXr}</b>
            <span>{t.modeXrHelp}</span>
          </span>
        </button>
      )}

      <button className="btn btn-big" onClick={() => set({ phase: 'collection' })}>
        {t.collection}{catches ? ` · ${catches}` : ''}
      </button>
      <div className="grow" />
      <button className="link-btn center" onClick={() => set({ phase: 'lab' })}>{t.lab}</button>
    </main>
  );
}
