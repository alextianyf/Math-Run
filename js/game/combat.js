// combat.js — what a reading of the talisman does: a spell (a talisman, foxfire,
// lightning or a pillar of light, picked at random) strikes every yokai whose answer
// matches (the more at once, the more points), a wrong digit fizzles, and a yokai
// that reaches the hero costs a heart.
import * as THREE from 'three';
import { sfx } from '../ui/audio.js';
import * as ui from '../ui/ui.js';
import { S, SPAWN_Z, HIT_Z, MAX_HEARTS, targets } from './state.js';
import { world, hero, fx, director } from './stage.js';
import { addScore, record, advance, promote, showRank } from './progress.js';
import { measureTag, removeEnemy } from './enemies.js';
import { pad } from './handwriting.js';
import { beginCapture } from './capture.js';
import { emit } from './events.js';
import { rand } from './helpers.js';
import { chargeKill, scoreMult, blockHit, finisher, later } from './powers.js';

// combo aura tiers: [min combo, colour] — the talismans and sparks take this colour
const AURA = [[20, 0xc77dff], [10, 0x6fd8ff], [5, 0xffc84a]];
const auraColor = () => (AURA.find(([min]) => S.combo >= min) || [0, 0xffc84a])[1];
const comboMult = () => 1 + Math.min(2, Math.max(0, S.combo - 1) * 0.1);
const tmp = new THREE.Vector3();

// the talisman was read (outside the tutorial): show what the AI saw, then act on it
export function answer({ dec, result, paper, pct }) {
  S.ai.reads++;
  if (dec.kind === 'hit') {
    if (dec.corrected != null) S.ai.fixed++;
    ui.showAI(result.img28, result.probs, dec.corrected != null
      ? { text: ui.t('aiFix', { a: dec.corrected, b: dec.d }), cls: 'fix' }
      : { text: ui.t('aiRead', { d: dec.d, p: pct }), cls: 'ok' });
    cast(dec.d, paper);
  } else if (dec.kind === 'unclear') {
    S.ai.unclear++;
    ui.showAI(result.img28, result.probs, { text: ui.t('aiUnsure', { d: dec.d, p: pct }), cls: 'warn' });
    ui.padToast(ui.t('unclear'), 'warn');
    ui.talismanState('shake');
    sfx.unclear();
  } else {
    ui.showAI(result.img28, result.probs, { text: ui.t('aiRead', { d: dec.d, p: pct }), cls: dec.kind === 'miss' ? 'bad' : '' });
    fizzle(dec.d, paper, dec.kind === 'miss');
  }
}

// the written talisman (a canvas) as a texture for the flying paper
function paperTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// the hero's casting gesture: a magic circle at the hand; returns the hand position
function castCircle(color) {
  const from = world.handPosition(new THREE.Vector3());
  hero.cast();
  fx.magicCircle(from.clone().add(new THREE.Vector3(0, 0.05, -0.25)), { color, scale: 1.3, dur: 0.55 });
  fx.emit(from, { count: 14, color, color2: 0xffffff, speed: 2.2, life: 0.4, size: 0.14, gravity: 0, up: 0.2 });
  return from;
}

// one talisman per yokai whose answer is `digit`
export function cast(digit, paper) {
  const victims = targets().filter((e) => e.answer === digit);
  if (!victims.length) return fizzle(digit, paper, true);

  S.combo++;
  S.maxCombo = Math.max(S.maxCombo, S.combo);
  ui.setCombo(S.combo);
  const color = auraColor();
  const tex = paperTexture(paper);
  const from = castCircle(color);
  ui.talismanState('cast');
  sfx.cast();

  const n = victims.length;
  emit('cast', { victims: n });
  if (n >= 2) {
    ui.banner(ui.t(n === 2 ? 'multi2' : n === 3 ? 'multi3' : 'multi4'), 'multi');
    sfx.multi(n);
  }
  const style = S.tut ? 'talisman' : STYLES[Math.floor(Math.random() * STYLES.length)];
  victims.forEach((e, i) => {
    e.locked = true;
    ui.setTagState(e.tag, 'locked');
    SPELLS[style](e, i, n, { tex, from, color });
  });
  if (style !== 'talisman' && tex) tex.dispose();      // only the paper talisman carries the writing
}

