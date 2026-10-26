// dailyRun.js — playing the daily challenge. No running: the hero stands on the
// graveyard's altar and the day's yokai come one at a time, each climbing out of a
// grave and drifting over to wait in front of him; the clock runs while it waits (the
// real clock: pausing or leaving the page doesn't stop it); one try per problem. Every
// few banishments a bigger spell, and the last one — the oni, out of the great tomb —
// gets the finale. A wrong answer: the yokai laughs and sinks back into the ground.
import * as THREE from 'three';
import { sfx } from '../ui/audio.js';
import * as ui from '../ui/ui.js';
import { S } from './state.js';
import { world, hero, fx } from './stage.js';
import { spawn, removeEnemy } from './enemies.js';
import { pad } from './handwriting.js';
import { addScore, showRank } from './progress.js';
import { emit } from './events.js';
import { DAILY_COUNT, FULL_TIME, dailyProblems, todayKey, timeShare, pointsFor } from './daily.js';

const STOP = new THREE.Vector3(0, 0, -9.5);   // where a yokai waits for the answer
const RISE_DEPTH = 2.4, RISE_TIME = 1.1;       // climbing out of the grave
const SINK_TIME = 0.9;                         // going back in
const DRIFT_SPEED = 7;
const tmp = new THREE.Vector3();
const easeOut = (k) => 1 - Math.pow(1 - k, 3);

// small timeline: things to do a moment from now (in game time, so slow motion slows them too)
let pending = [];
const later = (seconds, action) => pending.push({ at: S.t + seconds, action });

/* ---------- the run ---------- */
export function startDaily() {
  const key = todayKey();
  S.daily = { key, problems: dailyProblems(key), index: -1, outcomes: Array(DAILY_COUNT).fill(null), stage: 'between', e: null, moveT: 0, askStart: 0, askT: 0 };
  pending = [];
  document.body.classList.add('daily-run');
  hero.setGazeAhead(true);
  showRank();
  later(0.6, nextYokai);
}

export function stopDaily() {
  pending = [];
  ui.setDailyWorth(null);
  document.body.classList.remove('daily-run');
}

function nextYokai() {
  const d = S.daily;
  d.index++;
  if (d.index >= DAILY_COUNT) { later(0.8, () => emit('dailyFinished')); return; }
  const problem = d.problems[d.index];
  const [x, z] = pickGrave(problem.type === 'oni');
  const e = spawn(false, { type: problem.type, lane: 1, text: problem.text, answer: problem.answer, x, z, speed: 0, free: true });
  e.problem = problem;
  e.yokai.root.position.y = -RISE_DEPTH;
  d.e = e;
  d.stage = 'rising';
  d.moveT = 0;
  // the earth breaks open
  const at = new THREE.Vector3(x, 0.15, z);
  fx.ring(at, { color: 0x9a6aff, scale: 3, dur: 0.6 });
  fx.emit(at, { count: 36, color: 0x6a4a5a, color2: 0x2a1a2a, bright: 0.5, speed: 3.5, life: 0.9, size: 0.28, up: 1 });
  world.shake(problem.type === 'oni' ? 0.5 : 0.12);
  ui.setDailyWorth(problem.worth);
  if (problem.type === 'oni') { ui.banner(ui.t('dailyBoss'), 'boss', 2); sfx.boss(); world.shake(0.3); }
}

// per frame while the daily challenge runs
export function updateDaily(dt) {
  const d = S.daily;
  const due = pending.filter((p) => S.t >= p.at);
  pending = pending.filter((p) => S.t < p.at);
  for (const p of due) p.action();
  const e = d.e;
  if (!e) return;
  const p = e.yokai.root.position;
  if (d.stage === 'rising') {
    d.moveT += dt;
    p.y = -RISE_DEPTH * (1 - easeOut(Math.min(1, d.moveT / RISE_TIME)));
    if (d.moveT >= RISE_TIME) d.stage = 'drifting';
  } else if (d.stage === 'drifting') {
    // straight from the grave to the altar's edge
    tmp.subVectors(STOP, p).setY(0);
    const left = tmp.length(), step = DRIFT_SPEED * dt;
    if (left <= step) {
      p.x = STOP.x; p.z = STOP.z;
      d.stage = 'asking';
      d.askStart = performance.now();
      d.askT = 0;
      pad.setEnabled(true);
    } else {
      p.addScaledVector(tmp.divideScalar(left), step);
    }
  } else if (d.stage === 'asking') {
    d.askT = (performance.now() - d.askStart) / 1000;
    ui.setDailyWorth(pointsFor(e.problem, d.askT), timeShare(d.askT));
  } else if (d.stage === 'sinking') {
    d.moveT += dt;
    p.y = -RISE_DEPTH * Math.pow(Math.min(1, d.moveT / SINK_TIME), 2);
    if (d.moveT >= SINK_TIME) { removeEnemy(e); d.e = null; d.stage = 'between'; }
  }
}

