// tutorial.js — the opening tutorial, played inside the real run (every Start from
// the title; never on "Run again"). The first yokai drifts in and the game pauses
// on it. The coach spotlights the yokai, its equation, then the talisman (with a
// writing demo) and waits for a correct answer — wrong answers are coached, not
// punished. Then it explains hearts, asks "got it?", and counts the run in: 3, 2, 1.
import * as THREE from 'three';
import { createCoach } from '../ui/coach.js';
import { sfx } from '../ui/audio.js';
import * as ui from '../ui/ui.js';
import { S } from './state.js';
import { world } from './stage.js';
import { showRank } from './progress.js';
import { spawn, removeEnemy } from './enemies.js';
import { pad } from './handwriting.js';
import { cast } from './combat.js';
import { $ } from './helpers.js';

const TUT_YOKAI = { type: 'onibi', lane: 1, text: '1 + 2', answer: 3, z: -25, speed: 10 };   // reaches the stop ~1.1 s after Start
const TUT_FREEZE_Z = -14;            // where the parade halts for the coach

export const coach = createCoach();

/* ---------- what the spotlight frames ---------- */
const padded = (r, p) => ({ x: r.left - p, y: r.top - p, w: r.width + p * 2, h: r.height + p * 2 });
const tutA = new THREE.Vector3(), tutB = new THREE.Vector3(), scrA = { x: 0, y: 0 }, scrB = { x: 0, y: 0 };

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
// approach → yokai → equation → write → flying → banished → nice → danger → ready → countdown
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
  const skip = { label: ui.t('tutSkip'), kind: 'ghost', onClick: () => finishTutorial() };
  const next = (to) => [skip, { label: ui.t('tutNext'), onClick: () => tutStep(to) }];
  if (step === 'yokai') {
    coach.focus(yokaiSpot);
    coach.say({ title: ui.t('tutYokaiT'), text: ui.t('tutYokai'), buttons: next('equation') });
  } else if (step === 'equation') {
    coach.focus(tagSpot);
    coach.say({ title: ui.t('tutEqT'), text: ui.t('tutEq'), buttons: next('write') });
  } else if (step === 'write') {
    coach.focus(elSpot('talisman', 12));
    coach.say({ title: ui.t('tutWriteT'), text: ui.t('tutWrite'), buttons: [skip] });
    coach.demo(true, () => $('pad').getBoundingClientRect());
    pad.setEnabled(true);
  } else if (step === 'nice') {
    coach.focus(null, { dim: false });
    coach.say({ title: ui.t('tutNiceT'), text: ui.t('tutNice'), buttons: next('danger') });
  } else if (step === 'danger') {
    coach.focus(elSpot('hearts', 10));
    coach.say({ title: ui.t('tutDangerT'), text: ui.t('tutDanger'), buttons: next('ready') });
  } else if (step === 'ready') {
    coach.focus(null);
    coach.say({
      title: ui.t('tutReadyT'), text: ui.t('tutReady'),
      buttons: [
        { label: ui.t('tutReplay'), kind: 'ghost', onClick: replayTutorial },
        { label: ui.t('tutGo'), onClick: () => finishTutorial() },
      ],
    });
  }
}

// per frame while the tutorial runs
export function updateTutorial(dt) {
  const T = S.tut;
  if (T.step === 'approach' && T.e && T.e.z >= TUT_FREEZE_Z) T.frozen = true;   // the parade halts…
  if (T.step === 'approach' && T.frozen && (S.mode === 'playing' || S.introT > 1.2)) tutStep('yokai');   // …and as the camera lands, the coach takes over
  if (T.step === 'flying' && T.e.dying) { T.step = 'banished'; T.timer = 0.9; }   // let the seal and sparks play first
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
  if (T.step !== 'write') return;
  if (dec.kind === 'hit') {
    ui.showAI(result.img28, result.probs, { text: ui.t('aiRead', { d: dec.d, p: pct }), cls: 'ok' });
    pad.setEnabled(false);
    coach.demo(false);
    coach.hush();
    coach.focus(null, { dim: false });
    T.step = 'flying';
    cast(dec.d, paper);
    return;
  }
  ui.showAI(result.img28, result.probs, { text: ui.t(dec.kind === 'unclear' ? 'aiUnsure' : 'aiRead', { d: dec.d, p: pct }), cls: 'warn' });
  ui.talismanState('shake');
  sfx.unclear();
  if (dec.kind === 'unclear') coach.nudge(ui.t('tutUnclear'));
  else {
    T.misses++;
    coach.nudge(`${ui.t('tutWrong', { d: dec.d })}${T.misses >= 2 ? ' ' + ui.t('tutHint') : ''}`);
  }
  coach.demo(true);
}

function replayTutorial() {
  for (const e of [...S.enemies]) removeEnemy(e);
  Object.assign(S.tut, { step: 'approach', frozen: false, misses: 0 });
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
  coach.hush();
  coach.demo(false);
  coach.focus(null, { dim: false });
  pad.setEnabled(false);
  pad.clear();
  for (const e of [...S.enemies]) removeEnemy(e);
  await coach.countdown(['3', '2', '1', ui.t('go')], (i) => sfx.countdown(i, i === 3));
  if (S.tut !== T) return;                  // the run was left meanwhile
  S.tut = null;
  coach.show(false);
  Object.assign(S, { score: 0, distance: 0, banished: 0, combo: 0, maxCombo: 0, wave: 1, spawnTimer: 0.4, ai: { reads: 0, fixed: 0, unclear: 0 } });
  ui.setScore(0);
  ui.setDistance(0);
  ui.setCombo(0);
  showRank();
  ui.resetAI();
  pad.setEnabled(true);
}