// the shapes a cast can take; each strikes yokai e (i of n) and then calls impact()
const STYLES = ['talisman', 'talisman', 'foxfire', 'thunder', 'pillar'];
const SPELLS = {
  // the written talisman itself flies
  talisman(e, i, n, { tex, from, color }) {
    fx.talisman(tex, from, (out) => e.yokai.center(out), {
      dur: 0.3 + i * 0.06, side: (i - (n - 1) / 2) * 1.6, color, onHit: () => impact(e, n),
    });
  },
  // three foxfire orbs curl in from either side
  foxfire(e, i, n, { from }) {
    for (let k = 0; k < 3; k++) {
      fx.talisman(null, from, (out) => e.yokai.center(out), {
        dur: 0.36 + i * 0.06 + k * 0.05, side: (k - 1) * 3.2, lift: 2.2 - k * 0.6, color: k === 1 ? 0xb47dff : 0x6fd8ff,
        onHit: k === 2 ? () => impact(e, n) : (p) => fx.emit(p, { count: 12, color: 0x8fe8ff, color2: 0xb47dff, bright: 2, speed: 3, life: 0.4, size: 0.2 }),
      });
    }
  },
  // lightning out of the sky, a beat after the cast
  thunder(e, i, n) {
    const p = e.yokai.center(new THREE.Vector3());
    fx.magicCircle(tmp.set(p.x, p.y + 3.2, p.z), { color: 0xbfe6ff, scale: 2.2, dur: 0.4, ground: true, spin: 6 });
    later(0.16 + i * 0.07, () => {
      if (!S.enemies.includes(e)) return;
      const q = e.yokai.center(new THREE.Vector3());
      fx.bolt(new THREE.Vector3(q.x + rand(-0.6, 0.6), q.y + 9, q.z - 1.5), q);
      sfx.thunder();
      impact(e, n);
    });
  },
  // a circle opens under it and a pillar of light goes up
  pillar(e, i, n) {
    const p = e.yokai.center(new THREE.Vector3());
    later(0.1 + i * 0.07, () => {
      if (!S.enemies.includes(e)) return;
      fx.pillar(e.yokai.center(p), { color: 0xffd36b, radius: 0.8, height: 7, dur: 0.6 });
      sfx.pillar();
      later(0.12, () => impact(e, n));
    });
  },
};

// the talisman flies off and burns out. penalize: a clearly written wrong digit —
// it counts as a wrong answer to the most urgent problem and locks the pad briefly
export function fizzle(digit, paper, penalize) {
  const tex = paperTexture(paper);
  const from = castCircle(0xff7a3a);
  ui.talismanState('fizzle');
  fx.talisman(tex, from, (out) => out.set(0, 2.4, -9), {
    dur: 0.42, color: 0xff7a3a,
    onHit: (p) => {
      fx.emit(p, { count: 30, color: 0xff8a2a, color2: 0x55505a, bright: 1.2, speed: 2.2, life: 1, size: 0.3, gravity: 1.5, up: 0.2 });
    },
  });
  if (penalize) {
    const nearest = targets().reduce((a, b) => (!a || b.z > a.z ? b : a), null);
    if (nearest) record(nearest, false);
    sfx.miss();
    ui.padToast(ui.t('miss', { d: digit }), 'bad');
    S.combo = 0;
    ui.setCombo(0);
    S.cooldown = 0.7;
    pad.setEnabled(false);
  } else {
    ui.padToast(ui.t('idle'));
  }
}

// a talisman lands: points, effects, and the yokai is banished (a boss takes
// several hits, getting a new equation each time; its last one is a promotion)
function impact(e, n) {
  if (!S.enemies.includes(e) || e.dying) return;
  const p = e.yokai.center(new THREE.Vector3());
  const color = e.yokai.info.color;
  fx.emit(p, { count: e.boss ? 70 : 40, color: 0xffe28a, color2: color, bright: 2, speed: e.boss ? 8 : 6, life: 0.8, size: 0.3 });
  fx.emit(p, { count: 14, color: 0xf6d670, color2: 0xd09a30, bright: 1, speed: 3, life: 1.3, size: 0.2, gravity: -5 });
  fx.emit(p, { count: 16, color: 0x8fe8ff, color2: 0xb47dff, bright: 1.8, speed: 1.2, life: 1.4, size: 0.22, gravity: 2.2, up: 0.4, dragK: 2.5 });
  fx.ring(p, { color: 0xffd36b, scale: e.boss ? 6.5 : 3.4 });
  sfx.hit(S.combo);

  if (e.hpDone + 1 < e.hpTotal) {
    // a boss (or the two-lived nekomata) takes a hit: staggers, gets a new
    // equation and is knocked back
    e.hpDone++;
    e.yokai.flash();
    world.shake(e.boss ? 0.25 : 0.1);
    record(e, true);
    const prob = director.nextProblem({ avoid: new Set(targets().map((o) => o.text)), boss: e.boss });
    Object.assign(e, { problem: prob, qStart: e.age, qTravel: director.travelTime(prob), answer: prob.answer, text: prob.text });
    ui.setTagText(e.tag, prob.text);
    ui.setTagHp(e.tag, e.hpDone, e.hpTotal);
    measureTag(e);
    e.tag.classList.remove('locked');
    e.z = Math.max(Math.min(e.z, SPAWN_Z * 0.8), e.z - (e.boss ? 7 : 4));   // knock back, never pull forward
    e.locked = false;
    chargeKill(0.5);
    const pts = Math.round((e.boss ? 200 : 100) * comboMult() * scoreMult());
    addScore(pts);
    ui.popup(`+${pts}`, e.sx, e.sy, 'gold');
    return;
  }

  // banished: more points the farther away it was (the rokurokubi: the nearer), and
  // for several at once
  if (!e.boss) fx.seal(p);
  const far = (e.z - HIT_Z) / (SPAWN_Z - HIT_Z);            // 1 = just spawned, 0 = at the hero
  const timing = e.trait === 'late' ? 150 * (1 - far) : 60 * far;
  const multiBonus = n >= 2 ? 0.5 * (n - 1) : 0;
  const pts = Math.round(((e.boss ? 1000 : 100) + timing) * (1 + multiBonus) * comboMult() * scoreMult());
  addScore(pts);
  ui.popup(`+${pts}`, e.sx, e.sy, n >= 2 || e.boss ? 'gold big' : 'gold');
  record(e, true);
  chargeKill(1);
  emit('banish', { type: e.yokai.type, combo: S.combo });
  e.yokai.flash();
  e.dying = 0.0001;
  ui.setTagState(e.tag, 'hit');
  if (e.boss) {
    // the trial is passed: the finisher first, then the promotion
    ui.setTagHp(e.tag, e.hpTotal, e.hpTotal);
    finisher(e, () => { promote(); showRank(); });
  }
  ui.removeTag(e.tag, 600);
  e.tag = null;
  advance(e.boss ? 3 : 1);
}

