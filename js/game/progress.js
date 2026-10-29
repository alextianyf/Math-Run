// progress.js — keeping score: points, hearts, the rating and the
// rank (via the director), and the saved records.
import { RANKS } from '../difficulty/adaptive.js';
import { sfx, setTempo } from '../ui/audio.js';
import * as ui from '../ui/ui.js';
import { S, MAX_HEARTS } from '../core/state.js';
import { director } from './stage.js';
import { emit } from '../core/events.js';
import { t } from '../core/i18n.js';
import { store } from '../core/store.js';

const HEAL_STREAK = 8;        // this many right in a row wins a heart back

export function addScore(n) {
  S.score += n;
  ui.setScore(S.score);
  if (!S.tut) emit('score', { score: S.score });
}

// HUD rank: seal and title, the bar toward the next trial, and what it's doing
export function showRank() {
  const trial = S.pendingBoss || S.enemies.some((e) => e.boss && !e.dying);
  const state = director.rank >= RANKS.length - 1 ? 'top' : trial ? 'trial' : director.progress >= 0.8 ? 'near' : '';
  ui.setRank(director.rank, director.progress, state);
}

// One problem's outcome → the director (it moves the rating). A rank trial is
// queued when the rating earns one, and a long run of right answers wins a heart.
export function record(e, correct) {
  if (S.tut) return;
  const out = director.record(e.problem, { correct, time: e.age - e.qStart, travel: e.qTravel });
  if (!out) return;                                   // already answered once
  if (out.trial && !S.pendingBoss && !S.enemies.some((o) => o.boss && !o.dying)) S.pendingBoss = true;
  showRank();
  if (correct && out.streak % HEAL_STREAK === 0) heal(true);
}

export function heal(announce) {
  if (S.hearts >= MAX_HEARTS) return;
  S.hearts++;
  ui.setHearts(S.hearts, MAX_HEARTS);
  sfx.heal();
  if (announce) ui.banner(t('heal'), 'heal', 1);
}

export function advance(kills) {
  S.banished += kills;
}

// the rank trial was passed: promotion, a heart back, and maybe a new best rank
export function promote() {
  director.promote();
  emit('promote', { rank: director.rank });
  setTempo(director.tempo());
  ui.promoBanner(director.rank);
  sfx.wave();
  heal(false);
  S.trialHold = 2.6;                      // let the promotion sink in before any next trial
  if (director.rank > S.bestRank) {
    S.bestRank = director.rank;
    store.set('bestRank', S.bestRank);
    ui.setBestRank(S.bestRank);
  }
}

// A run's score counts as a record however the run ends: caught, quit from the
// pause menu, or the page closed mid-run (the tutorial's practice points never count).
export function saveBest() {
  if (S.tut || S.score <= S.best) return false;
  S.best = S.score;
  store.set('best', S.best);
  // the record run's details, for sharing it from the title screen
  store.set('bestRun', { score: S.score, banished: S.banished, combo: S.maxCombo, distance: Math.floor(S.distance), rank: director.rank });
  ui.setBest(S.best);
  return true;
}
