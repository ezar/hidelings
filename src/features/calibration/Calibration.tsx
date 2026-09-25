// Field-of-view calibration (spec 4.1 step 3, 8.3). A test Pompón is anchored in front of the player; while
// they turn, the image shift between frames and the gyroscope rotation give the field of view. The slider
// is the manual fallback: move it until Pompón stays glued to what is behind it.
import { useEffect, useRef, useState } from 'react';
import { fill } from '../../i18n/strings';
import { grabFrame } from '../../perception/depth/grab';
import { FovCalibrator, estimateShift, fovFromShift, toGray, type GrayImage } from '../../perception/motion/calibration';
import { getOrientation } from '../../perception/motion/orientation';
import { cameraTans, ray, toWorld, type Mat3 } from '../../perception/motion/rotation';
import { log } from '../../app/report';
import { useSession, useSettings, useT } from '../../app/store';
import { useStage } from '../stage/useStage';

interface Sample {
  gray: GrayImage;
  pose: Mat3;
}

function rotationDeg(a: Mat3, b: Mat3): number {
  const trace = a[0] * b[0] + a[3] * b[3] + a[6] * b[6] + a[1] * b[1] + a[4] * b[4] + a[7] * b[7] + a[2] * b[2] + a[5] * b[5] + a[8] * b[8];
  return (Math.acos(Math.min(1, Math.max(-1, (trace - 1) / 2))) * 180) / Math.PI;
}

export function Calibration() {
  const t = useT();
  const setPhase = useSession(s => s.set);
  const { fovDeg, setFov } = useSettings();
  const videoRef = useRef<HTMLVideoElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const { rendererRef, syncView } = useStage(videoRef, glRef);
  const fovRef = useRef(fovDeg);
  const [fov, setFovLocal] = useState(fovDeg);
  const [progress, setProgress] = useState({ count: 0, left: false, right: false, result: null as number | null });
  const [manual, setManual] = useState(false);

  useEffect(() => { fovRef.current = fov; }, [fov]);

  // Render loop with the test creature, placed straight ahead once the camera has a size.
  useEffect(() => {
    let raf = 0;
    let placed = false;
    const frame = (now: number) => {
      const renderer = syncView(fovRef.current);
      const video = videoRef.current;
      if (renderer && video?.videoWidth) {
        if (!placed) {
          renderer.setOcclusion(false);
          const tans = cameraTans(fovRef.current, video.videoWidth, video.videoHeight);
          renderer.addCreature(toWorld(getOrientation(), ray({ u: 0.5, v: 0.55 }, tans)), 0.5, toWorld(getOrientation(), [0, 1, 0]));
          placed = true;
        }
        renderer.render(getOrientation(), now);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [syncView, rendererRef]);

  // Measurement loop: compare frames a few degrees apart.
  useEffect(() => {
    if (manual) return;
    const calibrator = new FovCalibrator();
    let ref: Sample | null = null;
    const id = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      const pose = getOrientation();
      const frame = grabFrame(video, 160);
      if (!frame) return;
      const sample = { gray: toGray(frame, 96), pose };
      if (!ref) { ref = sample; return; }
      const angle = rotationDeg(ref.pose, pose);
      if (angle < 2.5) return;
      if (angle > 10) { ref = sample; return; }
      const shift = estimateShift(ref.gray, sample.gray, 14, 4);
      if (shift && shift.confidence > 0.35) {
        const du = shift.dx / sample.gray.width;
        const estimate = fovFromShift(ref.pose, pose, du, video.videoWidth, video.videoHeight);
        if (estimate) {
          calibrator.add(estimate, du);
          const result = calibrator.result();
          if (result) setFovLocal(Math.round(result));
        }
      }
      ref = sample;
      setProgress({ count: calibrator.count, left: calibrator.left, right: calibrator.right, result: calibrator.result() });
    }, 120);
    return () => clearInterval(id);
  }, [manual]);

  const save = () => {
    setFov(fov, true);
    log(`Calibration: ${fov}° (${manual ? 'manual' : `${progress.count} samples`})`);
    setPhase({ phase: 'game' });
  };
  const skip = () => {
    setFov(fovDeg, true);
    log('Calibration skipped');
    setPhase({ phase: 'game' });
  };

  const chip = (done: boolean, label: string) => (
    <span className="chip" data-done={done}>{done ? '✓ ' : ''}{label}</span>
  );

  return (
    <div className="stage">
      <video ref={videoRef} playsInline muted />
      <canvas ref={glRef} />
      <div className="hud-top">
        <div className="card" style={{ pointerEvents: 'auto', border: '2px solid var(--ink)', background: 'var(--paper)' }}>
          <h1 className="title" style={{ fontSize: 24 }}>{t.calibTitle}</h1>
          <p style={{ margin: '6px 0 0', fontWeight: 700, fontSize: 16 }}>{t.calibBody}</p>
        </div>
      </div>
      <div className="hud-bottom">
        <div className="sheet">
          {manual ? (
            <label style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              {fill(t.calibSlider, { fov })}
              <input type="range" min={40} max={90} value={fov} onChange={e => setFovLocal(Number(e.target.value))} />
            </label>
          ) : (
            <>
              <div className="row" style={{ justifyContent: 'center' }}>
                {chip(progress.left, t.calibLeft)}
                {chip(progress.right, t.calibRight)}
              </div>
              <p className="center" style={{ margin: 0, fontWeight: 800 }}>
                {progress.result ? fill(t.calibDone, { fov }) : fill(t.calibProgress, { count: progress.count, fov })}
              </p>
            </>
          )}
        </div>
        <div className="row">
          <button className="btn btn-glass" onClick={() => setManual(m => !m)}>{manual ? t.calibrate : t.calibManual}</button>
          <button className="btn btn-glass" onClick={skip}>{t.calibSkip}</button>
          <button className="btn btn-primary" disabled={!manual && !progress.result} onClick={save}>{t.calibSave}</button>
        </div>
      </div>
    </div>
  );
}
