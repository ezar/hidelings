// Safety screens (spec 12): the slow-down card over the camera and the break screen after the parent's
// session limit.
import { useState } from 'react';
import { fill } from '../../i18n/strings';
import { Creature2D } from '../../render/Creature2D';
import { useSession, useSettings, useT } from '../../app/store';
import { ParentGate } from '../parent/Parent';

export function SlowDown() {
  const t = useT();
  return (
    <div className="slowdown" role="alert">
      <div className="slowdown-card">
        <Creature2D species="timido" mood="near" size={110} />
        <h2 className="title" style={{ fontSize: 32 }}>{t.slowTitle}</h2>
        <p style={{ margin: 0, fontWeight: 700 }}>{t.slowBody}</p>
      </div>
    </div>
  );
}

export function Break() {
  const t = useT();
  const set = useSession(s => s.set);
  const limit = useSettings(s => s.parent.sessionLimitMin);
  const [gate, setGate] = useState(false);
  if (gate) return <ParentGate onPass={() => set({ phase: 'home', startedAt: Date.now() })} onCancel={() => setGate(false)} />;
  return (
    <main className="screen" style={{ justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}><Creature2D species="dormilon" size={180} /></div>
      <h1 className="display" style={{ fontSize: 40 }}>{t.breakTitle}</h1>
      <p className="lead">{fill(t.breakBody, { n: limit })}</p>
      <div className="grow" />
      <button className="link-btn center" onClick={() => setGate(true)}>{t.breakContinue}</button>
    </main>
  );
}
