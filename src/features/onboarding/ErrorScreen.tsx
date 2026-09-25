import { startSession } from '../../app/session';
import { useSession, useT } from '../../app/store';

export function ErrorScreen() {
  const t = useT();
  const { error, errorDetail } = useSession();
  return (
    <main className="screen" style={{ justifyContent: 'center' }}>
      <h1 className="title center">{t.errorTitle}</h1>
      <p className="lead center">{error === 'camera' ? t.errorCamera : t.errorModel}</p>
      <p className="small center mono">{errorDetail}</p>
      <button className="btn btn-primary btn-big" onClick={() => void startSession()}>
        {t.retry}
      </button>
    </main>
  );
}
