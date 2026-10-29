// tutorial.js — the opening tutorial, played inside the real run (every Start from
// the title; never on "Run again"). The first yokai drifts in and the game pauses
// on it. The coach spotlights the yokai, its equation, then the talisman (with a
// writing demo), then the seal that sends it, and waits for a correct answer —
// wrong answers are coached, not punished. Then it explains hearts, asks "got it?", and counts the run in: 3, 2, 1.
import * as THREE from 'three';
import { createCoach } from '../ui/coach.js';
import { sfx } from '../ui/audio.js';
import { resetAI, showAI } from '../ui/aiPanel.js';
import { setCombo, setDistance, setScore } from '../ui/hud.js';
import { talismanState } from '../ui/talisman.js';
import { S } from '../core/state.js';
import { world } from './stage.js';
import { showRank } from './progress.js';
import { spawn, removeEnemy } from './enemies.js';
import { pad } from './handwriting.js';
import { cast } from './combat.js';
import { $ } from '../core/dom.js';
import { t } from '../core/i18n.js';

const TUT_YOKAI = { type: 'onibi', lane: 1, text: '1 + 2', answer: 3, z: -25, speed: 10 };   // reaches the stop ~1.1 s after Start
const TUT_FREEZE_Z = -14;            // where the parade halts for the coach

export const coach = createCoach();

/* ---------- what the spotlight frames ---------- */
const padded = (r, p) => ({ x: r.left - p, y: r.top - p, w: r.width + p * 2, h: r.height + p * 2 });
const tutA = new THREE.Vector3();
const tutB = new THREE.Vector3();
const scrA = { x: 0, y: 0 };
const scrB = { x: 0, y: 0 };

function yokaiSpot() {
  const e = S.tut?.e;
  if (!e || !S.enemies.includes(e)) return null;
  world.project(e.yokai.center(tutA), scrA);
  world.project(tutB.copy(tutA).setY(tutA.y + 0.5), scrB);
  const r = Math.max(52, Math.abs(scrA.y - scrB.y) * 1.7);
  const s = $('stage').getBoundingClientRect();
  return { x: s.left + scrA.x - r, y: s.top + scrA.y - r, w: r * 2, h: r * 2, round: true };
}
function tagSpot() {
  const el = S.tut?.e?.tag?.querySelector('.tag-in');
  return el ? padded(el.getBoundingClientRect(), 10) : null;
}
const elSpot = (id, p = 10) => () => padded($(id).getBoundingClientRect(), p);

/* ---------- the steps ---------- */
// approach → yokai → equation → write → send → flying → banished → nice → danger → ready → countdown
export function startTutorial() {
  S.tut = { step: 'approach', frozen: false, e: null, misses: 0, timer: 0 };
  coach.show(true);
  coach.focus(null, { dim: false });
  coach.hush();
  pad.setEnabled(false);
  S.tut.e = spawn(false, TUT_YOKAI);
}

function tutStep(step) {
  if (!S.tut) return;
  S.tut.step = step;
  sfx.coach();
  // "Skip tutorial" sits just left of each step's main button (none on the last step,
  // whose "Keep running" already ends it)
  const skip = { label: t('tutSkip'), kind: 'ghost', onClick: () => finishTutorial() };
  const next = (to) => [skip, { label: t('tutNext'), onClick: () => tutStep(to) }];
  if (step === 'yokai') {
    coach.focus(yokaiSpot);
    coach.say({ title: t('tutYokaiT'), text: t('tutYokai'), buttons: next('equation') });
  } else if (step === 'equation') {
    coach.focus(tagSpot);
    coach.say({ title: t('tutEqT'), text: t('tutEq'), buttons: next('write') });
  } else if (step === 'write') {
    coach.focus(elSpot('talisman', 12));
    coach.say({ title: t('tutWriteT'), text: t('tutWrite'), buttons: [skip] });
    coach.demo(true, () => $('pad').getBoundingClientRect());
    pad.setEnabled(true);
  } else if (step === 'send') {
    // the pen has rested: the seal pulses (the bubble stays off the written digit)
    coach.demo(false);
    // the big seal shows on touch screens only; side by side (landscape) everything
    // but the seal dims, with the bubble above the talisman so the digit stays clear
    const touch = !!$('send-big').offsetParent;
    if (matchMedia('(max-aspect-ratio: 4/5)').matches) coach.focus(elSpot(touch ? 'send-big' : 'talisman', touch ? 8 : 12), { dim: false });
    else coach.focus(elSpot(touch ? 'send-big' : 'pad-send', 8), { near: elSpot('talisman', 12) });
    $('dock').classList.add('teach');
    coach.say({ title: t('tutSendT'), text: t(touch ? 'tutSendTouch' : 'tutSend'), buttons: [skip] });
  } else if (step === 'nice') {
    coach.focus(null, { dim: false });
    coach.say({ title: t('tutNiceT'), text: t('tutNice'), buttons: next('danger') });
  } else if (step === 'danger') {
    coach.focus(elSpot('hearts', 10));
    coach.say({ title: t('tutDangerT'), text: t('tutDanger'), buttons: next('ready') });
  } else if (step === 'ready') {
    coach.focus(null);
    coach.say({
      title: t('tutReadyT'), text: t('tutReady'),
      buttons: [
        { label: t('tutReplay'), kind: 'ghost', onClick: replayTutorial },
        { label: t('tutGo'), onClick: () => finishTutorial() },
      ],
    });
  }
}

