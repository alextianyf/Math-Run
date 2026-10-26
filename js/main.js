// main.js — Math Run: Night Parade (百鬼夜行). The entry point: it sets the stage,
// loads the AI, runs the frame loop and connects the buttons and keys.
//
// Yokai drift down the shrine path, each carrying an equation. The player
// handwrites a digit on the talisman; the MNIST model reads it and a talisman
// flies at EVERY yokai whose answer matches. Where things live:
//   js/game/        the rules: yokai, casting, skills and night events, scoring, tutorial, capture, run flow
//   js/difficulty/  adaptive difficulty: the director and the problem generator
//   js/ai/          handwritten-digit recognition (TensorFlow.js)
//   js/scene/       the 3D world, characters and spell effects (Three.js)
//   js/ui/          screen, texts, the talisman pad, coach and sound
import { initRecognizer, aiInfo } from './ai/recognizer.js';
import { initAudio, setMuted } from './ui/audio.js';
import * as ui from './ui/ui.js';
import { S, MAX_HEARTS, targets } from './game/state.js';
import { world, hero, fx, director, prewarm } from './game/stage.js';
import { showRank, saveBest } from './game/progress.js';
import { spawn, updateSpawner, updateEnemies } from './game/enemies.js';
import { onTalisman, decide } from './game/handwriting.js';
import { answer, cast, fizzle, playerHit, updateCombat } from './game/combat.js';
import { coach, updateTutorial, tutorialWriting, tutorialAnswer } from './game/tutorial.js';
import { beginCapture, updateCapture, animateCaptor, skipCapture } from './game/capture.js';
import { startGame, retryRun, beginPlay, pause, resume, toTitle, showGameOver, shareRun, shareBest } from './game/flow.js';
import { initCollection, refreshCollectionChip } from './game/collection.js';
import { initShareCard } from './game/shareCard.js';
import { initRules } from './game/rules.js';
import { updatePowers, useSkill, resetPowers, charge, later } from './game/powers.js';
import { $, smooth01 } from './game/helpers.js';

const DEBUG = new URLSearchParams(location.search).has('debug');

/* ===================== setup ===================== */
const stage = $('stage');
function onResize() {
  world.resize(stage.clientWidth, stage.clientHeight);
  fx.setScale(world.pxScale);
}
new ResizeObserver(onResize).observe(stage);
onResize();

ui.applyI18n();
ui.setHearts(MAX_HEARTS, MAX_HEARTS);
ui.setBest(S.best);
ui.setBestRank(S.bestRank);
initCollection();
initShareCard();      // a shared result link opens its card first
initRules();
showRank();
ui.resetAI();
// Creating the audio engine can block for half a second on some PCs, so it's done
// now, while the page loads; it stays suspended until Start (browsers require a tap).
initAudio();

let muted = ui.store.get('muted', false);
setMuted(muted);
document.body.classList.toggle('muted', muted);
document.body.classList.toggle('ai-open', ui.store.get('aiPanel', window.innerWidth >= 900));

// what a reading of the talisman does: the tutorial handles it while it runs
onTalisman({
  write: tutorialWriting,
  read: (reading) => (S.tut ? tutorialAnswer(reading) : answer(reading)),
});

/* ===================== loading screen ===================== */
// The loading screen stays up until everything is ready — the digit recogniser
// (warmed up), the hero model, and every shader and model on the GPU (prewarm) — so
// the title never stutters. If the hero fails to load we still let the game start.
const loading = new Set(['bootAI', 'bootHero']);       // what is still on its way
// the next painted frame — or a moment later in a background tab, which paints nothing
const nextFrame = () => new Promise((resolve) => { requestAnimationFrame(() => resolve()); setTimeout(resolve, 100); });
function bootStatus(fraction) {
  $('loader-text').textContent = ui.t(loading.size ? [...loading][0] : 'bootScene');
  $('loader-fill').style.width = `${Math.round(fraction * 100)}%`;
}
const loaded = (key) => () => { loading.delete(key); bootStatus((2 - loading.size) / 3); };
bootStatus(0.05);

Promise.all([
  initRecognizer().then(loaded('bootAI')),
  hero.ready.catch(() => null).then(loaded('bootHero')),
])
  .then(async () => {
    await nextFrame();                       // let "Preparing the scene…" show first:
    await nextFrame();                       // the prewarm frame below is a long one
    prewarm();
    $('btn-start').disabled = false;
    $('start-label').dataset.i18n = 'start';
    $('start-label').textContent = ui.t('start');
    $('ai-status').dataset.i18n = '';
    $('ai-status').textContent = ui.t('ready');
    $('ai-chip').classList.add('ready');
    ui.setAIMeta(aiInfo.backend);
    if (S.mode === 'loading') S.mode = 'title';
    bootStatus(1);
    await nextFrame();
    $('loader').classList.add('done');       // fade out, and let the title card rise in
    document.body.classList.remove('booting');
  })
  .catch((err) => {
    console.error('[math-run] model load failed', err);
    $('loader-text').textContent = ui.t('loadFail');
    $('loader-retry').textContent = ui.t('retry');
    $('loader-retry').hidden = false;
    $('loader-retry').addEventListener('click', () => location.reload());
    $('start-label').dataset.i18n = 'loadFail';
    $('start-label').textContent = ui.t('loadFail');
    $('ai-chip').classList.add('fail');
  });

