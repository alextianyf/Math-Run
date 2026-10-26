// powers.js — what makes a run more than answering: banishing yokai charges a random
// skill (time seal, thunder god, barrier, good fortune), every NIGHT_EVERY metres the
// run moves on to another night (full moon, mist, the parade, the fox's blessing —
// the scene changes while the path is quiet), a hint card points out a yokai's trick
// the first few times it shows up, and the trial oni goes down with a finisher.
// None of it runs during the tutorial.
import * as THREE from 'three';
import { sfx } from '../ui/audio.js';
import * as ui from '../ui/ui.js';
import { S, targets } from './state.js';
import { world, hero, fx } from './stage.js';
import { banishFree } from './combat.js';
import { emit } from './events.js';
import { YOKAI_LOOK } from './yokaiInfo.js';
import { $, rand } from './helpers.js';

/* ===================== timing helpers ===================== */
// things to do a moment later, on the game's own clock (so a pause holds them too)
const queue = [];
export function later(delay, fn) { queue.push({ t: delay, fn }); }

/* ===================== nights ===================== */
// the run cycles through these, one every NIGHT_EVERY metres; each changes the scene
// (scene/themes.js) and one rule while it lasts
const NIGHT_EVERY = 1000;
const CYCLE = ['night', 'moon', 'fog', 'parade', 'fox'];
export const NIGHTS = {
  night: {},                                   // the usual festival night
  moon: { score: 2, pace: 1.25 },              // full moon: double points, faster yokai
  fog: { fog: true },                          // mist: equations only show up close
  parade: { spawn: 0.6, alive: 1 },            // the parade: more yokai at once
  fox: { charge: 2 },                          // the fox's blessing: skills charge twice as fast
};
// a change of night: wait for the path to clear (at most CLEAR_S), blend the scene
// over SHIFT_S with the night's name on screen, then a breath of CALM_S before yokai return
const CLEAR_S = 8, SHIFT_S = 3.5, CALM_S = 1.8;

// the rules of the current night apply while it is on (and while the path clears for the next)
const rules = () => (S.night.state === 'on' || S.night.state === 'clearing' ? NIGHTS[S.night.id] : NIGHTS.night);
export const scoreMult = () => (rules().score ?? 1) * (S.lucky > 0 ? 2 : 1);
export const paceMult = () => (S.freeze > 0 ? 0 : rules().pace ?? 1);
export const spawnMult = () => rules().spawn ?? 1;
export const aliveBonus = () => rules().alive ?? 0;
export const frozen = () => S.freeze > 0;
export const holdSpawns = () => !S.tut && S.night.state !== 'on';
// in the mist an equation fades in only as its yokai comes near (0 far → 1 at the hero)
export const tagVisibility = (near) => (rules().fog ? THREE.MathUtils.smoothstep(near, 0.32, 0.55) : 1);

function stepNight(dt) {
  const n = S.night;
  n.t += dt;
  if (n.state === 'on') {
    if (S.distance >= S.nextNightAt && !S.pendingBoss && !S.enemies.some((o) => o.boss && !o.dying)) {
      Object.assign(n, { state: 'clearing', t: 0 });        // no new yokai from here
    }
  } else if (n.state === 'clearing') {
    if (!targets().length || n.t > CLEAR_S) {
      const id = CYCLE[(CYCLE.indexOf(n.id) + 1) % CYCLE.length];
      Object.assign(n, { id, state: 'shifting', t: 0 });
      world.setTheme(id, SHIFT_S);
      document.body.dataset.night = id;
      later(0.6, () => {
        ui.banner('', 'event', 1, { html: `<span class="ev-kicker">${ui.t('nightEnter')}</span><span class="ev-title">${ui.t(`ev_${id}`)}</span><span class="ev-sub">${ui.t(`evd_${id}`)}</span>`, ms: 3400 });
        sfx.event();
      });
      emit('night', { id });
    }
  } else if (n.state === 'shifting' && n.t >= SHIFT_S) {
    Object.assign(n, { state: 'calm', t: 0 });
  } else if (n.state === 'calm' && n.t >= CALM_S) {
    Object.assign(n, { state: 'on', t: 0 });
    S.nextNightAt = S.distance + NIGHT_EVERY;
    S.spawnTimer = Math.min(S.spawnTimer, 0.6);
    if (n.id === 'fox') charge(0.3);
  }
}

