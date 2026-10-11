// handwriting.js — the talisman the player writes on, and how its ink is read:
// a live guess while writing, then a final reading that takes the answers on
// screen into account. What happens next (a cast, or the tutorial's reaction)
// is plugged in by main.js through onTalisman().
import { classify, aiInfo } from '../ai/recognizer.js';
import { createPad, MODEL_SIZE } from '../ui/pad.js';
import * as ui from '../ui/ui.js';
import { S, targets } from './state.js';
import { director } from './stage.js';
import { $ } from './helpers.js';

let onWrite = () => {};
let onRead = () => {};
// write(): the pen touched the talisman · read({ dec, result, paper, pct }): it was read
export function onTalisman({ write, read }) {
  onWrite = write;
  onRead = read;
}

export const pad = createPad($('pad'), {
  onInput: () => { onWrite(); liveGuess(); },
  onFinish: readTalisman,
  onArm: (ms) => ui.armTalisman(ms),
  onDisarm: () => ui.disarmTalisman(),
});
new ResizeObserver(() => pad.resize()).observe($('pad'));

// while the player writes: what the model sees right now (at most ~7 times a second)
let liveBusy = false, liveLast = 0;
async function liveGuess() {
  if (!aiInfo.ready || liveBusy) return;
  const now = performance.now();
  if (now - liveLast < 140) return;
  liveLast = now;
  const rgba = pad.renderForModel();
  if (!rgba) return;
  liveBusy = true;
  try {
    const { probs, img28 } = await classify(rgba, MODEL_SIZE);
    const d = probs.indexOf(Math.max(...probs));
    ui.setGuess(d, probs[d]);
    ui.showAI(img28, probs);
  } finally {
    liveBusy = false;
  }
}

// Context-aware reading: the model's probabilities are combined with the answers
// currently on screen, so a sloppy 3 that looks a bit like an 8 still counts
// when a "3" yokai is present — but a clearly written wrong digit is a miss.
//   hit · miss (confident, but no yokai has that answer) · unclear · idle (no yokai)
export function decide(probs) {
  const answers = new Set(targets().map((e) => e.answer));
  const order = probs.map((p, d) => ({ p, d })).sort((a, b) => b.p - a.p);
  const top = order[0];
  if (!answers.size) return { kind: 'idle', ...top };
  const best = order.find((o) => answers.has(o.d));
  if (best.d === top.d && top.p >= 0.3) return { kind: 'hit', ...top };
  if (best.p >= 0.2 && best.p >= 0.35 * top.p) return { kind: 'hit', ...best, corrected: top.d };
  if (top.p >= 0.5) return { kind: 'miss', ...top };
  return { kind: 'unclear', ...top };
}

// the pen has rested long enough: read the talisman once, for real
async function readTalisman() {
  ui.disarmTalisman();
  if (!pad.hasInk() || pad.writing) return;
  const rgba = S.mode === 'playing' && aiInfo.ready ? pad.renderForModel() : null;
  if (!rgba) { pad.clear(); ui.setGuess(null); return; }

  pad.setEnabled(false);
  const paper = pad.snapshot();              // the written talisman, to fly at the yokai
  const began = pad.startedAt;
  let result;
  try {
    result = await classify(rgba, MODEL_SIZE);
  } catch (err) {
    console.error('[math-run] classify failed', err);
  }
  // pen down → reading: what one answer costs this player, so yokai never come faster
  if (result) director.noteWrite((performance.now() - began) / 1000);
  pad.clear();
  ui.setGuess(null);
  if (S.mode === 'playing' && S.cooldown <= 0) pad.setEnabled(true);
  if (!result || S.mode !== 'playing') return;

  const dec = decide(result.probs);
  onRead({ dec, result, paper, pct: Math.round(dec.p * 100) });
  ui.setAIMeta(`${aiInfo.backend} · ${aiInfo.latency.toFixed(1)} ms`);
}
