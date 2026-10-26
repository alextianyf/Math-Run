// powers.js — what makes a run more than answering: the talisman charges a random
// skill (time seal, thunder god, barrier, good fortune), night events come and go
// along the path (full moon, mist, a parade rush, the fox's blessing), and the
// trial oni goes down with a finisher. None of it runs during the tutorial.
import * as THREE from 'three';
import { sfx } from '../ui/audio.js';
import * as ui from '../ui/ui.js';
import { S, targets } from './state.js';
import { world, hero, fx } from './stage.js';
import { banishFree } from './combat.js';
import { emit } from './events.js';
import { $, rand } from './helpers.js';

/* ===================== timing helpers ===================== */
// things to do a moment later, on the game's own clock (so a pause holds them too)
const queue = [];
export function later(delay, fn) { queue.push({ t: delay, fn }); }

/* ===================== night events ===================== */
// every EVENT_EVERY metres the night changes for EVENT_DUR seconds
const FIRST_EVENT = 300, EVENT_EVERY = 420, EVENT_DUR = 24;
export const EVENTS = {
  moon: { score: 2, pace: 1.25 },              // full moon: double points, faster yokai
  fog: { fog: true },                          // mist: equations only show up close
  parade: { spawn: 0.45, alive: 2 },           // a parade rush: many more yokai at once
  fox: { charge: 2 },                          // the fox's blessing: skills charge twice as fast
};
const EVENT_IDS = Object.keys(EVENTS);
const ev = () => (S.event ? EVENTS[S.event.id] : {});

function startEvent() {
  const pool = EVENT_IDS.filter((id) => id !== S.lastEvent);
  const id = pool[Math.floor(Math.random() * pool.length)];
  S.event = { id, t: 0, dur: EVENT_DUR };
  S.lastEvent = id;
  document.body.dataset.event = id;
  ui.banner('', 'event', 1, { html: `<span class="ev-title">${ui.t(`ev_${id}`)}</span><span class="ev-sub">${ui.t(`evd_${id}`)}</span>`, ms: 2400 });
  sfx.event();
  emit('event', { id });
  if (id === 'fox') charge(0.4);
}
function endEvent() {
  S.event = null;
  delete document.body.dataset.event;
  S.nextEventAt = S.distance + EVENT_EVERY;
}

// what the night (and the good-fortune skill) does to the numbers
export const scoreMult = () => (ev().score ?? 1) * (S.lucky > 0 ? 2 : 1);
export const paceMult = () => (S.freeze > 0 ? 0 : ev().pace ?? 1);
export const spawnMult = () => ev().spawn ?? 1;
export const aliveBonus = () => ev().alive ?? 0;
export const frozen = () => S.freeze > 0;
// in the mist an equation fades in only as its yokai comes near (0 far → 1 at the hero)
export const tagVisibility = (near) => (ev().fog ? THREE.MathUtils.smoothstep(near, 0.32, 0.55) : 1);

/* ===================== skills ===================== */
// right answers charge the talisman; full, it offers one skill, picked at random
const CHARGE_PER_CAST = 0.2;
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
  S.charge = Math.min(1, S.charge + amount * (ev().charge ?? 1));
  if (S.charge >= 1) {
    const pool = Object.keys(SKILLS).filter((id) => !(id === 'barrier' && S.barrier));
    S.skill = pool[Math.floor(Math.random() * pool.length)];
    sfx.skillReady();
    ui.padToast(ui.t('skillReady', { s: ui.t(`sk_${S.skill}`) }), 'skill');
  }
  renderSkill();
}
// a right answer: n yokai hit at once charge a little more
export const chargeCast = (n) => charge(CHARGE_PER_CAST * (1 + 0.25 * (n - 1)));

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
  renderEffects();
  return true;
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
export function updatePowers(dt) {
  for (let i = queue.length - 1; i >= 0; i--) {
    if ((queue[i].t -= dt) <= 0) { const { fn } = queue[i]; queue.splice(i, 1); fn(); }
  }
  $('skill').hidden = !!S.tut;
  if (S.tut) return;
  if (S.freeze > 0 && (S.freeze -= dt) <= 0) { S.freeze = 0; document.body.classList.remove('frozen'); }
  if (S.lucky > 0) {
    if ((S.lucky -= dt) <= 0) { S.lucky = 0; document.body.classList.remove('lucky'); }
    else if (Math.random() < dt * 12) fx.emit(new THREE.Vector3(rand(-0.5, 0.5), rand(0.2, 1.8), rand(-0.3, 0.4)), { count: 1, color: 0xffd36b, color2: 0xffffff, bright: 2, speed: 0.4, life: 0.8, size: 0.16, gravity: 1.5 });
  }
  if (S.event) {
    S.event.t += dt;
    if (S.event.t >= S.event.dur) endEvent();
  } else if (S.distance >= S.nextEventAt && !S.pendingBoss && !S.enemies.some((o) => o.boss && !o.dying)) {
    startEvent();
  }
  // the mist rolls in and out
  const fog = world.scene.fog;
  const want = ev().fog ? [6, 40] : [24, 95];
  fog.near += (want[0] - fog.near) * Math.min(1, dt * 1.5);
  fog.far += (want[1] - fog.far) * Math.min(1, dt * 1.5);
  renderEffects();
}

// a clean slate for a new run (or the title screen)
export function resetPowers() {
  queue.length = 0;
  Object.assign(S, { charge: 0, skill: null, freeze: 0, lucky: 0, barrier: false, slowmo: 0, event: null, lastEvent: null, nextEventAt: FIRST_EVENT });
  barrierFx = null;
  document.body.classList.remove('frozen', 'lucky');
  delete document.body.dataset.event;
  world.scene.fog.near = 24;
  world.scene.fog.far = 95;
  renderSkill();
  renderEffects();
}

/* ===================== HUD ===================== */
// the skill seal by the talisman: a ring filling as it charges, the skill's kanji when ready
function renderSkill() {
  const el = $('skill');
  el.style.setProperty('--k', S.charge.toFixed(3));
  el.classList.toggle('ready', !!S.skill);
  $('skill-ch').textContent = S.skill ? SKILLS[S.skill].ch : '符';
  $('skill-name').textContent = S.skill ? ui.t(`sk_${S.skill}`) : '';
  el.setAttribute('aria-label', S.skill ? ui.t('skillUse', { s: ui.t(`sk_${S.skill}`) }) : ui.t('skillCharging'));
  el.disabled = !S.skill;
}

// chips under the combo: the night event and any skill still running, each draining
let shown = '';
function renderEffects() {
  const list = [];
  if (S.event) list.push(['ev', S.event.id, ui.t(`ev_${S.event.id}`), 1 - S.event.t / S.event.dur]);
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