/* ===================== skills ===================== */
// The seal charges mostly by banishing yokai, and slowly with time; full, it offers
// one skill, picked at random.
const CHARGE_PER_KILL = 0.17, CHARGE_PER_SECOND = 1 / 150;
export const SKILLS = {
  freeze: { ch: '停', color: 0x8fd8ff },        // time seal: every yokai stands still
  thunder: { ch: '雷', color: 0xbfe6ff },       // thunder god: lightning banishes all on screen
  barrier: { ch: '結', color: 0x7be0a0 },       // barrier: the next yokai to reach you is stopped
  lucky: { ch: '福', color: 0xffd36b },         // good fortune: double points for a while
};
const FREEZE_S = 5, LUCKY_S = 12;
let barrierFx = null;

export function charge(amount) {
  if (S.tut || S.skill) return;
  S.charge = Math.min(1, S.charge + amount * (rules().charge ?? 1));
  if (S.charge >= 1) {
    const pool = Object.keys(SKILLS).filter((id) => !(id === 'barrier' && S.barrier));
    S.skill = pool[Math.floor(Math.random() * pool.length)];
    sfx.skillReady();
  }
  renderSkill();
}
// n yokai banished by one answer (a boss or nekomata hit counts for less)
export const chargeKill = (n = 1) => charge(CHARGE_PER_KILL * n);

export function useSkill() {
  if (S.mode !== 'playing' || S.tut || !S.skill) return;
  const id = S.skill;
  S.skill = null;
  S.charge = 0;
  renderSkill();
  const color = SKILLS[id].color;
  hero.cast();
  sfx.skill();
  ui.banner('', 'skill', 1, { html: `<span class="sk-seal">${SKILLS[id].ch}</span><span class="sk-name">${ui.t(`sk_${id}`)}</span>`, ms: 1400 });
  const at = world.handPosition(new THREE.Vector3());
  fx.magicCircle(new THREE.Vector3(0, 0.05, 0), { color, scale: 6, dur: 1.1, ground: true, spin: 2.5 });
  fx.emit(at, { count: 60, color, color2: 0xffffff, bright: 2, speed: 5, life: 0.8, size: 0.25 });
  emit('skill', { id });

  if (id === 'freeze') {
    S.freeze = FREEZE_S;
    document.body.classList.add('frozen');
  } else if (id === 'thunder') {
    world.shake(0.5);
    targets().forEach((e, i) => later(0.12 + i * 0.09, () => {
      const p = e.yokai.center(new THREE.Vector3());
      fx.bolt(new THREE.Vector3(p.x + rand(-1, 1), p.y + 10, p.z - 2), p, { width: 0.22 });
      sfx.thunder();
      banishFree(e);
    }));
  } else if (id === 'barrier') {
    S.barrier = true;
    barrierFx = fx.dome(new THREE.Vector3(0, 0, 0.1), { color, radius: 1.5 });
  } else if (id === 'lucky') {
    S.lucky = LUCKY_S;
    document.body.classList.add('lucky');
  }
}

// a yokai reached the hero (at p): does the barrier stop it? (it breaks doing so)
export function blockHit(p) {
  if (!S.barrier) return false;
  S.barrier = false;
  barrierFx?.flash();
  const drop = barrierFx;
  barrierFx = null;
  later(0.25, () => drop?.drop());
  fx.ring(p, { color: SKILLS.barrier.color, scale: 4 });
  fx.emit(p, { count: 50, color: SKILLS.barrier.color, color2: 0xffffff, bright: 2, speed: 5, life: 0.7, size: 0.3 });
  ui.padToast(ui.t('blocked'), 'ok');
  sfx.pillar();
  world.shake(0.25);
  return true;
}

