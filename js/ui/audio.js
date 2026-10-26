// audio.js — every sound is synthesized with WebAudio (no audio files, no licensing):
// shrine bells for hits, taiko for damage, and a quiet koto + taiko loop.

let ctx = null, master = null, sfxBus = null, musicBus = null, noise = null;
let muted = false;
let musicOn = false, nextBeat = 0, step = 0, bpm = 92, schedTimer = 0;

// Japanese "In" scale (D Eb G A Bb) across two octaves
const SCALE = [293.66, 311.13, 392.0, 440.0, 466.16, 587.33, 622.25, 783.99];

export function initAudio() {
  if (ctx) { ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.9;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.35; musicBus.connect(master);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
}

const now = () => ctx.currentTime;

function env(gainNode, t, peak, attack, decay) {
  gainNode.gain.setValueAtTime(0.0001, t);
  gainNode.gain.exponentialRampToValueAtTime(peak, t + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function bell(freq, t = now(), vol = 0.35, dur = 1.4, bus = sfxBus) {
  [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.93, 0.1]].forEach(([mult, g]) => {
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq * mult;
    env(gn, t, vol * g, 0.005, dur / mult ** 0.35);
    o.connect(gn).connect(bus);
    o.start(t); o.stop(t + dur + 0.1);
  });
}

function noiseBurst(t, dur, { type = 'bandpass', f0 = 800, f1 = 2400, q = 1.2, vol = 0.3, bus = sfxBus } = {}) {
  const src = ctx.createBufferSource(); src.buffer = noise;
  const filt = ctx.createBiquadFilter(); filt.type = type; filt.Q.value = q;
  filt.frequency.setValueAtTime(f0, t);
  filt.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const gn = ctx.createGain();
  env(gn, t, vol, 0.01, dur);
  src.connect(filt).connect(gn).connect(bus);
  src.start(t); src.stop(t + dur + 0.05);
}

function drum(t, { f0 = 130, f1 = 48, vol = 0.6, dur = 0.35, bus = sfxBus } = {}) {
  const o = ctx.createOscillator(), gn = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
  env(gn, t, vol, 0.004, dur);
  o.connect(gn).connect(bus);
  o.start(t); o.stop(t + dur + 0.05);
  noiseBurst(t, 0.05, { type: 'lowpass', f0: 1200, f1: 300, vol: vol * 0.3, bus });
}

function pluck(freq, t, vol = 0.18, bus = musicBus) {
  const o = ctx.createOscillator(), gn = ctx.createGain(), lp = ctx.createBiquadFilter();
  o.type = 'triangle';
  o.frequency.value = freq;
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(freq * 6, t);
  lp.frequency.exponentialRampToValueAtTime(freq * 1.2, t + 0.5);
  env(gn, t, vol, 0.003, 0.9);
  o.connect(lp).connect(gn).connect(bus);
  o.start(t); o.stop(t + 1);
}

/* ---------- game sounds ---------- */
const ok = () => ctx && !muted;

export const sfx = {
  cast() { if (ok()) noiseBurst(now(), 0.22, { f0: 600, f1: 3200, vol: 0.22 }); },
  hit(combo = 0) {
    if (!ok()) return;
    bell(SCALE[Math.min(SCALE.length - 1, 2 + (combo % 6))], now(), 0.32);
  },
  multi(n) {
    if (!ok()) return;
    for (let i = 0; i <= n; i++) bell(SCALE[Math.min(SCALE.length - 1, 3 + i)], now() + 0.08 + i * 0.07, 0.22, 1.1);
  },
  miss() {
    if (!ok()) return;
    drum(now(), { f0: 180, f1: 90, vol: 0.25, dur: 0.2 });
    noiseBurst(now(), 0.3, { type: 'lowpass', f0: 900, f1: 200, vol: 0.18 });
  },
  unclear() { if (ok()) pluck(220, now(), 0.12, sfxBus); },
  hurt() {
    if (!ok()) return;
    drum(now(), { f0: 120, f1: 40, vol: 0.9, dur: 0.5 });
    noiseBurst(now(), 0.25, { type: 'lowpass', f0: 2000, f1: 200, vol: 0.3 });
  },
  boss() {
    if (!ok()) return;
    drum(now(), { f0: 90, f1: 35, vol: 0.9, dur: 1.2 });
    bell(146.8, now() + 0.05, 0.3, 2.5);
  },
  wave() { if (ok()) [0, 2, 4].forEach((k, i) => pluck(SCALE[k] * 2, now() + i * 0.09, 0.2, sfxBus)); },
  heal() { if (ok()) [4, 5, 7].forEach((k, i) => bell(SCALE[k], now() + i * 0.1, 0.18, 1.2)); },
  over() { if (ok()) [5, 4, 2, 0].forEach((k, i) => pluck(SCALE[k], now() + i * 0.22, 0.25, sfxBus)); },
  click() { if (ok()) pluck(880, now(), 0.08, sfxBus); },
  // spells, skills, night events and the oni's finisher
  thunder() {
    if (!ok()) return;
    noiseBurst(now(), 0.5, { type: 'lowpass', f0: 5000, f1: 200, vol: 0.4 });
    drum(now() + 0.02, { f0: 110, f1: 40, vol: 0.5, dur: 0.5 });
  },
  pillar() { if (ok()) { noiseBurst(now(), 0.6, { f0: 300, f1: 4000, q: 2, vol: 0.2 }); bell(SCALE[5], now(), 0.18, 1.2); } },
  blink() { if (ok()) noiseBurst(now(), 0.18, { f0: 2400, f1: 600, q: 4, vol: 0.12 }); },
  skillReady() { if (ok()) [2, 4, 6, 7].forEach((k, i) => bell(SCALE[k], now() + i * 0.06, 0.16, 1.4)); },
  skill() {
    if (!ok()) return;
    drum(now(), { f0: 140, f1: 50, vol: 0.7, dur: 0.5 });
    [7, 5, 4].forEach((k, i) => bell(SCALE[k], now() + 0.05 + i * 0.05, 0.22, 1.8));
  },
  event() {
    if (!ok()) return;
    drum(now(), { f0: 100, f1: 45, vol: 0.5, dur: 0.6 });
    [0, 3, 5].forEach((k, i) => pluck(SCALE[k], now() + 0.1 + i * 0.14, 0.2, sfxBus));
  },
  finisher() {
    if (!ok()) return;
    const t = now();
    drum(t, { f0: 80, f1: 30, vol: 1, dur: 1.4 });
    noiseBurst(t, 1.4, { f0: 200, f1: 6000, q: 1.5, vol: 0.35 });
    [0, 2, 4, 5, 7].forEach((k, i) => bell(SCALE[k] * 0.5, t + 0.25 + i * 0.09, 0.3, 2.6));
    [0, 0.35, 0.7].forEach((d) => drum(t + 0.6 + d, { f0: 120, f1: 45, vol: 0.7, dur: 0.4 }));
  },
  // tutorial
  coach() { if (ok()) [4, 6].forEach((k, i) => pluck(SCALE[k] * 2, now() + i * 0.07, 0.1, sfxBus)); },
  countdown(i, last) {
    if (!ok()) return;
    if (!last) drum(now(), { f0: 150, f1: 70, vol: 0.55, dur: 0.25 });
    else [2, 4, 5].forEach((k, j) => bell(SCALE[k], now() + j * 0.06, 0.26, 1.3));
  },
  // capture cinematic
  portal() {
    if (!ok()) return;
    const t = now();
    noiseBurst(t, 1.6, { f0: 120, f1: 1400, q: 3, vol: 0.25 });
    drum(t, { f0: 70, f1: 30, vol: 0.7, dur: 1.4 });
  },
  roar() {
    if (!ok()) return;
    const t = now();
    for (const f of [72, 75.5, 108]) {
      const o = ctx.createOscillator(), gn = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t);
      o.frequency.linearRampToValueAtTime(f * 0.7, t + 1.3);
      lp.type = 'lowpass'; lp.frequency.value = 650;
      env(gn, t, 0.22, 0.12, 1.3);
      o.connect(lp).connect(gn).connect(sfxBus);
      o.start(t); o.stop(t + 1.5);
    }
    noiseBurst(t, 1.2, { type: 'lowpass', f0: 900, f1: 250, vol: 0.3 });
  },
  grab() { if (ok()) drum(now(), { f0: 160, f1: 60, vol: 0.8, dur: 0.3 }); },
  laugh() {
    if (!ok()) return;
    for (let i = 0; i < 6; i++) {
      const t = now() + i * 0.17;
      const o = ctx.createOscillator(), gn = ctx.createGain(), bp = ctx.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(115 - i * 4, t);
      o.frequency.exponentialRampToValueAtTime(80 - i * 3, t + 0.14);
      bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 2.5;
      env(gn, t, 0.35, 0.015, 0.14);
      o.connect(bp).connect(gn).connect(sfxBus);
      o.start(t); o.stop(t + 0.2);
    }
  },
};

/* ---------- background loop ---------- */
// 8-step pattern: taiko accents + sparse koto notes, tempo rises with the wave
const TAIKO = [1, 0, 0, 0.5, 0.8, 0, 0.4, 0];

function schedule() {
  while (nextBeat < ctx.currentTime + 0.25) {
    const t = nextBeat;
    const accent = TAIKO[step % 8];
    if (accent) drum(t, { f0: 110, f1: 52, vol: 0.32 * accent, dur: 0.3, bus: musicBus });
    if (step % 2 === 0 && Math.random() < 0.45) pluck(SCALE[Math.floor(Math.random() * SCALE.length)], t, 0.14);
    if (step % 16 === 0) pluck(SCALE[0] / 2, t, 0.2);
    step++;
    nextBeat += 60 / bpm / 2;
  }
}

export function startMusic() {
  if (!ctx || musicOn) return;
  musicOn = true;
  nextBeat = ctx.currentTime + 0.1;
  step = 0;
  schedTimer = setInterval(schedule, 90);
}
export function stopMusic() {
  musicOn = false;
  clearInterval(schedTimer);
}
export function setTempo(level) { bpm = Math.min(150, 88 + level * 5); }
