// flow.js — the life of a run: start (with or without the tutorial), pause and
// resume, the game-over card (and sharing it), and back to the title.
import { RANKS } from '../difficulty/adaptive.js';
import { aiInfo } from '../ai/recognizer.js';
import { initAudio, sfx, startMusic, stopMusic, setTempo } from '../ui/audio.js';
import * as ui from '../ui/ui.js';
import { S, MAX_HEARTS } from '../core/state.js';
import { world, director } from './stage.js';
import { showRank, saveBest } from './progress.js';
import { clearEnemies, rerollProblems } from './enemies.js';
import { endCapture } from './capture.js';
import { pad } from './handwriting.js';
import { coach, startTutorial } from './tutorial.js';
import { emit } from '../core/events.js';
import { openShare } from './shareCard.js';
import { resetPowers } from './powers.js';
import { $ } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { store } from '../core/store.js';

// a clean slate: no yokai, full hearts, zero score, a fresh director
function resetRun() {
  clearEnemies();
  endCapture();
  Object.assign(S, {
    hearts: MAX_HEARTS, score: 0, distance: 0, banished: 0, combo: 0, maxCombo: 0,
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
  resetPowers();
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

// sharing: the run's own card and link (shareCard.js)
let lastRun = null;
export const shareRun = () => lastRun && openShare(lastRun);
// the title screen's Share: the record run (older records only know their score)
export function shareBest() {
  if (!S.best) return;
  const r = store.get('bestRun', null);
  openShare(r && r.score === S.best ? r : { score: S.best, rank: S.bestRank });
}

// the intro camera move has landed: the run is on
export function beginPlay() {
  S.mode = 'playing';
  if (S.tut) return;                     // the tutorial runs the pad itself
  pad.setEnabled(true);
  ui.banner(t('go'), 'go');
}

export function pause() {
  if (S.mode !== 'playing') return;
  S.mode = 'paused';
  document.body.classList.add('paused');
  pad.setEnabled(false);
  stopMusic();
  $('pause-note').hidden = !!S.tut;      // the problems are hidden while paused…
  ui.show('ov-pause');
  $('btn-resume').focus();
}

export function resume() {
  if (S.mode !== 'paused') return;
  ui.show('ov-pause', false);
  document.body.classList.remove('paused');
  S.mode = 'playing';
  rerollProblems();                      // …and replaced when the run goes on
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

export function retryRun() { startGame(true); }

export function showGameOver() {
  S.mode = 'over';
  const newBest = saveBest();
  $('over-title').textContent = t('overTitle');
  $('over-score').textContent = S.score.toLocaleString();
  $('over-newbest').hidden = !newBest;
  $('btn-share').textContent = t('share');
  $('st-banished').textContent = S.banished;
  $('st-combo').textContent = S.maxCombo;
  $('st-dist').textContent = `${Math.floor(S.distance)} m`;

  // rank and rating: this run's change and its curve
  const run = director.endRun();
  const delta = run.rating - run.start;
  $('st-rank').textContent = t('rankLine', { r: t(director.rankKey), v: run.rating, d: `${delta >= 0 ? '+' : ''}${delta}` });
  ui.setRankCurve(run.history);
  // the ladder, and how close the next rank was — the reason to go again
  const progress = director.progress;
  ui.renderLadder($('over-ladder'), { reached: run.rank, progress, known: Math.max(S.bestRank, run.rank) + 1 });
  const next = t(`rank${run.rank + 1}`);
  $('over-next').textContent = run.rank >= RANKS.length - 1 ? t('topReached')
    : progress >= 1 ? t('oneTrial', { r: next })
    : progress >= 0.6 ? t('nearNext', { r: next })
    : t('nextRank', { r: next });

  $('st-ai').textContent = t('aiStat', { n: S.ai.reads, c: S.ai.fixed, u: S.ai.unclear });
  emit('runEnd', { score: S.score, distance: Math.floor(S.distance) });
  lastRun = { score: S.score, best: newBest, banished: S.banished, combo: S.maxCombo, distance: Math.floor(S.distance), rank: run.rank };
  ui.show('ov-over');
  sfx.over();
  $('btn-retry').focus();
}