/* ===================== yokai hints ===================== */
// The first few times a yokai with a trick appears, a small card says what to watch
// for: once per run per trick, and only in a player's first HINT_RUNS runs with it.
const HINT_RUNS = 3, HINT_MS = 4200;
const hinted = new Set();
let hintTimer = 0;
export function yokaiHint(type, trait) {
  if (hinted.has(trait)) return;
  const seen = ui.store.get('hints', {});
  if ((seen[trait] ?? 0) >= HINT_RUNS || !$('hint').hidden) return;
  hinted.add(trait);
  seen[trait] = (seen[trait] ?? 0) + 1;
  ui.store.set('hints', seen);
  const [seal, color] = YOKAI_LOOK[type];
  $('hint-seal').textContent = seal;
  $('hint-seal').parentElement.style.background = color;
  $('hint-title').textContent = ui.t('hintLook', { y: ui.t(`y_${type}`) });
  $('hint-text').textContent = ui.t(`tip_${trait}`);
  const el = $('hint');
  el.hidden = false;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { el.hidden = true; }, HINT_MS);
}

/* ===================== the oni's finisher ===================== */
// the trial oni's last answer: slow motion, a zoom punch, a circle under it, a
// pillar of light, lightning all round, and every other yokai on screen swept away
export function finisher(e, then) {
  const p = e.yokai.center(new THREE.Vector3());
  const ground = new THREE.Vector3(p.x, 0.06, p.z);
  S.slowmo = 1.5;
  world.punch(1.3);
  world.shake(0.9);
  hero.cast();
  sfx.finisher();
  const v = $('vignette');
  v.classList.remove('flash'); void v.offsetWidth; v.classList.add('flash');
  ui.banner('', 'finisher', 2, { html: `<span class="fin-kanji">${ui.t('finisher')}</span><span class="fin-sub">${ui.t('finisherSub')}</span>`, ms: 1700 });

  S.spawnTimer = Math.max(S.spawnTimer, 2.5);      // nothing new walks in during the finisher
  fx.magicCircle(ground, { color: 0xff4a2a, scale: 11, dur: 2.2, ground: true, spin: 3, bright: 1.8 });
  fx.magicCircle(ground.clone().setY(0.08), { color: 0xffb040, scale: 7, dur: 2, ground: true, spin: -4, bright: 1.6 });
  fx.pillar(p, { color: 0xff7a2a, radius: 1.3, height: 18, dur: 1.4 });
  later(0.35, () => fx.seal(p, '滅', 2));
  for (let i = 0; i < 3; i++) later(i * 0.12, () => fx.ring(ground, { color: i === 1 ? 0xff5a3a : 0xffb040, scale: 4 + i * 2, dur: 0.6 }));
  fx.emit(p, { count: 120, color: 0xffc85a, color2: 0xff4a2a, bright: 1.7, speed: 12, life: 1.4, size: 0.35, gravity: -3 });
  fx.emit(p, { count: 60, color: 0x8fe8ff, color2: 0xb47dff, bright: 1.6, speed: 3, life: 2, size: 0.28, gravity: 2.5, up: 0.6, dragK: 2 });
  for (let i = 0; i < 8; i++) {
    later(0.05 + i * 0.07, () => {
      const a = (i / 8) * Math.PI * 2;
      const hit = new THREE.Vector3(p.x + Math.cos(a) * 2.4, 0.2, p.z + Math.sin(a) * 2.4);
      fx.bolt(new THREE.Vector3(hit.x * 0.6, 14, hit.z - 3), hit, { width: 0.18, dur: 0.4, color: i % 2 ? 0xffb040 : 0x9fd0ff, sparks: 8 });
      if (i % 3 === 0) sfx.thunder();
    });
  }
  // the shockwave sweeps the rest of the path
  for (const o of targets()) if (o !== e) later(0.3 + Math.random() * 0.3, () => banishFree(o));
  later(1.1, then);
}

