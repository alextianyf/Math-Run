// flow.js — the life of a run: start (with or without the tutorial), pause and
// resume, the game-over card, and back to the title.
import { RANKS } from '../difficulty/adaptive.js';
import { aiInfo } from '../ai/recognizer.js';
import { initAudio, sfx, startMusic, stopMusic, setTempo } from '../ui/audio.js';
import * as ui from '../ui/ui.js';
import { S, MAX_HEARTS } from './state.js';
import { world, director } from './stage.js';
import { showRank, saveBest } from './progress.js';
import { clearEnemies } from './enemies.js';
import { endCapture } from './capture.js';
import { pad } from './handwriting.js';
import { coach, startTutorial } from './tutorial.js';
import { $ } from './helpers.js';

// a clean slate: no yokai, full hearts, zero score, a fresh director
function resetRun() {
  clearEnemies();
  endCapture();
  Object.assign(S, {
    hearts: MAX_HEARTS, score: 0, distance: 0, banished: 0, combo: 0, maxCombo: 0, wave: 1,
    spawnTimer: 1.2, pendingBoss: false, trialHold: 0, cooldown: 0, invuln: 0,
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
export function startGame(retry = false) {
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

// the intro camera move has landed: the run is on
export function beginPlay() {
  S.mode = 'playing';
  if (S.tut) return;                     // the tutorial owns the pad and the first yokai
  pad.setEnabled(true);
  ui.banner(ui.t('go'), 'go');
}

export function pause() {
  if (S.mode !== 'playing') return;
  S.mode = 'paused';
  document.body.classList.add('paused');
  pad.setEnabled(false);
  stopMusic();
  ui.show('ov-pause');
  $('btn-resume').focus();
}

export function resume() {
  if (S.mode !== 'paused') return;
  ui.show('ov-pause', false);
  document.body.classList.remove('paused');
  S.mode = 'playing';
  if (S.cooldown <= 0 && (!S.tut || S.tut.step === 'write')) pad.setEnabled(true);
  startMusic();
}

export function toTitle() {
  stopMusic();
  if (S.mode === 'paused' || S.mode === 'playing') {
    saveBest();
    director.endRun();
  }
  resetRun();
  ui.show('ov-pause', false);
  ui.show('ov-over', false);
  ui.show('ov-title');
  document.body.classList.remove('in-game', 'paused');
  world.setCameraMode('title');
  S.mode = 'title';
}

export function showGameOver() {
  S.mode = 'over';
  const newBest = saveBest();
  $('over-score').textContent = S.score.toLocaleString();
  $('over-newbest').hidden = !newBest;
  $('st-banished').textContent = S.banished;
  $('st-combo').textContent = S.maxCombo;
  $('st-dist').textContent = `${Math.floor(S.distance)} m`;

  // rank and rating: this run's change and its curve
  const run = director.endRun();
  const delta = run.rating - run.start;
  $('st-rank').textContent = ui.t('rankLine', { r: ui.t(director.rankKey), v: run.rating, d: `${delta >= 0 ? '+' : ''}${delta}` });
  ui.setRankCurve(run.history);
  // the ladder, and how close the next rank was — the reason to go again
  const progress = director.progress;
  ui.renderLadder($('over-ladder'), { reached: run.rank, progress, known: Math.max(S.bestRank, run.rank) + 1 });
  const next = ui.t(`rank${run.rank + 1}`);
  $('over-next').textContent = run.rank >= RANKS.length - 1 ? ui.t('topReached')
    : progress >= 1 ? ui.t('oneTrial', { r: next })
    : progress >= 0.6 ? ui.t('nearNext', { r: next })
    : ui.t('nextRank', { r: next });

  $('st-ai').textContent = ui.t('aiStat', { n: S.ai.reads, c: S.ai.fixed, u: S.ai.unclear });
  ui.show('ov-over');
  sfx.over();
  $('btn-retry').focus();
}
