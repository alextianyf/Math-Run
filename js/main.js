// main.js — game rules & loop for Math Run: Night Parade (百鬼夜行).
//
// Yokai drift down the shrine path, each carrying an equation. The player
// handwrites a digit on the talisman; the MNIST model reads it and a talisman
// flies at EVERY yokai whose answer matches — so spotting shared answers pays.
// What comes next is decided by the adaptive director (adaptive.js): problems are
// generated on the fly (problems.js) to match the player's Elo-style rating.
// Losing the last heart plays a capture cinematic: the parade circles the hero
// and the great oni rises from a portal to grab him. Every run started from the
// title opens with a playable tutorial that pauses on the first yokai.
import * as THREE from 'three';
import { createWorld, LANES } from './world.js';
import { createYokai } from './yokai.js';
import { createOni } from './oni.js';
import { createFx } from './fx.js';
import { createDirector } from './adaptive.js';
import { createPad, MODEL_SIZE } from './pad.js';
import { initRecognizer, classify, aiInfo } from './recognizer.js';
import { initAudio, setMuted, sfx, startMusic, stopMusic, setTempo } from './audio.js';
import * as ui from './ui.js';
import { createCoach } from './tutorial.js';

const $ = (id) => document.getElementById(id);
const DEBUG = new URLSearchParams(location.search).has('debug');

/* ===================== tuning ===================== */
const SPAWN_Z = -58;          // where yokai appear
const HIT_Z = -0.6;           // where they reach the hero
const MAX_HEARTS = 3;
const HEAL_STREAK = 8;        // this many right in a row wins a heart back
const KILLS_PER_WAVE = 6;     // a "wave" beat (banner + chime) every this many yokai banished
const TYPE_PACE = { onibi: 1, chochin: 1.08, kasa: 0.94, oni: 2.3 };   // × travel time
const AURA = [                // combo aura tiers: [min combo, colour]
  [20, 0xc77dff],
  [10, 0x6fd8ff],
  [5, 0xffc84a],
];
const CAPTOR_SCALE = 1.45;

/* ===================== state ===================== */
const S = {
  mode: 'loading',            // loading | title | intro | playing | paused | caught | over
  t: 0, introT: 0, caughtT: 0, timeScale: 1,
  speed: 3,
  hearts: MAX_HEARTS, score: 0, distance: 0, banished: 0,
  combo: 0, maxCombo: 0, wave: 1,
  spawnTimer: 0, pendingBoss: false, trialHold: 0,
  cooldown: 0, invuln: 0,
  enemies: [],
  ai: { reads: 0, fixed: 0, unclear: 0 },
  best: ui.store.get('best', 0),
  tut: null,                  // active tutorial: { step, frozen, e, misses, timer }
};
const captor = { oni: null, step: 0 };
const director = createDirector();
const showRank = () => ui.setRank(director.rankKey);

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

const pad = createPad($('pad'), {
  onInput: () => { if (S.tut?.step === 'write') coach.demo(false); liveGuess(); },
  onFinish: finishWriting,
  onArm: (ms) => ui.armTalisman(ms),
  onDisarm: () => ui.disarmTalisman(),
});
const coach = createCoach();
new ResizeObserver(() => pad.resize()).observe($('pad'));

ui.applyI18n();
ui.setHearts(MAX_HEARTS, MAX_HEARTS);
ui.setBest(S.best);
director.startRun();
showRank();
ui.resetAI();

let muted = ui.store.get('muted', false);
setMuted(muted);
document.body.classList.toggle('muted', muted);
document.body.classList.toggle('ai-open', ui.store.get('aiPanel', window.innerWidth >= 900));