/* ===================== per frame ===================== */
let hudT = 0;
export function updatePowers(dt) {
  for (let i = queue.length - 1; i >= 0; i--) {
    if ((queue[i].t -= dt) <= 0) { const { fn } = queue[i]; queue.splice(i, 1); fn(); }
  }
  const box = $('skill-box');
  if (box.hidden !== !!S.tut) box.hidden = !!S.tut;
  if (S.tut) return;
  if (S.freeze > 0 && (S.freeze -= dt) <= 0) { S.freeze = 0; document.body.classList.remove('frozen'); }
  if (S.lucky > 0) {
    if ((S.lucky -= dt) <= 0) { S.lucky = 0; document.body.classList.remove('lucky'); }
    else if (Math.random() < dt * 12) fx.emit(new THREE.Vector3(rand(-0.5, 0.5), rand(0.2, 1.8), rand(-0.3, 0.4)), { count: 1, color: 0xffd36b, color2: 0xffffff, bright: 2, speed: 0.4, life: 0.8, size: 0.16, gravity: 1.5 });
  }
  stepNight(dt);
  // time charges the seal too, slowly (not while the path is quiet between nights)
  if (S.mode === 'playing' && S.night.state === 'on') charge(CHARGE_PER_SECOND * dt);
  // the HUD's draining bars don't need every frame
  if ((hudT -= dt) <= 0) { hudT = 0.12; renderEffects(); }
}

// a clean slate for a new run (or the title screen)
export function resetPowers() {
  queue.length = 0;
  hinted.clear();
  Object.assign(S, {
    charge: 0, skill: null, freeze: 0, lucky: 0, barrier: false, slowmo: 0,
    night: { id: 'night', state: 'on', t: 0 }, nextNightAt: NIGHT_EVERY,
  });
  barrierFx = null;
  document.body.classList.remove('frozen', 'lucky');
  delete document.body.dataset.night;
  world.setTheme('night', 1.2);
  shownPct = -1;
  renderSkill();
  renderEffects();
}

/* ===================== HUD ===================== */
// The skill seal, bottom left: a ring filling as it charges, with a line on how it
// charges; when full, the skill's seal, its name and what it does.
let shownPct = -1;
function renderSkill() {
  const pct = S.skill ? 100 : Math.floor(S.charge * 100);
  if (pct === shownPct) return;                  // the time trickle changes it a hair per frame
  shownPct = pct;
  const el = $('skill');
  el.style.setProperty('--k', S.skill ? '1' : S.charge.toFixed(3));
  $('skill-box').classList.toggle('ready', !!S.skill);
  el.disabled = !S.skill;
  $('skill-ch').textContent = S.skill ? SKILLS[S.skill].ch : '符';
  if (S.skill) {
    $('skill-title').innerHTML = `${ui.t(`sk_${S.skill}`)} <small>${ui.t(matchMedia('(pointer: coarse)').matches ? 'skTap' : 'skKey')}</small>`;
    $('skill-desc').textContent = ui.t(`skd_${S.skill}`);
    el.setAttribute('aria-label', ui.t('skillUse', { s: ui.t(`sk_${S.skill}`) }));
  } else {
    $('skill-title').textContent = ui.t('skCharging', { p: pct });
    $('skill-desc').textContent = ui.t('skChargingSub');
    el.setAttribute('aria-label', ui.t('skCharging', { p: pct }));
  }
}
export function refreshSkillText() { shownPct = -1; renderSkill(); }

// chips under the combo: the night (and how far to the next) and any skill still running
let shown = '';
function renderEffects() {
  const list = [];
  const n = S.night;
  if (n && n.id !== 'night' && n.state === 'on') list.push(['ev', n.id, ui.t(`ev_${n.id}`), (S.nextNightAt - S.distance) / NIGHT_EVERY]);
  if (S.freeze > 0) list.push(['sk', 'freeze', ui.t('sk_freeze'), S.freeze / FREEZE_S]);
  if (S.lucky > 0) list.push(['sk', 'lucky', ui.t('sk_lucky'), S.lucky / LUCKY_S]);
  if (S.barrier) list.push(['sk', 'barrier', ui.t('sk_barrier'), 1]);
  const key = list.map((c) => c[1]).join() + ui.getLang();
  const box = $('effects');
  if (key !== shown) {
    shown = key;
    box.innerHTML = list.map(([kind, id, name]) => `<span class="fx-chip ${kind} ${id}"><b>${kind === 'sk' ? SKILLS[id].ch : ''}</b>${name}<i></i></span>`).join('');
  }
  list.forEach((c, i) => box.children[i]?.style.setProperty('--left', Math.max(0, c[3]).toFixed(3)));
}
