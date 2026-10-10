// main.js — game rules & loop for Math Run: Night Parade (百鬼夜行).
//
// Yokai drift down the shrine path, each carrying an equation. The player
// handwrites a digit on the talisman; the MNIST model reads it and a talisman
// flies at EVERY yokai whose answer matches — so spotting shared answers pays.
// Losing the last heart plays a capture cinematic: the parade circles the hero
// and the great oni rises from a portal to grab him.
import * as THREE from 'three';
import { createWorld, LANES } from './world.js';
import { createYokai } from './yokai.js';
import { createOni } from './oni.js';
import { createFx } from './fx.js';
import { makeProblem } from './problems.js';
import { createPad, MODEL_SIZE } from './pad.js';
import { initRecognizer, classify, aiInfo } from './recognizer.js';
import { initAudio, setMuted, sfx, startMusic, stopMusic, setTempo } from './audio.js';
import * as ui from './ui.js';

const $ = (id) => document.getElementById(id);
const DEBUG = new URLSearchParams(location.search).has('debug');

/* ===================== tuning ===================== */
const SPAWN_Z = -58;          // where yokai appear
const HIT_Z = -0.6;           // where they reach the hero
const MAX_HEARTS = 3;
const KILLS_PER_WAVE = 6;
const TYPE_PACE = { onibi: 1, chochin: 1.08, kasa: 0.94, oni: 2.3 };   // × travel time
const AURA = [                // combo aura tiers: [min combo, colour]
  [20, 0xc77dff],
  [10, 0x6fd8ff],
  [5, 0xffc84a],
];
const CAPTOR_SCALE = 1.45;

function waveParams(wave) {
  return {
    travel: Math.max(5.2, 12.5 - (wave - 1) * 0.65),   // seconds from spawn to the hero
    interval: Math.max(1.4, 5 - (wave - 1) * 0.36),     // seconds between spawns
    maxAlive: Math.min(5, 1 + Math.floor(wave / 2)),
    tier: wave <= 2 ? 1 : wave <= 4 ? 2 : wave <= 7 ? 3 : 4,
    runSpeed: 7 + wave * 0.5,
  };
}

/* ===================== state ===================== */
const S = {
  mode: 'loading',            // loading | title | intro | playing | paused | caught | over
  t: 0, introT: 0, caughtT: 0, timeScale: 1,
  speed: 3,
  hearts: MAX_HEARTS, score: 0, distance: 0, banished: 0,
  combo: 0, maxCombo: 0, wave: 1,
  spawnTimer: 0, pendingBoss: false,
  cooldown: 0, invuln: 0,
  enemies: [],
  ai: { reads: 0, fixed: 0, unclear: 0 },
  best: ui.store.get('best', 0),
  tutorial: !ui.store.get('tutorialDone', false),
};
const captor = { oni: null, step: 0 };

/* ===================== setup ===================== */
const stage = $('stage');
const world = createWorld($('scene'));
const hero = world.hero;
const fx = createFx(world.scene, world.camera);

function onResize() {
  world.resize(stage.clientWidth, stage.clientHeight);
  fx.setScale(world.pxScale);
}
new ResizeObserver(onResize).observe(stage);
onResize();

const pad = createPad($('pad'), { onInput: liveGuess, onFinish: finishWriting });
new ResizeObserver(() => pad.resize()).observe($('pad'));

ui.applyI18n();
ui.setHearts(MAX_HEARTS, MAX_HEARTS);
ui.setBest(S.best);
ui.setWave(1);
ui.resetAI();

let muted = ui.store.get('muted', false);
setMuted(muted);
document.body.classList.toggle('muted', muted);
document.body.classList.toggle('ai-open', ui.store.get('aiPanel', window.innerWidth >= 900));

