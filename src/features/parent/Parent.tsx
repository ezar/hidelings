// Parent area (spec 4.5, docs/design Parent area and Parent gate): a calm, separate look behind a gate
// of two steps (hold for 3 s, then a sum). Settings, storage and the collection's data.
import { useEffect, useRef, useState } from 'react';
import { clearCollection, exportCollection, importCollection, totalCatches } from '../../data/collection';
import { cachedModelBytes, deleteModels, formatMegabytes } from '../../data/models';
import { fill } from '../../i18n/strings';
import { useSession, useSettings, useT, type ParentSettings } from '../../app/store';

const HOLD_MS = 3000;

function newSum() {
  const a = 3 + Math.floor(Math.random() * 7);
  const b = 3 + Math.floor(Math.random() * 7);
  const right = a + b;
  const options = new Set([right]);
  while (options.size < 4) options.add(right + Math.floor(Math.random() * 7) - 3);
  return { a, b, right, options: [...options].sort((x, y) => x - y) };
}

export function ParentGate({ onPass, onCancel }: { onPass: () => void; onCancel: () => void }) {
  const t = useT();
  const [held, setHeld] = useState(0);
  const [step, setStep] = useState<1 | 2>(1);
  const [sum, setSum] = useState(newSum);
  const [wrong, setWrong] = useState(false);
  const start = useRef<number | null>(null);
  const raf = useRef(0);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const tick = (ts: number) => {
    if (start.current === null) return;
    if (start.current < 0) start.current = ts;
    const p = Math.min(1, (ts - start.current) / HOLD_MS);
    setHeld(p);
    if (p >= 1) { start.current = null; setStep(2); return; }
    raf.current = requestAnimationFrame(tick);
  };
  const press = () => { start.current = -1; raf.current = requestAnimationFrame(tick); };
  const release = () => { start.current = null; cancelAnimationFrame(raf.current); if (step === 1) setHeld(0); };
  const answer = (n: number) => {
    if (n === sum.right) { onPass(); return; }
    setWrong(true);
    setStep(1);
    setHeld(0);
    setSum(newSum());
  };

  return (
    <main className="screen parent">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="parent-title">{t.gateTitle}</h1>
        <button className="parent-btn" onClick={onCancel}>{t.backToGame}</button>
      </div>
      <p className="parent-muted">{wrong ? t.gateWrong : t.gateBody}</p>
      <section className="parent-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          className="hold-ring"
          aria-label={t.gateHold}
          style={{ ['--p' as string]: `${Math.round(held * 360)}deg` }}
          disabled={step === 2}
          onPointerDown={press}
          onPointerUp={release}
          onPointerLeave={release}
          onPointerCancel={release}
        >
          <span style={{ position: 'relative', zIndex: 1 }}>{step === 2 ? '✓' : ''}</span>
        </button>
        <div>
          <span className="parent-label">{step === 2 ? t.gateStepDone : fill(t.gateStep, { n: 1 })}</span>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{t.gateHold}</p>
        </div>
      </section>
      {step === 2 && (
        <section className="parent-card" style={{ borderColor: 'var(--parent-accent)' }}>
          <span className="parent-label">{fill(t.gateStep, { n: 2 })}</span>
          <p style={{ margin: '2px 0 12px', fontSize: 22, fontWeight: 800 }}>{fill(t.gateSum, { a: sum.a, b: sum.b })}</p>
          <div className="parent-grid">
            {sum.options.map(n => <button key={n} className="parent-answer" onClick={() => answer(n)}>{n}</button>)}
          </div>
        </section>
      )}
      <div className="grow" />
      <p className="parent-muted center">{t.gateNote}</p>
    </main>
  );
}

function Stepper({ label, value, display, onChange, step, min, max }: {
  label: string; value: number; display: string; onChange: (v: number) => void; step: number; min: number; max: number;
}) {
  return (
    <div className="parent-row">
      <span className="grow">{label}</span>
      <button className="parent-step" aria-label="−" onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <span className="parent-value">{display}</span>
      <button className="parent-step" aria-label="+" onClick={() => onChange(Math.min(max, value + step))}>+</button>
    </div>
  );
}

