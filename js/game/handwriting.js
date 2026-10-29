// handwriting.js — the talisman the player writes on, and how its ink is read:
// a live guess while writing, then a final reading that takes the answers on
// screen into account. What happens next (a cast, or the tutorial's reaction)
// is plugged in by main.js through onTalisman().
import { classify, aiInfo } from '../ai/recognizer.js';
import { createPad, MODEL_SIZE } from '../ui/pad.js';
import { setAIMeta, showAI } from '../ui/aiPanel.js';
import { armTalisman, disarmTalisman, setGuess } from '../ui/talisman.js';
import { S, targets } from '../core/state.js';
import { director } from './stage.js';
import { $ } from '../core/dom.js';

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
  onArm: (ms) => armTalisman(ms),
  onDisarm: () => disarmTalisman(),
  onInk: (has) => $('dock').classList.toggle('inked', has),
  holdAuto: () => !!S.tut,                     // the tutorial teaches the seal: it waits for it
});
// the seal at the talisman's foot, the big one beside it (touch) or Space sends it at once
for (const id of ['pad-send', 'send-big']) $(id).addEventListener('click', (e) => { e.currentTarget.blur(); pad.send(); });
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
    setGuess(d, probs[d]);
    showAI(img28, probs);
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

// the pen has rested long enough (or the player sent it): read the talisman once, for real
async function readTalisman() {
  disarmTalisman();
  if (!pad.hasInk() || pad.writing) return;
  const rgba = S.mode === 'playing' && aiInfo.ready ? pad.renderForModel() : null;
  if (!rgba) { pad.clear(); setGuess(null); return; }

  pad.setEnabled(false);
  const paper = pad.snapshot();              // the written talisman, to fly at the yokai
  const pace = pad.paceTime;
  let result;
  try {
    result = await classify(rgba, MODEL_SIZE);
  } catch (err) {
    console.error('[math-run] classify failed', err);
  }
  // pen down → reading: what one answer costs this player, so yokai never come faster
  if (result) director.noteWrite(pace);
  const dec = result && S.mode === 'playing' ? decide(result.probs) : null;
  if (dec?.kind === 'hit') pad.flare();
  pad.clear();
  setGuess(null);
  if (S.mode === 'playing' && S.cooldown <= 0) pad.setEnabled(true);
  if (!dec) return;

  onRead({ dec, result, paper, pct: Math.round(dec.p * 100) });
  setAIMeta(`${aiInfo.backend} · ${aiInfo.latency.toFixed(1)} ms`, `${aiInfo.model} on ${aiInfo.backend}`);
}
