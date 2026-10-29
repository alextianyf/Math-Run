// skills.js — banishing yokai charges the seal (bottom left), and slowly time does too;
// full, it offers one skill picked at random: time seal, thunder god, barrier or good
// fortune. Also the chips under the combo for the night and any skill still running.
import * as THREE from 'three';
import { sfx } from '../ui/audio.js';
import { banner } from '../ui/popups.js';
import { padToast } from '../ui/talisman.js';
import { S, targets } from '../core/state.js';
import { world, hero, fx } from './stage.js';
import { emit, on } from '../core/events.js';
import { later } from '../core/schedule.js';
import { nightRules, nightLeft } from './nights.js';
import { $ } from '../core/dom.js';
import { getLang, t } from '../core/i18n.js';
import { rand } from '../core/math.js';

// about ten banished yokai fill the seal; the answers stay the heart of the game
const CHARGE_PER_KILL = 0.12;
const CHARGE_PER_SECOND = 1 / 150;
// each skill has its own colour: the seal turns that colour when it is ready
export const SKILLS = {
  freeze: { ch: '停', color: 0x6fd0ff },        // time seal (ice blue): every yokai stands still
  thunder: { ch: '雷', color: 0xb08cff },       // thunder god (violet): lightning banishes all on screen
  barrier: { ch: '結', color: 0x6fe39a },       // barrier (green): the next yokai to reach you is stopped
  lucky: { ch: '福', color: 0xffc83a },         // good fortune (gold): double points for a while
};
const FREEZE_S = 5;
const LUCKY_S = 12;
let barrierFx = null;

export const frozen = () => S.freeze > 0;
export const paceMult = () => (frozen() ? 0 : nightRules().pace ?? 1);
export const scoreMult = () => (nightRules().score ?? 1) * (S.lucky > 0 ? 2 : 1);

export function charge(amount) {
  if (S.tut || S.skill) return;
  S.charge = Math.min(1, S.charge + amount * (nightRules().charge ?? 1));
  if (S.charge >= 1) {
    const pool = Object.keys(SKILLS).filter((id) => !(id === 'barrier' && S.barrier));
    S.skill = pool[Math.floor(Math.random() * pool.length)];
    sfx.skillReady();
  }
  renderSkill();
}
// n yokai banished by one answer (a boss or nekomata hit counts for less)
export const chargeKill = (n = 1) => charge(CHARGE_PER_KILL * n);

// the fox's blessing starts with a little charge
on('nightBegins', ({ id }) => { if (id === 'fox') charge(0.3); });

function thunder() {
  world.shake(0.5);
  targets().forEach((enemy, i) => later(0.12 + i * 0.09, () => {
    const p = enemy.yokai.center(new THREE.Vector3());
    fx.bolt(new THREE.Vector3(p.x + rand(-1, 1), p.y + 10, p.z - 2), p, { width: 0.22 });
    sfx.thunder();
    emit('sweep', { enemy });                      // combat.js banishes it
  }));
}

