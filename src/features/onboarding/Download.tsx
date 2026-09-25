import { DEPTH_MODEL, formatMegabytes } from '../../data/models';
import { fill } from '../../i18n/strings';
import { PomponPeeking } from '../../render/Pompon';
import { useSession, useT } from '../../app/store';

export function Download() {
  const t = useT();
  const { progress, config } = useSession();
  const total = progress?.total || DEPTH_MODEL.approxBytes[config?.dtype ?? 'fp16'];
  const loaded = progress?.loaded ?? 0;
  const pct = Math.min(100, Math.round((loaded / total) * 100));

  return (
    <main className="screen" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 64px)' }}>
      <div className="center" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 className="title">{t.downloadTitle}</h1>
        <p className="small">{t.downloadSubtitle}</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <PomponPeeking size={200} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div style={{ width: `${pct}%` }} />
        </div>
        <p className="small" style={{ color: 'var(--ink)', fontWeight: 800 }}>
          {fill(t.downloadProgress, { loaded: formatMegabytes(loaded), total: formatMegabytes(total) })}
        </p>
      </div>
      <div className="card">
        <p style={{ margin: 0, fontWeight: 700 }}>{t.downloadTip}</p>
      </div>
    </main>
  );
}
