// Small synthesized sounds (spec 10), no audio files: hint chirps panned towards the creature, the
// nearly-found squeak and the catch jingle. iOS only lets audio start inside a tap, so unlockAudio() runs
// synchronously in the "Empezar" handler.

let ctx: AudioContext | null = null;
let muted = false;

export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function setMuted(value: boolean) {
  muted = value;
}

export type Sound = 'hint' | 'near' | 'catch' | 'place';

const NOTES: Record<Sound, { freqs: number[]; step: number; type: OscillatorType; gain: number }> = {
  hint: { freqs: [1400, 1900], step: 0.07, type: 'sine', gain: 0.18 },
  near: { freqs: [700, 1200], step: 0.08, type: 'triangle', gain: 0.2 },
  catch: { freqs: [660, 880, 1320], step: 0.09, type: 'triangle', gain: 0.22 },
  place: { freqs: [520, 780], step: 0.06, type: 'sine', gain: 0.15 },
};

/** Plays a sound, panned -1 (left) .. 1 (right), at `volume` (0..1) of its normal loudness. */
export function play(sound: Sound, pan = 0, volume = 1) {
  if (muted || !ctx || ctx.state !== 'running') return;
  const { freqs, step, type, gain } = NOTES[sound];
  const start = ctx.currentTime + 0.01;
  const panner = ctx.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan));
  panner.connect(ctx.destination);
  freqs.forEach((f, i) => {
    const osc = ctx!.createOscillator();
    const g = ctx!.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, start + i * step);
    g.gain.setValueAtTime(0, start + i * step);
    g.gain.linearRampToValueAtTime(gain * Math.max(0.05, Math.min(1, volume)), start + i * step + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, start + i * step + step * 1.6);
    osc.connect(g).connect(panner);
    osc.start(start + i * step);
    osc.stop(start + i * step + step * 1.8);
  });
}