export function useSkill() {
  if (S.mode !== 'playing' || S.tut || !S.skill) return;
  const id = S.skill;
  S.skill = null;
  S.charge = 0;
  renderSkill();
  const color = SKILLS[id].color;
  hero.cast();
  sfx.skill();
  banner('', 'skill', 1, { html: `<span class="sk-seal">${SKILLS[id].ch}</span><span class="sk-name">${t(`sk_${id}`)}</span>`, ms: 1400 });
  const at = world.handPosition(new THREE.Vector3());
  fx.magicCircle(new THREE.Vector3(0, 0.05, 0), { color, scale: 6, dur: 1.1, ground: true, spin: 2.5 });
  fx.emit(at, { count: 60, color, color2: 0xffffff, bright: 2, speed: 5, life: 0.8, size: 0.25 });
  emit('skill', { id });

  if (id === 'freeze') {
    S.freeze = FREEZE_S;
    document.body.classList.add('frozen');
  } else if (id === 'thunder') {
    thunder();
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
  const dome = barrierFx;
  barrierFx = null;
  dome?.flash();
  later(0.25, () => dome?.drop());
  fx.ring(p, { color: SKILLS.barrier.color, scale: 4 });
  fx.emit(p, { count: 50, color: SKILLS.barrier.color, color2: 0xffffff, bright: 2, speed: 5, life: 0.7, size: 0.3 });
  padToast(t('blocked'), 'ok');
  sfx.pillar();
  world.shake(0.25);
  return true;
}

function luckySparkle() {
  const p = new THREE.Vector3(rand(-0.5, 0.5), rand(0.2, 1.8), rand(-0.3, 0.4));
  fx.emit(p, { count: 1, color: 0xffd36b, color2: 0xffffff, bright: 2, speed: 0.4, life: 0.8, size: 0.16, gravity: 1.5 });
}

// per frame, outside the tutorial: running skills wear off, time charges the seal
export function stepSkills(dt) {
  if (S.freeze > 0) {
    S.freeze -= dt;
    if (S.freeze <= 0) {
      S.freeze = 0;
      document.body.classList.remove('frozen');
    }
  }
  if (S.lucky > 0) {
    S.lucky -= dt;
    if (S.lucky <= 0) {
      S.lucky = 0;
      document.body.classList.remove('lucky');
    } else if (Math.random() < dt * 12) {
      luckySparkle();
    }
  }
  // not while the path is quiet between nights
  if (S.mode === 'playing' && S.night.state === 'on') charge(CHARGE_PER_SECOND * dt);
}

export function resetSkills() {
  S.charge = 0;
  S.skill = null;
  S.freeze = 0;
  S.lucky = 0;
  S.barrier = false;
  barrierFx = null;
  document.body.classList.remove('frozen', 'lucky');
  refreshSkillText();
}

/* ===================== HUD ===================== */
// The skill seal: a ring filling as it charges, with a line on how it charges; when
// full, the skill's seal, its name and what it does.
let shownPct = -1;
function renderSkill() {
  const pct = S.skill ? 100 : Math.floor(S.charge * 100);
  const key = S.skill ?? pct;
  if (key === shownPct) return;                  // the time trickle changes it a hair per frame
  shownPct = key;
  const el = $('skill');
  el.style.setProperty('--k', S.skill ? '1' : S.charge.toFixed(3));
  const box = $('skill-box');
  box.classList.toggle('ready', !!S.skill);
  if (S.skill) box.dataset.skill = S.skill;
  else delete box.dataset.skill;
  el.disabled = !S.skill;
  $('skill-ch').textContent = S.skill ? SKILLS[S.skill].ch : '符';
  if (S.skill) {
    const how = matchMedia('(pointer: coarse)').matches ? 'skTap' : 'skKey';
    $('skill-title').innerHTML = `${t(`sk_${S.skill}`)} <small>${t(how)}</small>`;
    $('skill-desc').textContent = t(`skd_${S.skill}`);
    el.setAttribute('aria-label', t('skillUse', { s: t(`sk_${S.skill}`) }));
  } else {
    $('skill-title').textContent = t('skCharging', { p: pct });
    $('skill-desc').textContent = t('skChargingSub');
    el.setAttribute('aria-label', t('skCharging', { p: pct }));
  }
}
export function refreshSkillText() {
  shownPct = -1;
  renderSkill();
}

// chips under the combo: the night (and how far to the next) and any skill still running
let shownChips = '';
function chipList() {
  const list = [];
  const n = S.night;
  if (n && n.id !== 'night' && n.state === 'on') list.push(['ev', n.id, t(`ev_${n.id}`), nightLeft()]);
  if (S.freeze > 0) list.push(['sk', 'freeze', t('sk_freeze'), S.freeze / FREEZE_S]);
  if (S.lucky > 0) list.push(['sk', 'lucky', t('sk_lucky'), S.lucky / LUCKY_S]);
  if (S.barrier) list.push(['sk', 'barrier', t('sk_barrier'), 1]);
  return list;
}

export function renderEffects() {
  const list = chipList();
  const key = list.map((c) => c[1]).join() + getLang();
  const box = $('effects');
  if (key !== shownChips) {
    shownChips = key;
    box.innerHTML = list.map(([kind, id, name]) => {
      const seal = kind === 'sk' ? SKILLS[id].ch : '';
      return `<span class="fx-chip ${kind} ${id}"><b>${seal}</b>${name}<i></i></span>`;
    }).join('');
  }
  list.forEach((c, i) => box.children[i]?.style.setProperty('--left', Math.max(0, c[3]).toFixed(3)));
}
