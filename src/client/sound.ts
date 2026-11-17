// Synthesised sounds (no audio files, no licensing): a papery "fwip" for each
// fold and a soft two-note chime for a solve. Muting is remembered per viewer.
const KEY = 'fold.muted';

let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();

const audio = () => {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
};

export const isMuted = () => muted;

export const setMuted = (m: boolean) => {
  muted = m;
  try {
    localStorage.setItem(KEY, m ? '1' : '0');
  } catch {
    /* per-session only */
  }
};

const buzz = (ms: number) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
};

export const playFold = () => {
  buzz(12);
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const len = 0.16;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const band = a.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 1.2;
  band.frequency.setValueAtTime(700, t);
  band.frequency.exponentialRampToValueAtTime(3200, t + len);
  const gain = a.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(band).connect(gain).connect(a.destination);
  src.start(t);
  src.stop(t + len);
};

export const playWin = () => {
  buzz(30);
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  [523.25, 783.99].forEach((f, i) => {
    const o = a.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = a.createGain();
    const s = t + i * 0.12;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.18, s + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.6);
    o.connect(g).connect(a.destination);
    o.start(s);
    o.stop(s + 0.65);
  });
};
