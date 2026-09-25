import { useEffect, useState } from 'react';
import { DEPTH_MODEL, formatMegabytes, isDepthModelCached } from '../../data/models';
import { fill } from '../../i18n/strings';
import { PomponPeeking } from '../../render/Pompon';
import { startSession } from '../../app/session';
import { useSession, useSettings, useT } from '../../app/store';

export function Welcome() {
  const t = useT();
  const { lang, setLang } = useSettings();
  const { phase, step } = useSession();
  const [cached, setCached] = useState<boolean | null>(null);
  const starting = phase === 'starting';

  useEffect(() => {
    // Before asking anything, say honestly whether a download is coming (spec 4.1). fp16 is the usual case.
    isDepthModelCached('fp16').then(setCached, () => setCached(false));
  }, []);

  const stepText = step ? { motion: t.stepMotion, camera: t.stepCamera, probe: t.stepProbe, benchmark: t.stepBenchmark }[step] : '';

  return (
    <main className="screen">
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div className="segmented" role="group" aria-label={t.language}>
          <button aria-pressed={lang === 'es'} onClick={() => setLang('es')}>ES</button>
          <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <PomponPeeking size={170} />
      </div>

      <div className="center" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h1 className="display">{t.appName}</h1>
        <p className="lead">{t.tagline}</p>
      </div>

      <ul className="card perm-list">
        <li>
          <span className="perm-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--berry)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
          </span>
          <span><b>{t.permCameraStrong}</b> {t.permCamera}</span>
        </li>
        <li>
          <span className="perm-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--berry)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M3 9c-1 2-1 4 0 6M21 9c1 2 1 4 0 6" /></svg>
          </span>
          <span><b>{t.permMotionStrong}</b> {t.permMotion}</span>
        </li>
        <li>
          <span className="perm-icon ok">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1E7A4E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
          </span>
          <span>{t.permPrivacy} <b>{t.permPrivacyStrong}</b></span>
        </li>
      </ul>

      <div className="grow" />
      <p className="small center">
        {cached ? t.cachedNote : fill(t.downloadNote, { size: formatMegabytes(DEPTH_MODEL.approxBytes.fp16) })}
      </p>
      <button className="btn btn-primary btn-big" disabled={starting} onClick={() => void startSession()}>
        {t.start}
      </button>
      <p className="status" aria-live="polite">{starting ? stepText : ''}</p>
      <p className="small center">{t.startNote}</p>
    </main>
  );
}