// banished by a skill or the finisher's shockwave rather than an answer: points,
// but the problem never counts toward the rating. A boss is only knocked back.
export function banishFree(e) {
  if (!S.enemies.includes(e) || e.dying || e.swarm) return;
  const p = e.yokai.center(new THREE.Vector3());
  fx.emit(p, { count: 40, color: 0xffe28a, color2: e.yokai.info.color, bright: 2, speed: 6, life: 0.8, size: 0.3 });
  fx.ring(p, { color: 0xbfe6ff, scale: 3.4 });
  e.yokai.flash();
  if (e.boss) {
    e.z = Math.max(Math.min(e.z, SPAWN_Z * 0.8), e.z - 10);
    world.shake(0.3);
    return;
  }
  fx.seal(p);
  const pts = Math.round(100 * comboMult() * scoreMult());
  addScore(pts);
  ui.popup(`+${pts}`, e.sx, e.sy, 'gold');
  emit('banish', { type: e.yokai.type, combo: S.combo, free: true });
  e.dying = 0.0001;
  e.locked = true;
  if (e.tag) { ui.setTagState(e.tag, 'hit'); ui.removeTag(e.tag, 600); e.tag = null; }
  advance(1);
}

// a yokai got through to the hero: one heart (a failed rank trial too, never more)
export function playerHit(e) {
  const p = e.yokai.center(new THREE.Vector3());
  fx.emit(p, { count: 46, color: 0x9a5cff, color2: 0x2a1840, bright: 1.4, speed: 4, life: 0.9, size: 0.45, gravity: 0.5 });
  fx.ring(p, { color: 0x9a5cff, scale: 3 });
  record(e, false);
  if (!S.tut) director.hit();
  removeEnemy(e);
  if (e.boss) showRank();                   // the trial failed: back to the bar
  if (S.invuln > 0 || blockHit(p)) return;

  S.hearts = Math.max(0, S.hearts - 1);
  S.invuln = 0.8;
  S.combo = 0;
  ui.setCombo(0);
  ui.setHearts(S.hearts, MAX_HEARTS);
  ui.damageFlash();
  world.shake(0.5);
  hero.hurt();
  sfx.hurt();
  if (S.hearts <= 0) beginCapture();
}

// per frame while playing: the short safety after a hit, the pad lock after a
// miss, and the combo aura (sparks rising around the hero, coloured by tier)
export function updateCombat(dt) {
  if (S.invuln > 0) S.invuln -= dt;
  if (S.cooldown > 0) {
    S.cooldown -= dt;
    if (S.cooldown <= 0) pad.setEnabled(true);
  }
  if (S.combo >= 5) {
    const tier = S.combo >= 20 ? 3 : S.combo >= 10 ? 2 : 1;
    fx.emit(tmp.set(rand(-0.35, 0.35), rand(0.3, 1.6), rand(-0.2, 0.35)), {
      count: tier, color: auraColor(), color2: 0xffffff, bright: 1.8, speed: 0.5, life: 0.6, size: 0.12, gravity: 2, up: 0.4, dragK: 3,
    });
  }
}
