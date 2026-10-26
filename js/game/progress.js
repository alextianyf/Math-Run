// progress.js — keeping score: points, hearts, "wave" beats, the rating and the
// rank (via the director), and the saved records.
import { RANKS } from '../difficulty/adaptive.js';
import { sfx, setTempo } from '../ui/audio.js';
import * as ui from '../ui/ui.js';
import { S, MAX_HEARTS } from './state.js';
import { director } from './stage.js';
import { emit } from './events.js';

const HEAL_STREAK = 8;        // this many right in a row wins a heart back
const KILLS_PER_WAVE = 6;     // a "wave" beat (banner + chime) every this many yokai banished

export function addScore(n) {
  S.score += n;
  ui.setScore(S.score);
  if (!S.tut && !S.daily) emit('score', { score: S.score });
}

// HUD rank: seal and title, the bar toward the next trial, and what it's doing
export function showRank() {
  if (S.daily) {                     // no ranks in the daily challenge: count its yokai
    ui.setDailyChip(S.daily.outcomes.filter(Boolean).length, S.daily.outcomes.length);
    return;
  }
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
  if (out.trial && !S.daily && !S.pendingBoss && !S.enemies.some((o) => o.boss && !o.dying)) S.pendingBoss = true;
  showRank();
  if (correct && out.streak % HEAL_STREAK === 0) heal(true);
}

export function heal(announce) {
  if (S.hearts >= MAX_HEARTS) return;
  S.hearts++;
  ui.setHearts(S.hearts, MAX_HEARTS);
  sfx.heal();
  if (announce) ui.banner(ui.t('heal'), 'heal', 1);
}

// every few yokai banished: a "wave" beat, a banner and a chime to mark progress
// (how hard and how fast is the director's business, not the wave's)
export function advance(kills) {
  S.banished += kills;
  const wave = 1 + Math.floor(S.banished / KILLS_PER_WAVE);
  if (wave > S.wave) {
    S.wave = wave;
    ui.banner(ui.t('wave', { n: wave }), 'wave', 1);
    sfx.wave();
  }
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
    ui.store.set('bestRank', S.bestRank);
    ui.setBestRank(S.bestRank);
  }
}

// A run's score counts as a record however the run ends: caught, quit from the
// pause menu, or the page closed mid-run (the tutorial's practice points and the
// daily challenge, which keeps its own record, never count).
export function saveBest() {
  if (S.tut || S.daily || S.score <= S.best) return false;    // the daily challenge has its own record
  S.best = S.score;
  ui.store.set('best', S.best);
  ui.setBest(S.best);
  return true;
}