/* ===================== frame loop ===================== */
function updatePlaying(dt) {
  if (S.tut) { updateTutorial(dt); return; }
  S.distance += S.speed * dt * 0.6;
  ui.setDistance(S.distance);
  updateCombat(dt);
  updateSpawner(dt);
}

function step(dt, realDt) {
  // the hero runs while playing, stands on the title and stops while the tutorial talks
  let target = 0;
  if (S.mode === 'intro' || S.mode === 'playing') target = S.tut?.frozen ? 0 : director.runSpeed();
  S.speed += (target - S.speed) * Math.min(1, dt * (S.mode === 'caught' ? 5 : 2));

  world.update(dt, S.speed, S.t);
  fx.setScale(world.pxScale);
  fx.update(dt);
  animateCaptor(dt);

  if (S.mode === 'intro') {
    S.introT += dt;
    updatePowers(dt);
    if (S.tut) updateTutorial(dt);
    if (S.introT > 1.45) beginPlay();
  } else if (S.mode === 'playing') {
    updatePowers(dt);
    updatePlaying(dt);
    world.sampleFrame(realDt);
  } else if (S.mode === 'caught') {
    if (updateCapture(realDt)) showGameOver();
  }
  updateEnemies(dt, playerHit);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const realDt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (S.mode !== 'paused') {
    // brief slow motion as the last heart is lost, and through the oni's finisher
    let slow = S.mode === 'caught' && S.caughtT < 0.7 ? 0.25 + 0.75 * smooth01((S.caughtT - 0.3) / 0.4) : 1;
    if (S.slowmo > 0) {
      S.slowmo -= realDt;
      slow = Math.min(slow, 0.3 + 0.7 * smooth01(1 - S.slowmo / 0.5));
    }
    const dt = realDt * slow;
    S.t += dt;
    step(dt, realDt);
  }
  world.render();
}
requestAnimationFrame(frame);

/* ===================== buttons & keys ===================== */
const skip = () => { if (skipCapture()) showGameOver(); };

$('btn-start').addEventListener('click', () => startGame(false));
$('btn-share').addEventListener('click', shareRun);
$('btn-share-best').addEventListener('click', shareBest);
$('btn-retry').addEventListener('click', retryRun);
$('skill').addEventListener('click', useSkill);
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
  ui.setBestRank(S.bestRank);
  ui.setCombo(S.combo);
  refreshCollectionChip();
  if (aiInfo.ready) $('ai-status').textContent = ui.t('ready');
});
stage.addEventListener('pointerdown', skip);

document.addEventListener('keydown', (e) => {
  if (S.mode === 'caught') { skip(); return; }
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (S.mode === 'playing') pause(); else if (S.mode === 'paused') resume();
  } else if (e.key === ' ' && S.mode === 'playing') {
    e.preventDefault();
    useSkill();
  } else if ((e.key === 'Enter' || e.key === ' ') && (S.mode === 'title' || S.mode === 'over') && document.activeElement?.tagName !== 'BUTTON') {
    e.preventDefault();
    startGame(S.mode === 'over');
  } else if (DEBUG && S.mode === 'playing' && /^[0-9]$/.test(e.key)) {
    debugCast(Number(e.key));
  } else if (DEBUG && S.mode === 'playing' && e.key === 'k') {
    charge(1);                                   // ?debug: a skill now
  } else if (DEBUG && S.mode === 'playing' && e.key === 'e') {
    if (S.event) S.event.t = S.event.dur; else S.nextEventAt = 0;    // ?debug: next night event
  } else if (DEBUG && S.mode === 'playing' && e.key === 'b') {
    S.pendingBoss = true;                        // ?debug: a rank trial
  }
});
// leaving the page pauses the run (the problems are replaced when it goes on, see resume())
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (S.mode === 'playing' || S.mode === 'paused') saveBest(); });

/* ===================== ?debug ===================== */
// digit keys cast directly (skipping the model), and the game is reachable from the console
function debugCast(d) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 192;
  const g = c.getContext('2d');
  g.fillStyle = '#f2cf63'; g.fillRect(0, 0, 128, 192);
  g.fillStyle = '#b3170f'; g.font = 'bold 120px serif'; g.textAlign = 'center'; g.fillText(String(d), 64, 140);
  if (targets().some((t) => t.answer === d)) cast(d, c); else fizzle(d, c, targets().length > 0);
}
if (DEBUG) window.__mathrun = { S, world, fx, hero, spawn, decide, director, beginCapture, skipCapture, coach, charge, useSkill, later };