// the hero model loads alongside the digit recogniser; if it fails we still let the game start
Promise.all([initRecognizer(), hero.ready.catch(() => null)])
  .then(() => {
    $('btn-start').disabled = false;
    $('start-label').dataset.i18n = 'start';
    $('start-label').textContent = ui.t('start');
    $('ai-status').dataset.i18n = '';
    $('ai-status').textContent = ui.t('ready', { b: aiInfo.backend });
    $('ai-chip').classList.add('ready');
    ui.setAIMeta(aiInfo.backend);
    if (S.mode === 'loading') S.mode = 'title';
  })
  .catch((err) => {
    console.error('[math-run] model load failed', err);
    $('start-label').dataset.i18n = 'loadFail';
    $('start-label').textContent = ui.t('loadFail');
    $('ai-chip').classList.add('fail');
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
  if (S.banished >= 6 && r < 0.25) return 'kasa';
  return r < 0.62 ? 'onibi' : 'chochin';
}

function chooseLane() {
  // prefer lanes with nothing near the spawn point, so equation tags don't overlap
  const free = [0, 1, 2].filter((l) => !S.enemies.some((e) => e.lane === l && !e.dying && e.z < SPAWN_Z + 16));
  const pool = free.length ? free : [0, 1, 2];
  return pool[Math.floor(Math.random() * pool.length)];
}

// forced: { type, lane, text, answer, z, speed } — a scripted yokai (the tutorial)
function spawn(boss = false, forced = null) {
  const type = forced?.type ?? (boss ? 'oni' : pickType());
  const lane = forced?.lane ?? (boss ? 1 : chooseLane());
  const live = targets();
  // ~30%: reuse an answer already on screen (different expression) → multi-banish chance
  const reuse = live.length && Math.random() < 0.3 ? live[Math.floor(Math.random() * live.length)].answer : undefined;
  const prob = forced ?? director.nextProblem({ answer: reuse, avoid: new Set(live.map((e) => e.text)), boss });
  const z0 = forced?.z ?? SPAWN_Z;

  // drift in from the forest on either side, settling into the lane as it approaches
  // (keeps far-away tags apart, where perspective squeezes the lanes together)
  const side = lane === 1 ? (Math.random() < 0.5 ? -1 : 1) : lane - 1;
  const x0 = boss ? 0 : LANES[lane] + side * rand(3, 4.5);
  const yokai = createYokai(type);
  yokai.root.position.set(x0, 0, z0);
  yokai.root.scale.setScalar(0.01);
  world.scene.add(yokai.root);

  const hpTotal = boss ? 3 + (director.rank >= 3 ? 1 : 0) : 1;
  const qTravel = forced ? 1 : director.travelTime(prob);     // thinking time this problem deserves
  const e = {
    yokai, lane, boss, x0,
    z: z0,
    speed: forced?.speed ?? (HIT_Z - SPAWN_Z) / (qTravel * TYPE_PACE[type]),
    problem: prob, qStart: 0, qTravel,
    answer: prob.answer, text: prob.text,
    tag: ui.createTag(prob.text, { boss, hp: hpTotal, stretch: prob.stretch }),
    hpDone: 0, hpTotal,
    locked: false, dying: 0, age: 0, sx: 0, sy: 0, offY: 0,
  };
  measureTag(e);
  S.enemies.push(e);
  fx.emit(yokai.center(tmpV), { count: boss ? 50 : 22, color: 0x7a3dff, color2: 0x1a0c33, bright: 1, speed: boss ? 4 : 2.5, life: 1, size: boss ? 0.9 : 0.5, gravity: 0.6, up: 0.3 });

  if (boss) {
    ui.banner(ui.t('trial'), 'boss', 2);
    sfx.boss();
    world.shake(0.25);
  }
  return e;
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
  ui.disarmTalisman();
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
  if (S.tut) { tutorialAnswer(dec, pct, result, paper); return; }
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
    // a clearly written wrong digit is a wrong answer to the most urgent problem
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
    record(e, true);
    const prob = director.nextProblem({ avoid: new Set(targets().map((o) => o.text)), boss: true });
    Object.assign(e, { problem: prob, qStart: e.age, qTravel: director.travelTime(prob), answer: prob.answer, text: prob.text });
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
  record(e, true);
  if (e.boss) {
    // rank trial passed: promotion, and a heart back as a reward
    ui.setTagHp(e.tag, e.hpTotal, e.hpTotal);
    world.shake(0.4);
    director.promote();
    showRank();
    setTempo(director.tempo());
    ui.banner(ui.t('promoted', { r: ui.t(director.rankKey) }), 'multi', 2);
    sfx.wave();
    heal(false);
    S.trialHold = 2;                        // let the promotion sink in before any next trial
  }
  e.yokai.flash();
  e.dying = 0.0001;
  if (S.tut && e === S.tut.e) tutorialBanished();
  ui.setTagState(e.tag, 'hit');
  ui.removeTag(e.tag, 600);
  e.tag = null;
  advance(e.boss ? 3 : 1);
}

// every few yokai banished: a "wave" beat, a banner and a chime to mark progress
// (how hard and how fast is the director's business, not the wave's)
function advance(kills) {
  S.banished += kills;
  const wave = 1 + Math.floor(S.banished / KILLS_PER_WAVE);
  if (wave > S.wave) {
    S.wave = wave;
    ui.banner(ui.t('wave', { n: wave }), 'wave', 1);
    sfx.wave();
  }
}

// one problem's outcome → the director; a rank trial is queued when the rating earns
// one, and a long enough run of right answers wins a heart back
function record(e, correct) {
  if (S.tut) return;
  const out = director.record(e.problem, { correct, time: e.age - e.qStart, travel: e.qTravel });
  if (!out) return;                                   // already answered once
  showRank();
  if (out.trial && !S.pendingBoss && !S.enemies.some((o) => o.boss && !o.dying)) S.pendingBoss = true;
  if (correct && out.streak % HEAL_STREAK === 0) heal(true);
}

function heal(announce) {
  if (S.hearts >= MAX_HEARTS) return;
  S.hearts++;
  ui.setHearts(S.hearts, MAX_HEARTS);
  sfx.heal();
  if (announce) ui.banner(ui.t('heal'), 'heal', 1);
}

/* ===================== damage ===================== */
function playerHit(e) {
  const p = e.yokai.center(new THREE.Vector3());
  fx.emit(p, { count: 46, color: 0x9a5cff, color2: 0x2a1840, bright: 1.4, speed: 4, life: 0.9, size: 0.45, gravity: 0.5 });
  fx.ring(p, { color: 0x9a5cff, scale: 3 });
  record(e, false);
  if (!S.tut) director.hit();
  removeEnemy(e);
  if (S.invuln > 0) return;

  S.hearts = Math.max(0, S.hearts - 1);       // a failed rank trial too: one heart, never more
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
  hero.root.position.set(palm.x, palm.y - 1.08, palm.z + 0.12);
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
  const run = director.endRun();
  const delta = run.rating - run.start;
  $('st-rank').textContent = ui.t('rankLine', { r: ui.t(director.rankKey), v: run.rating, d: `${delta >= 0 ? '+' : ''}${delta}` });
  ui.setRankCurve(run.history);
  $('st-ai').textContent = ui.t('aiStat', { n: S.ai.reads, c: S.ai.fixed, u: S.ai.unclear });
  ui.show('ov-over');
  sfx.over();
  $('btn-retry').focus();
}

/* ===================== opening tutorial ===================== */
// Plays inside the real run: the first yokai drifts in and the game pauses on it.
// The coach spotlights the yokai, its equation, then the talisman (with a writing
// demo) and waits for a correct answer — wrong answers are coached, not punished.
// Then it explains hearts, asks "got it?", and counts the real run in: 3, 2, 1.
const TUT_YOKAI = { type: 'onibi', lane: 1, text: '1 + 2', answer: 3, z: -25, speed: 10 };   // reaches the stop ~1.1 s after Start
const TUT_FREEZE_Z = -14;

const padded = (r, p) => ({ x: r.left - p, y: r.top - p, w: r.width + p * 2, h: r.height + p * 2 });
const tutA = new THREE.Vector3(), tutB = new THREE.Vector3(), scrA = { x: 0, y: 0 }, scrB = { x: 0, y: 0 };

function yokaiSpot() {
  const e = S.tut?.e;
  if (!e || !S.enemies.includes(e)) return null;
  world.project(e.yokai.center(tutA), scrA);
  world.project(tutB.copy(tutA).setY(tutA.y + 0.5), scrB);
  const r = Math.max(52, Math.abs(scrA.y - scrB.y) * 1.7);
  const s = stage.getBoundingClientRect();
  return { x: s.left + scrA.x - r, y: s.top + scrA.y - r, w: r * 2, h: r * 2, round: true };
}
function tagSpot() {
  const el = S.tut?.e?.tag?.querySelector('.tag-in');
  return el ? padded(el.getBoundingClientRect(), 10) : null;
}
const elSpot = (id, p = 10) => () => padded($(id).getBoundingClientRect(), p);

function startTutorial() {
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
  const next = (to) => [{ label: ui.t('tutNext'), onClick: () => tutStep(to) }];
  if (step === 'yokai') {
    coach.focus(yokaiSpot);
    coach.say({ title: ui.t('tutYokaiT'), text: ui.t('tutYokai'), buttons: next('equation') });
  } else if (step === 'equation') {
    coach.focus(tagSpot);
    coach.say({ title: ui.t('tutEqT'), text: ui.t('tutEq'), buttons: next('write') });
  } else if (step === 'write') {
    coach.focus(elSpot('talisman', 12));
    coach.say({ title: ui.t('tutWriteT'), text: ui.t('tutWrite') });
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

function updateTutorial(dt) {
  const T = S.tut;
  if (T.step === 'approach' && T.e && T.e.z >= TUT_FREEZE_Z) T.frozen = true;   // the parade halts…
  if (T.step === 'approach' && T.frozen && (S.mode === 'playing' || S.introT > 1.2)) tutStep('yokai');   // …and as the camera lands, the coach takes over
  if (T.step === 'banished' && (T.timer -= dt) <= 0) tutStep('nice');
  coach.update(dt);
}

function tutorialAnswer(dec, pct, result, paper) {
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

function tutorialBanished() {
  S.tut.step = 'banished';
  S.tut.timer = 0.9;                         // let the seal and sparks play first
}

function replayTutorial() {
  for (const e of [...S.enemies]) removeEnemy(e);
  Object.assign(S.tut, { step: 'approach', frozen: false, misses: 0 });
  coach.hush();
  coach.focus(null, { dim: false });
  S.tut.e = spawn(false, TUT_YOKAI);
}

// "Keep running" or Skip: count the real run in, starting from a clean slate
async function finishTutorial() {
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
    spawnTimer: 1.2, pendingBoss: false, trialHold: 0, cooldown: 0, invuln: 0, timeScale: 1,
    ai: { reads: 0, fixed: 0, unclear: 0 },
  });
  ui.setHearts(S.hearts, MAX_HEARTS);
  ui.setScore(0);
  ui.setDistance(0);
  ui.setCombo(0);
  director.startRun();
  showRank();
  ui.resetAI();
  pad.clear();
  setTempo(director.tempo());
  S.tut = null;
  coach.show(false);
}

// retry = "Run again" from the game-over card: skips the tutorial and the long intro.
// Every Start from the title plays the tutorial.
function startGame(retry = false) {
  if (!aiInfo.ready) return;
  initAudio();
  sfx.click();
  const fromOver = retry && S.mode === 'over';
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
  if (!retry) startTutorial();
}

function beginPlay() {
  S.mode = 'playing';
  if (S.tut) return;                     // the tutorial owns the pad and the first yokai
  pad.setEnabled(true);
  ui.banner(ui.t('go'), 'go');
}

function pause() {
  if (S.mode !== 'playing') return;
  S.mode = 'paused';
  document.body.classList.add('paused');
  pad.setEnabled(false);
  stopMusic();
  ui.show('ov-pause');
  $('btn-resume').focus();
}
function resume() {
  if (S.mode !== 'paused') return;
  ui.show('ov-pause', false);
  document.body.classList.remove('paused');
  S.mode = 'playing';
  if (S.cooldown <= 0 && (!S.tut || S.tut.step === 'write')) pad.setEnabled(true);
  startMusic();
}
function toTitle() {
  stopMusic();
  if (S.mode === 'paused' || S.mode === 'playing') director.endRun();
  resetRun();
  ui.show('ov-pause', false);
  ui.show('ov-over', false);
  ui.show('ov-title');
  document.body.classList.remove('in-game', 'paused');
  world.setCameraMode('title');
  S.mode = 'title';
}

/* ===================== per-frame ===================== */
function updatePlaying(dt) {
  if (S.tut) { updateTutorial(dt); return; }
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
  S.trialHold -= dt;
  if (S.pendingBoss && !bossAlive && S.trialHold <= 0) {
    S.pendingBoss = false;
    spawn(true);
    S.spawnTimer = director.spawnInterval() * 1.5;
  } else if (S.spawnTimer <= 0 && alive < director.maxAlive() - (bossAlive ? 1 : 0)) {
    spawn(false);
    S.spawnTimer = director.spawnInterval() * rand(0.85, 1.2);
  }
}

const smooth01 = (k) => { const c = Math.min(1, Math.max(0, k)); return c * c * (3 - 2 * c); };

function updateEnemies(dt) {
  const moving = (S.mode === 'playing' || (S.mode === 'intro' && S.tut)) && !S.tut?.frozen;
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
  let target = 0;                       // title: the hero stands in his idle pose
  if (S.mode === 'intro' || S.mode === 'playing') target = S.tut?.frozen ? 0 : director.runSpeed();   // the hero stops while the tutorial talks
  else if (S.mode === 'caught' || S.mode === 'over') target = 0;
  S.speed += (target - S.speed) * Math.min(1, dt * (S.mode === 'caught' ? 5 : 2));

  world.update(dt, S.speed, S.t);
  fx.setScale(world.pxScale);
  fx.update(dt);
  captor.oni?.update(dt, S.t);
  if (captor.holding) followFist();

  if (S.mode === 'intro') {
    S.introT += dt;
    if (S.tut) updateTutorial(dt);
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
$('btn-start').addEventListener('click', () => startGame(false));
$('tut-skip').addEventListener('click', () => finishTutorial());
$('btn-retry').addEventListener('click', () => startGame(true));
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
  showRank();
  ui.setBest(S.best);
  ui.setCombo(S.combo);
  if (aiInfo.ready) $('ai-status').textContent = ui.t('ready', { b: aiInfo.backend });
});
stage.addEventListener('pointerdown', skipCapture);

document.addEventListener('keydown', (e) => {
  if (S.mode === 'caught') { skipCapture(); return; }
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (S.mode === 'playing') pause(); else if (S.mode === 'paused') resume();
  } else if ((e.key === 'Enter' || e.key === ' ') && (S.mode === 'title' || S.mode === 'over') && document.activeElement?.tagName !== 'BUTTON') {
    e.preventDefault();
    startGame(S.mode === 'over');
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

if (DEBUG) window.__mathrun = { S, world, fx, hero, captor, spawn, decide, director, beginCapture, skipCapture, coach };