// per frame while the tutorial runs
export function updateTutorial(dt) {
  const T = S.tut;
  if (T.step === 'approach' && T.e && T.e.z >= TUT_FREEZE_Z) T.frozen = true;   // the parade halts…
  if (T.step === 'approach' && T.frozen && (S.mode === 'playing' || S.introT > 1.2)) tutStep('yokai');   // …and as the camera lands, the coach takes over
  // written and resting a moment: on to the seal (writing again keeps it waiting)
  if (T.step === 'write') {
    T.timer = pad.hasInk() && !pad.writing ? T.timer + dt : 0;
    if (T.timer > 0.45) tutStep('send');
  }
  if (T.step === 'flying' && T.e.dying) {
    T.step = 'banished';
    T.timer = 0.9;
  }   // let the seal and sparks play first
  if (T.step === 'banished' && (T.timer -= dt) <= 0) tutStep('nice');
  coach.update(dt);
}

// the pen touched the talisman: the writing demo steps aside
export function tutorialWriting() {
  if (S.tut?.step === 'write') coach.demo(false);
}

// the talisman was read during the tutorial
export function tutorialAnswer({ dec, result, pct, paper }) {
  const T = S.tut;
  if (T.step !== 'write' && T.step !== 'send') return;
  $('dock').classList.remove('teach');
  if (dec.kind === 'hit') {
    showAI(result.img28, result.probs, { text: t('aiRead', { d: dec.d, p: pct }), cls: 'ok' });
    pad.setEnabled(false);
    coach.demo(false);
    coach.hush();
    coach.focus(null, { dim: false });
    T.step = 'flying';
    cast(dec.d, paper);
    return;
  }
  showAI(result.img28, result.probs, { text: t(dec.kind === 'unclear' ? 'aiUnsure' : 'aiRead', { d: dec.d, p: pct }), cls: 'warn' });
  talismanState('shake');
  sfx.unclear();
  if (T.step === 'send') {                  // back to writing, with the coaching below
    T.step = 'write';
    T.timer = 0;
    coach.focus(elSpot('talisman', 12));
    coach.say({ title: t('tutWriteT'), text: t('tutWrite'), buttons: [{ label: t('tutSkip'), kind: 'ghost', onClick: () => finishTutorial() }] });
  }
  if (dec.kind === 'unclear') coach.nudge(t('tutUnclear'));
  else {
    T.misses++;
    coach.nudge(`${t('tutWrong', { d: dec.d })}${T.misses >= 2 ? ' ' + t('tutHint') : ''}`);
  }
  coach.demo(true);
}

function replayTutorial() {
  for (const e of [...S.enemies]) removeEnemy(e);
  Object.assign(S.tut, { step: 'approach', frozen: false, misses: 0, timer: 0 });
  coach.hush();
  coach.focus(null, { dim: false });
  S.tut.e = spawn(false, TUT_YOKAI);
}

// "Keep running" or Skip: count the real run in, starting from a clean slate
export async function finishTutorial() {
  const T = S.tut;
  if (!T || T.step === 'countdown') return;
  T.step = 'countdown';
  T.frozen = false;
  $('dock').classList.remove('teach');
  coach.hush();
  coach.demo(false);
  coach.focus(null, { dim: false });
  pad.setEnabled(false);
  pad.clear();
  for (const e of [...S.enemies]) removeEnemy(e);
  await coach.countdown(['3', '2', '1', t('go')], (i) => sfx.countdown(i, i === 3));
  if (S.tut !== T) return;                  // the run was left meanwhile
  S.tut = null;
  coach.show(false);
  Object.assign(S, {
    score: 0,
    distance: 0,
    banished: 0,
    combo: 0,
    maxCombo: 0,
    spawnTimer: 0.4,
    ai: { reads: 0, fixed: 0, unclear: 0 },
  });
  setScore(0);
  setDistance(0);
  setCombo(0);
  showRank();
  resetAI();
  pad.setEnabled(true);
}