initRecognizer()
  .then(() => {
    const btn = $('btn-start');
    btn.disabled = false;
    btn.dataset.i18n = 'start';
    btn.textContent = ui.t('start');
    $('ai-status').dataset.i18n = '';
    $('ai-status').textContent = ui.t('ready', { b: aiInfo.backend });
    ui.setAIMeta(aiInfo.backend);
    if (S.mode === 'loading') S.mode = 'title';
  })
  .catch((err) => {
    console.error('[math-run] model load failed', err);
    $('btn-start').dataset.i18n = 'loadFail';
    $('btn-start').textContent = ui.t('loadFail');
  });

/* ===================== helpers ===================== */
const tmpV = new THREE.Vector3();
const scr = { x: 0, y: 0, visible: true };
const rand = (a, b) => a + Math.random() * (b - a);
const easeOut = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
const easeOutBack = (k) => { k = Math.min(1, k); const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

const targets = () => S.enemies.filter((e) => !e.dying && !e.locked && !e.swarm);
const comboMult = () => 1 + Math.min(2, Math.max(0, S.combo - 1) * 0.1);
const auraColor = () => (AURA.find(([min]) => S.combo >= min) || [0, 0xffc84a])[1];

function addScore(n) {
  S.score += n;
  ui.setScore(S.score);
}

/* ===================== spawning ===================== */
function pickType() {
  const r = Math.random();
  if (S.wave >= 3 && r < 0.25) return 'kasa';
  return r < 0.62 ? 'onibi' : 'chochin';
}

function chooseLane() {
  // prefer lanes with nothing near the spawn point, so equation tags don't overlap
  const free = [0, 1, 2].filter((l) => !S.enemies.some((e) => e.lane === l && !e.dying && e.z < SPAWN_Z + 16));
  const pool = free.length ? free : [0, 1, 2];
  return pool[Math.floor(Math.random() * pool.length)];
}

function spawn(boss = false) {
  const P = waveParams(S.wave);
  const type = boss ? 'oni' : pickType();
  const lane = boss ? 1 : chooseLane();
  const live = targets();
  // ~30%: reuse an answer already on screen (different expression) → multi-banish chance
  const reuse = live.length && Math.random() < 0.3 ? live[Math.floor(Math.random() * live.length)].answer : undefined;
  const tier = boss ? Math.min(4, P.tier + 1) : P.tier;
  const prob = makeProblem(tier, reuse, new Set(live.map((e) => e.text)));

  // drift in from the forest on either side, settling into the lane as it approaches
  // (keeps far-away tags apart, where perspective squeezes the lanes together)
  const side = lane === 1 ? (Math.random() < 0.5 ? -1 : 1) : lane - 1;
  const x0 = boss ? 0 : LANES[lane] + side * rand(3, 4.5);
  const yokai = createYokai(type);
  yokai.root.position.set(x0, 0, SPAWN_Z);
  yokai.root.scale.setScalar(0.01);
  world.scene.add(yokai.root);

  const hpTotal = boss ? 2 + Math.floor(S.wave / 4) : 1;
  const e = {
    yokai, lane, boss, tier, x0,
    z: SPAWN_Z,
    speed: (HIT_Z - SPAWN_Z) / (P.travel * TYPE_PACE[type]),
    answer: prob.answer, text: prob.text,
    tag: ui.createTag(prob.text, { boss, hp: hpTotal }),
    hpDone: 0, hpTotal,
    locked: false, dying: 0, age: 0, sx: 0, sy: 0, offY: 0,
  };
  measureTag(e);
  S.enemies.push(e);
  fx.emit(yokai.center(tmpV), { count: boss ? 50 : 22, color: 0x7a3dff, color2: 0x1a0c33, bright: 1, speed: boss ? 4 : 2.5, life: 1, size: boss ? 0.9 : 0.5, gravity: 0.6, up: 0.3 });

  if (boss) {
    ui.banner(ui.t('boss'), 'boss');
    sfx.boss();
    world.shake(0.25);
  }
  if (S.tutorial) ui.showPadHint(true);
}

function measureTag(e) {
  e.tw = e.tag.offsetWidth;
  e.th = e.tag.offsetHeight + 10;   // + rope above the plaque
}

function removeEnemy(e) {
  const i = S.enemies.indexOf(e);
  if (i >= 0) S.enemies.splice(i, 1);     // first, so a failure below can't wedge the loop
  world.scene.remove(e.yokai.root);
  if (e.tag) ui.removeTag(e.tag);
  e.yokai.dispose();
}

/* ===================== handwriting → decision ===================== */
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
function decide(probs) {
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

async function finishWriting() {
  if (!pad.hasInk() || pad.writing) return;
  const rgba = S.mode === 'playing' && aiInfo.ready ? pad.renderForModel() : null;
  if (!rgba) { pad.clear(); ui.setGuess(null); return; }

  pad.setEnabled(false);
  const paper = pad.snapshot();
  let result;
  try {
    result = await classify(rgba, MODEL_SIZE);
  } catch (err) {
    console.error('[math-run] classify failed', err);
  }
  pad.clear();
  ui.setGuess(null);
  if (S.mode === 'playing' && S.cooldown <= 0) pad.setEnabled(true);
  if (!result || S.mode !== 'playing') return;

  const dec = decide(result.probs);
  const pct = Math.round(dec.p * 100);
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
  ui.setAIMeta(`${aiInfo.backend} · ${aiInfo.latency.toFixed(1)} ms`);
}

/* ===================== casting ===================== */
function paperTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function castCircle(color) {
  const from = world.handPosition(new THREE.Vector3());
  hero.cast();
  fx.magicCircle(from.clone().add(new THREE.Vector3(0, 0.05, -0.25)), { color, scale: 1.3, dur: 0.55 });
  fx.emit(from, { count: 14, color, color2: 0xffffff, speed: 2.2, life: 0.4, size: 0.14, gravity: 0, up: 0.2 });
  return from;
}

function cast(digit, paper) {
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
  if (S.tutorial) {
    S.tutorial = false;
    ui.store.set('tutorialDone', true);
    ui.showPadHint(false);
  }

  const n = victims.length;
  if (n >= 2) {
    ui.banner(ui.t(n === 2 ? 'multi2' : n === 3 ? 'multi3' : 'multi4'), 'multi');
    sfx.multi(n);
  }
  victims.forEach((e, i) => {
    e.locked = true;
    ui.setTagState(e.tag, 'locked');
    fx.talisman(tex, from, (out) => e.yokai.center(out), {
      dur: 0.3 + i * 0.06,
      side: (i - (n - 1) / 2) * 1.6,
      color,
      onHit: () => impact(e, n),
    });
  });
}

function fizzle(digit, paper, penalize) {
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

function impact(e, n) {
  if (!S.enemies.includes(e) || e.dying) return;
  const p = e.yokai.center(new THREE.Vector3());
  const color = e.yokai.info.color;
  fx.emit(p, { count: e.boss ? 70 : 40, color: 0xffe28a, color2: color, bright: 2, speed: e.boss ? 8 : 6, life: 0.8, size: 0.3 });
  fx.emit(p, { count: 14, color: 0xf6d670, color2: 0xd09a30, bright: 1, speed: 3, life: 1.3, size: 0.2, gravity: -5 });
  fx.emit(p, { count: 16, color: 0x8fe8ff, color2: 0xb47dff, bright: 1.8, speed: 1.2, life: 1.4, size: 0.22, gravity: 2.2, up: 0.4, dragK: 2.5 });
  fx.ring(p, { color: 0xffd36b, scale: e.boss ? 6.5 : 3.4 });
  sfx.hit(S.combo);

  const far = (e.z - HIT_Z) / (SPAWN_Z - HIT_Z);            // 1 = just spawned, 0 = at the hero
  const multiBonus = n >= 2 ? 0.5 * (n - 1) : 0;

  if (e.boss && e.hpDone + 1 < e.hpTotal) {
    // boss takes a hit: staggers, gets a new equation and is knocked back
    e.hpDone++;
    e.yokai.flash();
    world.shake(0.25);
    const prob = makeProblem(e.tier, undefined, new Set(targets().map((o) => o.text)));
    e.answer = prob.answer; e.text = prob.text;
    ui.setTagText(e.tag, prob.text);
    ui.setTagHp(e.tag, e.hpDone, e.hpTotal);
    measureTag(e);
    e.tag.classList.remove('locked');
    e.z = Math.max(Math.min(e.z, SPAWN_Z * 0.8), e.z - 7);   // knock back, never pull forward
    e.locked = false;
    const pts = Math.round(200 * comboMult());
    addScore(pts);
    ui.popup(`+${pts}`, e.sx, e.sy, 'gold');
    return;
  }

  fx.seal(p);
  const base = e.boss ? 1000 : 100;
  const pts = Math.round((base + 60 * far) * (1 + multiBonus) * comboMult());
  addScore(pts);
  ui.popup(`+${pts}`, e.sx, e.sy, n >= 2 ? 'gold big' : 'gold');
  if (e.boss) {
    ui.setTagHp(e.tag, e.hpTotal, e.hpTotal);
    world.shake(0.4);
    if (S.hearts < MAX_HEARTS) {
      S.hearts++;
      ui.setHearts(S.hearts, MAX_HEARTS);
      ui.banner(ui.t('heal'), 'heal');
      sfx.heal();
    }
  }
  e.yokai.flash();
  e.dying = 0.0001;
  ui.setTagState(e.tag, 'hit');
  ui.removeTag(e.tag, 600);
  e.tag = null;
  advance(e.boss ? 3 : 1);
}

function advance(kills) {
  S.banished += kills;
  const wave = 1 + Math.floor(S.banished / KILLS_PER_WAVE);
  if (wave > S.wave) {
    S.wave = wave;
    ui.setWave(wave);
    ui.banner(ui.t('wave', { n: wave }), 'wave');
    sfx.wave();
    setTempo(wave);
    if (wave % 4 === 0) S.pendingBoss = true;
  }
}

/* ===================== damage ===================== */
function playerHit(e) {
  const p = e.yokai.center(new THREE.Vector3());
  fx.emit(p, { count: 46, color: 0x9a5cff, color2: 0x2a1840, bright: 1.4, speed: 4, life: 0.9, size: 0.45, gravity: 0.5 });
  fx.ring(p, { color: 0x9a5cff, scale: 3 });
  removeEnemy(e);
  if (S.invuln > 0) return;

  S.hearts = Math.max(0, S.hearts - (e.boss ? 2 : 1));
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

/* ===================== capture cinematic ===================== */
// timeline (seconds of real time since the last heart was lost)
const CAPTURE = { kneel: 0.3, camera: 0.45, portal: 1.0, risen: 2.3, reach: 3.2, grab: 3.9, attach: 4.05, lift: 4.35, laugh: 5.1, over: 5.6 };
const portalPos = new THREE.Vector3(0, 0.06, -3);

function beginCapture() {
  S.mode = 'caught';
  S.caughtT = 0;
  captor.step = 0;
  stopMusic();
  pad.clear();
  pad.setEnabled(false);
  ui.showPadHint(false);
  ui.clearTags();
  document.body.classList.add('cinematic');

  // the parade gathers: survivors circle the hero, bosses vanish into smoke,
  // and a few more yokai materialise so the circle is always full
  for (const e of [...S.enemies]) {
    if (e.boss || e.dying) { fx.emit(e.yokai.center(tmpV), { count: 40, color: 0x7a3dff, color2: 0x1a0c33, bright: 1, speed: 3, life: 1, size: 0.8, gravity: 0.5 }); removeEnemy(e); continue; }
    e.tag = null;
    e.swarm = true;
  }
  const types = ['onibi', 'chochin', 'kasa', 'onibi', 'chochin', 'onibi'];
  while (S.enemies.length < 6) {
    const type = types[S.enemies.length];
    const a = Math.random() * Math.PI * 2;
    const yokai = createYokai(type);
    yokai.root.position.set(Math.cos(a) * 6, 0, Math.sin(a) * 6 - 1);
    yokai.root.scale.setScalar(0.01);
    world.scene.add(yokai.root);
    S.enemies.push({ yokai, swarm: true, locked: true, dying: 0, age: 0, z: 0, tag: null });
  }
  S.enemies.forEach((e, i) => { e.swarmA = (i / S.enemies.length) * Math.PI * 2; });
}

function spawnCaptor() {
  const oni = createOni();
  captor.oni = oni;
  oni.root.scale.setScalar(CAPTOR_SCALE);
  world.scene.add(oni.root);
  // place the oni so that its grabbing hand lands right on the kneeling hero
  oni.setMode('grab');
  oni.snap(S.t);
  oni.root.position.set(0, 0, -3);
  oni.root.updateMatrixWorld(true);
  const palm = oni.handR.localToWorld(new THREE.Vector3(0, -0.2, 0));
  oni.root.position.x -= palm.x;
  oni.root.position.z -= palm.z - 0.05;
  captor.homeY = 0;
  oni.setMode('idle');
  oni.snap(S.t);
}

// once grabbed, the hero follows the oni's fist but stays upright, legs kicking
const palm = new THREE.Vector3();
function grabHero() {
  captor.holding = true;
  hero.setMode('grabbed');
}
function followFist() {
  captor.oni.handR.localToWorld(palm.set(0, -0.16, 0));
  hero.root.position.set(palm.x, palm.y - 1.0, palm.z + 0.12);
  hero.root.rotation.set(0, 0, Math.sin(S.t * 3.1) * 0.12);
}

function updateCapture(dt) {
  const T = S.caughtT += dt;
  const at = (key) => captor.step < CAPTURE_ORDER.indexOf(key) + 1 && T >= CAPTURE[key];
  if (at('kneel')) { captor.step++; hero.setMode('kneel'); }
  if (at('camera')) { captor.step++; world.setCameraMode('caught'); }
  if (at('portal')) {
    captor.step++;
    spawnCaptor();
    portalPos.set(captor.oni.root.position.x, 0.06, captor.oni.root.position.z);
    fx.magicCircle(portalPos, { color: 0x9a4dff, scale: 7, dur: 4.2, ground: true, spin: 1.2, bright: 2.4 });
    world.shake(0.35);
    sfx.portal();
  }
  if (at('risen')) { captor.step++; captor.oni.roar(); world.shake(0.7); sfx.roar(); }
  if (at('reach')) { captor.step++; captor.oni.setMode('reach'); }
  if (at('grab')) { captor.step++; captor.oni.setMode('grab'); }
  if (at('attach')) { captor.step++; grabHero(); world.shake(0.3); sfx.grab(); }
  if (at('lift')) { captor.step++; captor.oni.setMode('lift'); world.setCameraMode('held'); }
  if (at('laugh')) { captor.step++; captor.oni.setMode('laugh'); sfx.laugh(); }
  if (at('over')) { captor.step++; showGameOver(); }

  // the oni rising out of the portal in a column of smoke
  if (captor.oni) {
    const k = easeOut((T - CAPTURE.portal) / (CAPTURE.risen - CAPTURE.portal));
    captor.oni.root.position.y = -7 * (1 - k);
    if (k < 1) fx.emit(portalPos, { count: 4, color: 0x8a4dff, color2: 0x200c40, bright: 1.2, speed: 1.6, life: 1.2, size: 0.9, gravity: 1.6, up: 0.6, spread: 12 });
  }
}
const CAPTURE_ORDER = ['kneel', 'camera', 'portal', 'risen', 'reach', 'grab', 'attach', 'lift', 'laugh', 'over'];

// tap / key during the cinematic: jump straight to the oni holding the hero
function skipCapture() {
  if (S.mode !== 'caught' || S.caughtT < 0.4) return;
  if (!captor.oni) spawnCaptor();
  captor.oni.root.position.y = 0;
  hero.setMode('kneel');
  captor.oni.setMode('grab');
  captor.oni.snap(S.t);
  grabHero();
  captor.oni.setMode('laugh');
  captor.oni.snap(S.t);
  world.setCameraMode('held', true);
  S.caughtT = CAPTURE.over;
  captor.step = CAPTURE_ORDER.length;
  showGameOver();
}

function endCapture() {
  captor.holding = false;
  if (captor.oni) {
    world.scene.remove(captor.oni.root);
    captor.oni.dispose();
    captor.oni = null;
  }
  hero.reset();
  document.body.classList.remove('cinematic');
}

function showGameOver() {
  S.mode = 'over';
  const newBest = S.score > S.best;
  if (newBest) {
    S.best = S.score;
    ui.store.set('best', S.best);
    ui.setBest(S.best);
  }
  $('over-score').textContent = S.score.toLocaleString();
  $('over-newbest').hidden = !newBest;
  $('st-banished').textContent = S.banished;
  $('st-combo').textContent = S.maxCombo;
  $('st-dist').textContent = `${Math.floor(S.distance)} m`;
  $('st-ai').textContent = ui.t('aiStat', { n: S.ai.reads, c: S.ai.fixed, u: S.ai.unclear });
  ui.show('ov-over');
  sfx.over();
  $('btn-retry').focus();
}

/* ===================== run lifecycle ===================== */
function clearEnemies() {
  for (const e of [...S.enemies]) removeEnemy(e);
  ui.clearTags();
  fx.clear();
}

function resetRun() {
  clearEnemies();
  endCapture();
  Object.assign(S, {
    hearts: MAX_HEARTS, score: 0, distance: 0, banished: 0, combo: 0, maxCombo: 0, wave: 1,
    spawnTimer: 1.2, pendingBoss: false, cooldown: 0, invuln: 0, timeScale: 1,
    ai: { reads: 0, fixed: 0, unclear: 0 },
  });
  ui.setHearts(S.hearts, MAX_HEARTS);
  ui.setScore(0);
  ui.setDistance(0);
  ui.setCombo(0);
  ui.setWave(1);
  ui.resetAI();
  ui.showPadHint(false);
  pad.clear();
  setTempo(1);
}

function startGame() {
  if (!aiInfo.ready) return;
  initAudio();
  sfx.click();
  const fromOver = S.mode === 'over';
  resetRun();
  ui.show('ov-title', false);
  ui.show('ov-over', false);
  ui.show('ov-pause', false);
  document.body.classList.add('in-game');
  world.setCameraMode('play', fromOver);
  S.mode = 'intro';
  S.introT = fromOver ? 0.9 : 0;
  pad.setEnabled(false);
  startMusic();
}

function beginPlay() {
  S.mode = 'playing';
  pad.setEnabled(true);
  ui.banner(ui.t('go'), 'go');
}

function pause() {
  if (S.mode !== 'playing') return;
  S.mode = 'paused';
  pad.setEnabled(false);
  stopMusic();
  ui.show('ov-pause');
  $('btn-resume').focus();
}
function resume() {
  if (S.mode !== 'paused') return;
  ui.show('ov-pause', false);
  S.mode = 'playing';
  if (S.cooldown <= 0) pad.setEnabled(true);
  startMusic();
}
function toTitle() {
  stopMusic();
  resetRun();
  ui.show('ov-pause', false);
  ui.show('ov-over', false);
  ui.show('ov-title');
  document.body.classList.remove('in-game');
  world.setCameraMode('title');
  S.mode = 'title';
}

/* ===================== per-frame ===================== */
function updatePlaying(dt) {
  const P = waveParams(S.wave);
  S.distance += S.speed * dt * 0.6;
  ui.setDistance(S.distance);

  if (S.invuln > 0) S.invuln -= dt;
  if (S.cooldown > 0) {
    S.cooldown -= dt;
    if (S.cooldown <= 0) pad.setEnabled(true);
  }

  // combo aura: spirit sparks rising around the hero, colour by tier
  if (S.combo >= 5) {
    const tier = S.combo >= 20 ? 3 : S.combo >= 10 ? 2 : 1;
    fx.emit(tmpV.set(rand(-0.35, 0.35), rand(0.3, 1.6), rand(-0.2, 0.35)), {
      count: tier, color: auraColor(), color2: 0xffffff, bright: 1.8, speed: 0.5, life: 0.6, size: 0.12, gravity: 2, up: 0.4, dragK: 3,
    });
  }

  const bossAlive = S.enemies.some((e) => e.boss && !e.dying);
  const alive = S.enemies.filter((e) => !e.dying).length;
  if (alive === 0) S.spawnTimer = Math.min(S.spawnTimer, 0.8);
  S.spawnTimer -= dt;
  if (S.pendingBoss && !bossAlive) {
    S.pendingBoss = false;
    spawn(true);
    S.spawnTimer = P.interval * 1.5;
  } else if (S.spawnTimer <= 0 && alive < P.maxAlive - (bossAlive ? 1 : 0)) {
    spawn(false);
    S.spawnTimer = P.interval * rand(0.85, 1.2);
  }
}

const smooth01 = (k) => { const c = Math.min(1, Math.max(0, k)); return c * c * (3 - 2 * c); };

function updateEnemies(dt) {
  const moving = S.mode === 'playing';
  const shown = [];
  for (const e of [...S.enemies]) {
    e.yokai.update(dt, S.t);
    const root = e.yokai.root;
    if (e.dying) {
      e.dying += dt / 0.35;
      const k = Math.min(1, e.dying);
      root.scale.setScalar((1 + 0.4 * Math.sin(Math.PI * k)) * (1 - k * k));
      root.rotation.y += dt * 14;
      if (k >= 1) removeEnemy(e);
      continue;
    }
    e.age += dt;
    root.scale.setScalar(Math.max(0.01, easeOutBack(e.age / 0.45)));

    if (e.swarm) {
      // capture: a half-ring around the hero's sides and back (never between him
      // and the camera), drifting back and forth and facing him
      const a = Math.PI * 1.08 + e.swarmA * 0.84 / (2 * Math.PI) * Math.PI + Math.sin(S.t * 0.8 + e.swarmA * 3) * 0.12;
      const r = 2.8 + Math.sin(S.t * 1.7 + e.swarmA) * 0.25;
      const k = 1 - Math.exp(-dt * 2.2);
      root.position.x += (Math.cos(a) * r - root.position.x) * k;
      root.position.z += (Math.sin(a) * r * 0.8 - 0.4 - root.position.z) * k;
      root.rotation.y = Math.atan2(-root.position.x, -root.position.z);
      continue;
    }
    if (moving) {
      e.z += e.speed * dt;
      if (!e.locked && e.z >= HIT_Z) { playerHit(e); continue; }
    }
    const near = (e.z - SPAWN_Z) / (HIT_Z - SPAWN_Z);   // 0 at spawn → 1 at the hero
    root.position.z = e.z;
    root.position.x = e.x0 + (LANES[e.lane] - e.x0) * smooth01(near * 1.7);
    if (!e.tag) continue;
    world.project(e.yokai.labelAnchor(tmpV), scr);
    shown.push({ e, x: scr.x, y: scr.y, scale: 0.62 + near * 0.55, visible: scr.visible });
  }

  // Keep equation tags readable: nearest yokai keep their spot, farther tags
  // that would overlap are nudged upward (eased so they don't jitter).
  shown.sort((a, b) => b.e.z - a.e.z);
  const placed = [];
  for (const v of shown) {
    const w = v.e.tw * v.scale, h = v.e.th * v.scale;
    let y = v.y;
    for (let pass = 0; pass < 5; pass++) {
      let moved = false;
      for (const p of placed) {
        if (Math.abs(v.x - p.x) < (w + p.w) / 2 + 4 && y > p.y - p.h - 4 && y - h < p.y + 4) {
          y = p.y - p.h - 6;
          moved = true;
        }
      }
      if (!moved) break;
    }
    v.e.offY += (y - v.y - v.e.offY) * Math.min(1, dt * 12);
    placed.push({ x: v.x, y: v.y + v.e.offY, w, h });

    const e = v.e;
    e.sx = v.x; e.sy = v.y + e.offY;
    const timeLeft = (HIT_Z - e.z) / e.speed;
    ui.placeTag(e.tag, e.sx, e.sy, v.scale, v.visible ? Math.min(1, e.age / 0.6) : 0,
      moving && !e.locked && timeLeft < 2.3);
  }
}

function step(dt, realDt) {
  const P = waveParams(S.wave);
  let target = 3.2;
  if (S.mode === 'intro' || S.mode === 'playing') target = P.runSpeed;
  else if (S.mode === 'caught' || S.mode === 'over') target = 0;
  S.speed += (target - S.speed) * Math.min(1, dt * (S.mode === 'caught' ? 5 : 2));

  world.update(dt, S.speed, S.t);
  fx.setScale(world.pxScale);
  fx.update(dt);
  captor.oni?.update(dt, S.t);
  if (captor.holding) followFist();

  if (S.mode === 'intro') {
    S.introT += dt;
    if (S.introT > 1.45) beginPlay();
  } else if (S.mode === 'playing') {
    updatePlaying(dt);
    world.sampleFrame(realDt);
  } else if (S.mode === 'caught') {
    updateCapture(realDt);
  }
  updateEnemies(dt);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const realDt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (S.mode !== 'paused') {
    // brief slow motion as the last heart is lost
    const slow = S.mode === 'caught' && S.caughtT < 0.7 ? 0.25 + 0.75 * smooth01((S.caughtT - 0.3) / 0.4) : 1;
    const dt = realDt * slow;
    S.t += dt;
    step(dt, realDt);
  }
  world.render();
}
requestAnimationFrame(frame);

/* ===================== controls ===================== */
$('btn-start').addEventListener('click', startGame);
$('btn-retry').addEventListener('click', startGame);
$('btn-resume').addEventListener('click', resume);
$('btn-quit').addEventListener('click', toTitle);
$('btn-over-title').addEventListener('click', toTitle);
$('btn-pause').addEventListener('click', () => (S.mode === 'paused' ? resume() : pause()));
$('btn-mute').addEventListener('click', () => {
  muted = !muted;
  initAudio();
  setMuted(muted);
  ui.store.set('muted', muted);
  document.body.classList.toggle('muted', muted);
});
$('btn-ai').addEventListener('click', () => {
  const open = !document.body.classList.contains('ai-open');
  document.body.classList.toggle('ai-open', open);
  ui.store.set('aiPanel', open);
});
$('btn-lang').addEventListener('click', () => {
  ui.setLang(ui.getLang() === 'zh' ? 'en' : 'zh');
  ui.setWave(S.wave);
  ui.setBest(S.best);
  ui.setCombo(S.combo);
  if (aiInfo.ready) {
    $('btn-start').textContent = ui.t('start');
    $('ai-status').textContent = ui.t('ready', { b: aiInfo.backend });
  }
});
stage.addEventListener('pointerdown', skipCapture);

document.addEventListener('keydown', (e) => {
  if (S.mode === 'caught') { skipCapture(); return; }
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (S.mode === 'playing') pause(); else if (S.mode === 'paused') resume();
  } else if ((e.key === 'Enter' || e.key === ' ') && (S.mode === 'title' || S.mode === 'over') && document.activeElement?.tagName !== 'BUTTON') {
    e.preventDefault();
    startGame();
  } else if (DEBUG && S.mode === 'playing' && /^[0-9]$/.test(e.key)) {
    // ?debug: digit keys cast directly (skips the model) — handy for testing
    const d = Number(e.key);
    const c = document.createElement('canvas');
    c.width = 128; c.height = 192;
    const g = c.getContext('2d');
    g.fillStyle = '#f2cf63'; g.fillRect(0, 0, 128, 192);
    g.fillStyle = '#b3170f'; g.font = 'bold 120px serif'; g.textAlign = 'center'; g.fillText(String(d), 64, 140);
    if (targets().some((t) => t.answer === d)) cast(d, c); else fizzle(d, c, targets().length > 0);
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

if (DEBUG) window.__mathrun = { S, world, fx, hero, captor, spawn, decide, waveParams, beginCapture, skipCapture };