function Switch({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="parent-row">
      <span className="grow">{label}</span>
      <button className="switch" aria-pressed={on} aria-label={label} onClick={() => onChange(!on)}><span /></button>
    </div>
  );
}

export function Parent() {
  const t = useT();
  const set = useSession(s => s.set);
  const { parent, setParent, fovDeg } = useSettings();
  const [open, setOpen] = useState(false);
  const [modelBytes, setModelBytes] = useState(0);
  const [catches, setCatches] = useState(0);
  const [note, setNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    cachedModelBytes().then(setModelBytes, () => undefined);
    totalCatches().then(setCatches, () => undefined);
  };
  useEffect(refresh, [open]);

  if (!open) return <ParentGate onPass={() => setOpen(true)} onCancel={() => set({ phase: 'home' })} />;

  const p = (patch: Partial<ParentSettings>) => setParent(patch);

  const doExport = async () => {
    const data = await exportCollection();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hidelings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const doImport = async (file: File) => {
    try {
      const n = await importCollection(JSON.parse(await file.text()));
      setNote(fill(t.imported, { n }));
      refresh();
    } catch {
      setNote(t.importError);
    }
  };

  return (
    <main className="screen parent">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="parent-title">{t.parentArea}</h1>
        <button className="parent-btn" onClick={() => set({ phase: 'home' })}>{t.exit}</button>
      </div>

      <section className="parent-group">
        <h2>{t.groupGame}</h2>
        <div className="parent-list">
          <Stepper label={t.timeLimit} value={parent.timeLimitMin} display={fill(t.minutes, { n: parent.timeLimitMin })} step={1} min={1} max={15} onChange={v => p({ timeLimitMin: v })} />
          <Stepper label={t.hintDelay} value={parent.hintDelaySec} display={fill(t.seconds, { n: parent.hintDelaySec })} step={15} min={15} max={180} onChange={v => p({ hintDelaySec: v })} />
          <Stepper label={t.sessionLimit} value={parent.sessionLimitMin} display={parent.sessionLimitMin ? fill(t.minutes, { n: parent.sessionLimitMin }) : t.off} step={5} min={0} max={60} onChange={v => p({ sessionLimitMin: v })} />
          <Switch label={t.soloMoving} on={parent.soloMoving} onChange={v => p({ soloMoving: v })} />
          <Switch label={t.sound} on={parent.sound} onChange={v => p({ sound: v })} />
        </div>
      </section>

      <section className="parent-group">
        <h2>{t.groupRoom}</h2>
        <div className="parent-list">
          <label className="parent-row">
            <span className="grow">{t.roomName}</span>
            <input className="parent-input" value={parent.room} placeholder={t.defaultRoom} maxLength={24} onChange={e => p({ room: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="parent-group">
        <h2>{t.groupData}</h2>
        <div className="parent-list">
          <div className="parent-row">
            <span className="grow">{t.models}<small>{fill(t.modelsDetail, { size: formatMegabytes(modelBytes) })}</small></span>
            <button className="parent-btn" onClick={() => void deleteModels().then(() => { setNote(t.modelsDeleted); refresh(); })}>{t.deleteModels}</button>
          </div>
          <div className="parent-row">
            <span className="grow">{t.recalibrate}<small>{fill(t.calibrationDetail, { fov: Math.round(fovDeg) })}</small></span>
            <button className="parent-btn" onClick={() => set({ phase: 'calibration' })}>{t.repeat}</button>
          </div>
          <div className="parent-row">
            <span className="grow">{t.collection}<small>{fill(t.catchesCount, { n: catches })}</small></span>
            <button className="parent-btn" onClick={() => void doExport()}>{t.exportAction}</button>
            <button className="parent-btn" onClick={() => fileRef.current?.click()}>{t.importAction}</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = ''; }} />
          </div>
        </div>
        <button
          className="parent-danger"
          onClick={() => { if (confirm(t.confirmDelete)) void clearCollection().then(refresh); }}
        >
          {t.deleteCollection}
        </button>
      </section>

      {note && <p className="parent-muted center" role="status">{note}</p>}
      <div className="grow" />
      <p className="parent-muted center">{t.privacyNote}</p>
    </main>
  );
}