// a grave near the altar, never the same one twice in a row; the oni gets the tomb
let lastGrave = -1;
function pickGrave(boss) {
  const { spawn: graves, tomb } = world.graves;
  if (boss) return tomb;
  let i;
  do i = Math.floor(Math.random() * graves.length); while (i === lastGrave);
  lastGrave = i;
  return graves[i];
}

/* ---------- answering ---------- */
// the talisman was read: one try per problem (an unclear reading just asks again)
export function dailyAnswer({ dec, result, paper, pct }) {
  const d = S.daily;
  if (d.stage !== 'asking') return;
  if (dec.kind === 'unclear' || dec.kind === 'idle') {
    ui.showAI(result.img28, result.probs, { text: ui.t('aiUnsure', { d: dec.d, p: pct }), cls: 'warn' });
    ui.padToast(ui.t('unclear'), 'warn');
    ui.talismanState('shake');
    sfx.unclear();
    return;
  }
  pad.setEnabled(false);
  ui.setDailyWorth(null);
  const e = d.e;
  const right = dec.d === e.problem.answer;
  ui.showAI(result.img28, result.probs, { text: ui.t('aiRead', { d: dec.d, p: pct }), cls: right ? 'ok' : 'bad' });
  if (right) {
    const points = pointsFor(e.problem, d.askT);
    d.outcomes[d.index] = { mark: d.askT <= FULL_TIME ? 'full' : 'slow', points };
    d.stage = 'casting';
    castSpell(e, paper, points);
  } else {
    d.outcomes[d.index] = { mark: 'wrong', points: 0 };
    d.stage = 'gloating';
    miss(e, dec.d);
  }
  showRank();
}

/* ---------- spells ---------- */
// which spell: the finale for the last, lightning every 5th, a volley every 3rd
function spellFor(index) {
  if (index === DAILY_COUNT - 1) return 'finale';
  if ((index + 1) % 5 === 0) return 'thunder';
  if ((index + 1) % 3 === 0) return 'volley';
  return 'talisman';
}

function paperTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function castFrom(color) {
  const from = world.handPosition(new THREE.Vector3());
  hero.cast();
  fx.magicCircle(from.clone().add(new THREE.Vector3(0, 0.05, -0.25)), { color, scale: 1.4, dur: 0.6 });
  sfx.cast();
  return from;
}

// talismans fly at the yokai; `count` > 1 fans them out; the last to land banishes it
function volley(e, paper, count, color, onLand) {
  const tex = paperTexture(paper);
  const from = castFrom(color);
  for (let i = 0; i < count; i++) {
    fx.talisman(tex, from, (out) => e.yokai.center(out), {
      dur: 0.32 + i * 0.07, side: (i - (count - 1) / 2) * 1.8, color,
      onHit: (p) => {
        fx.emit(p, { count: 18, color, color2: 0xffffff, bright: 2, speed: 4, life: 0.5, size: 0.2 });
        if (i === count - 1) onLand();
      },
    });
  }
}

function castSpell(e, paper, points) {
  const spell = spellFor(S.daily.index);
  const p = e.yokai.center(new THREE.Vector3());
  ui.talismanState('cast');
  if (spell === 'talisman') {
    volley(e, paper, 1, 0xffc84a, () => banish(e, points));
  } else if (spell === 'volley') {
    // five talismans fan out from the hand and converge
    ui.banner(ui.t('spellVolley'), 'multi');
    volley(e, paper, 5, 0x6fd8ff, () => banish(e, points));
  } else if (spell === 'thunder') {
    // a seal opens above the yokai, then lightning falls on it
    ui.banner(ui.t('spellThunder'), 'multi');
    castFrom(0xbfe4ff);
    fx.magicCircle(tmp.copy(p).setY(p.y + 4.5), { color: 0x9fd4ff, scale: 4, dur: 0.9, spin: 4 });
    later(0.45, () => { fx.lightning(p); world.shake(0.6); sfx.hit(8); banish(e, points); });
  } else {
    finale(e, paper, points, p);
  }
}

