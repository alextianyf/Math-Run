// flow.js — the life of a run: start (with or without the tutorial, or the daily
// challenge), pause and resume, the game-over card, and back to the title.
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
import { on, emit } from './events.js';
import { DAILY_COUNT, MAX_SCORE, todayKey, dayNumber, dailyResult, saveDaily, dailyStreak, solvedCount, shareText } from './daily.js';
import { startDaily, stopDaily, dailyScore } from './dailyRun.js';
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
  if (S.daily) stopDaily();
  S.daily = null;
  S.slowT = 0;
  coach.show(false);
}

// retry = "Run again" from the game-over card: skips the tutorial and the long intro,
// and repeats the same kind of run. Every Start from the title plays the tutorial;
// the daily challenge never does.
let lastDaily = false;
export function startGame(retry = false, daily = retry && lastDaily) {
  if (!aiInfo.ready) return;
  initAudio();
  sfx.click();
  const fromOver = retry && S.mode === 'over';
  resetRun();
  lastDaily = daily;
  if (daily) startDaily();
  world.setTheme(daily ? 'bloodMoon' : 'night');
  ui.show('ov-title', false);
  ui.show('ov-over', false);
  ui.show('ov-pause', false);
  document.body.classList.add('in-game');
  world.setCameraMode('play', fromOver);
  S.mode = 'intro';
  S.introT = fromOver ? 0.9 : 0;
  pad.setEnabled(false);
  startMusic();
  if (!retry && !daily) startTutorial();
}

// the last yokai of the day is gone: the result card
on('dailyFinished', () => {
  if (!S.daily || S.mode !== 'playing') return;
  stopMusic();
  pad.setEnabled(false);
  showGameOver();
});

// the title's daily button: today's number, and whether it's been played
export function refreshDailyButton() {
  const key = todayKey();
  const result = dailyResult(key);
  const streak = dailyStreak(key);
  $('daily-status').textContent = [result ? ui.t('dailyDone', { s: (result.score ?? 0).toLocaleString('en') }) : ui.t('dailyNew'), streak ? ui.t('dailyStreak', { n: streak }) : '']
    .filter(Boolean).join(' · ');
  $('daily-label').textContent = result ? `${ui.t('daily', { n: dayNumber(key) })} · ${ui.t('dailyReplayShort')}` : ui.t('daily', { n: dayNumber(key) });
}

// copy the result card (or hand it to the phone's share sheet)
export async function shareDaily() {
  const d = lastResult;
  if (!d) return;
  const text = shareText(d.key, d.result);
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); ui.padToast(ui.t('shared')); $('btn-share').textContent = ui.t('shared'); }
  } catch { /* the player closed the share sheet */ }
}
let lastResult = null;

function showDailyResult() {
  const d = S.daily;
  const result = { score: dailyScore(), outcomes: d.outcomes };
  const first = saveDaily(d.key, result);
  lastResult = { key: d.key, result };
  const solved = solvedCount(result);
  $('over-title').textContent = ui.t(solved === DAILY_COUNT ? 'dailyCleared' : 'dailyCaught');
  $('over-score').innerHTML = `${result.score.toLocaleString('en')}<small>${ui.t('dailyOf', { m: MAX_SCORE.toLocaleString('en'), s: solved, n: DAILY_COUNT })}</small>`;
  $('daily-title').textContent = ui.t('daily', { n: dayNumber(d.key) });
  const streak = dailyStreak(d.key);
  emit('dailyDone', { solved, total: DAILY_COUNT, streak });
  $('daily-streak').textContent = streak ? ui.t('dailyStreak', { n: streak }) : '';
  $('daily-grid').innerHTML = result.outcomes.map((o) => `<i class="${o?.mark ?? 'none'}"></i>`).join('');
  $('daily-note').textContent = ui.t(first ? 'dailyFirst' : 'dailyReplay');
  $('btn-share').textContent = ui.t('share');
  refreshDailyButton();
}

// the intro camera move has landed: the run is on
export function beginPlay() {
  S.mode = 'playing';
  if (S.tut || S.daily) return;          // the tutorial and the daily challenge run the pad themselves
  pad.setEnabled(true);
  ui.banner(ui.t('go'), 'go');
}

export function pause() {
  if (S.mode !== 'playing') return;
  S.mode = 'paused';
  document.body.classList.add('paused');
  pad.setEnabled(false);
  stopMusic();
  $('pause-note').hidden = !S.daily;
  $('pause-note').textContent = ui.t('dailyPauseNote');
  ui.show('ov-pause');
  $('btn-resume').focus();
}

export function resume() {
  if (S.mode !== 'paused') return;
  ui.show('ov-pause', false);
  document.body.classList.remove('paused');
  S.mode = 'playing';
  if (S.daily ? S.daily.stage === 'asking' : S.cooldown <= 0 && (!S.tut || S.tut.step === 'write')) pad.setEnabled(true);
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
  world.setTheme('night');
  world.setCameraMode('title');
  S.mode = 'title';
}

// "Run again" on the daily's card: the first click only explains, the second starts
let retryArmed = false;
export function retryRun() {
  if (S.daily && !retryArmed) {
    retryArmed = true;
    $('retry-note').textContent = ui.t('dailyRetryNote');
    $('retry-note').hidden = false;
    $('btn-retry').textContent = ui.t('dailyRetryGo');
    return;
  }
  startGame(true);
}

export function showGameOver() {
  S.mode = 'over';
  const newBest = saveBest();
  $('over-title').textContent = ui.t('overTitle');
  $('over-score').textContent = S.score.toLocaleString();
  $('over-newbest').hidden = !newBest;
  // the daily challenge shows its squares instead of the run's stats, and sharing
  // is the main button there — a replay doesn't count, so Run again asks first
  $('daily-result').hidden = !S.daily;
  document.querySelector('#ov-over .stats').hidden = !!S.daily;
  $('btn-share').className = S.daily ? 'btn primary' : 'btn small ghost';
  $('btn-retry').className = S.daily ? 'btn ghost' : 'btn primary';
  $('btn-retry').textContent = ui.t(S.daily ? 'dailyRetry' : 'retry');
  $('retry-note').hidden = true;
  retryArmed = false;
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
  if (S.daily) showDailyResult();
  ui.show('ov-over');
  sfx.over();
  $('btn-retry').focus();
}