// The last yokai: the Seimei kikyō seal. Slow motion, a vast pentagram on the ground,
// a volley of talismans, a pillar of light, lightning, a white flash, a giant 滅.
function finale(e, paper, points, p) {
  ui.banner(ui.t('spellFinale'), 'promo', 2);
  S.slowT = 2.2;
  fx.magicCircle(new THREE.Vector3(p.x, 0.08, p.z), { color: 0xffd36b, scale: 11, dur: 3.2, ground: true, spin: 2, bright: 2.8 });
  fx.magicCircle(new THREE.Vector3(0, 0.08, 0), { color: 0xff8a5a, scale: 5, dur: 3, ground: true, spin: -3, bright: 2.4 });
  world.shake(0.4);
  later(0.5, () => volley(e, paper, 8, 0xffd36b, () => {}));
  later(1.3, () => {
    fx.pillar(p, { color: 0xffe9a8, radius: 2.6, height: 34, dur: 1.8, bright: 3 });
    fx.lightning(p, { color: 0xfff1c4 });
    fx.ring(new THREE.Vector3(p.x, 0.2, p.z), { color: 0xffd36b, scale: 16, dur: 1 });
    fx.emit(p, { count: 160, color: 0xffe28a, color2: 0xff6a3a, bright: 2.6, speed: 12, life: 1.4, size: 0.3, gravity: -1, up: 0.6 });
    ui.screenFlash();
    world.shake(1);
    sfx.wave();
    banish(e, points, { size: 3, dur: 1.8 });
  });
}

// the talisman landed: points, sparks, the 滅 seal, and on to the next yokai
function banish(e, points, seal = {}) {
  if (!S.enemies.includes(e) || e.dying) return;
  const p = e.yokai.center(new THREE.Vector3());
  const color = e.yokai.info.color;
  fx.emit(p, { count: 50, color: 0xffe28a, color2: color, bright: 2, speed: 7, life: 0.9, size: 0.3 });
  fx.ring(p, { color: 0xffd36b, scale: 4 });
  fx.seal(p, '滅', seal);
  sfx.hit(S.daily.index);
  addScore(points);
  ui.popup(`+${points.toLocaleString('en')}`, e.sx, e.sy, 'gold big');
  emit('banish', { type: e.yokai.type, combo: 0 });
  e.yokai.flash();
  e.dying = 0.0001;
  if (e.tag) { ui.setTagState(e.tag, 'hit'); ui.removeTag(e.tag, 600); e.tag = null; }
  S.daily.e = null;
  S.daily.stage = 'between';
  later(e.yokai.type === 'oni' ? 2.4 : 1.1, nextYokai);
}

// wrong: the yokai laughs and sinks back into the ground; the hero hangs his head
function miss(e, written) {
  ui.talismanState('fizzle');
  ui.padToast(ui.t('dailyWrong', { a: e.problem.answer }), 'bad');
  ui.popup(`✕ ${ui.t('dailyAnswerWas', { a: e.problem.answer })}`, e.sx, e.sy, 'miss big');
  sfx.miss();
  hero.dismay();
  e.yokai.flash();
  if (e.tag) { ui.removeTag(e.tag, 300); e.tag = null; }
  later(0.6, () => {                           // a beat to gloat, then back in
    if (!S.daily || S.daily.e !== e) return;
    S.daily.stage = 'sinking';
    S.daily.moveT = 0;
    fx.emit(tmp.copy(e.yokai.root.position).setY(0.15), { count: 24, color: 0x6a4a5a, color2: 0x2a1a2a, bright: 0.5, speed: 2.5, life: 0.8, size: 0.25, up: 0.8 });
  });
  later(2.0, () => { if (S.daily && S.daily.e === e) { removeEnemy(e); S.daily.e = null; } S.daily.stage = 'between'; nextYokai(); });
}

export const dailyScore = () => S.daily.outcomes.reduce((sum, o) => sum + (o?.points ?? 0), 0);
