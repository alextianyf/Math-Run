// adaptive.js — the director. Models the player with an Elo-style rating and decides
// what to send down the shrine path next.
//
//  • Difficulty: every problem carries a difficulty D on the rating scale
//    (problems.js). After each outcome the rating moves by K·(S − E), with the
//    expected score E = 1 / (1 + 10^((D − R) / 400)). Problems are chosen so the
//    player is expected to get ~85% right: hard enough to stretch, easy enough to flow
//    (the "85% rule" for learning, Wilson et al. 2019, Nature Communications).
//    A right answer scores S = 1 however late it comes (handwriting takes its own
//    time), a wrong digit or a yokai that reaches the hero S = 0. Only the first
//    attempt at a problem counts. Steps are large early in a run, on a hot streak
//    and for a quick answer.
//  • Smooth ramp: the rating may move fast, but problems are pitched at a level that
//    follows it at most RAMP_UP per problem, so difficulty climbs gently.
//  • Rhythm: after 3 right in a row comes a stretch problem a little higher; after
//    2 wrong in a row the next problems drop a notch until one is solved.
//  • Pace (separate knob): how fast and how many yokai come. It tightens slowly while
//    the player keeps up and eases off after a hit, but never asks for answers faster
//    than the player can physically write them: the time from pen down to the model's
//    reading is measured, and yokai are spaced at least that far apart (plus a breath).
//    Travel time also grows with how long a problem takes to think through, so a
//    √(…) gets more road than a 3 + 4.
//  • Ranks: Onmyōryō titles. The rating measures, the rank is earned: when the
//    rating reaches the next title a rank trial (a boss) is due, and beating it
//    promotes the player. Within a run a rank is never taken away. Each rank
//    unlocks new kinds of problems, and the first few after a promotion show
//    the new kind off.
//  • Every run starts fresh: lowest rank, starting rating. Nothing is saved.
import { makeProblem, BASIC, ALL } from './problems.js';

// allow: what the generator may use at this rank · unlock: what this rank adds
export const RANKS = [
  { key: 'rank0', min: 0, allow: { ops: ['+', '−'], steps: 2, brackets: false } },                // 阴阳生
  { key: 'rank1', min: 850, allow: { ops: BASIC, steps: 2, brackets: false }, unlock: ['×', '÷'] },   // 阴阳师
  { key: 'rank2', min: 1000, allow: { ops: BASIC, steps: 3, brackets: true }, unlock: ['()'] },       // 阴阳博士
  { key: 'rank3', min: 1150, allow: { ops: [...BASIC, 'sq', 'sqrt'], steps: 4, brackets: true }, unlock: ['sq', 'sqrt'] },   // 阴阳头
  { key: 'rank4', min: 1350, allow: { ops: ALL, steps: 5, brackets: true }, unlock: ['cube', 'cbrt', 'pow'] },              // 晴明
];

const START = 700;                                   // a brand-new player
const TARGET_SUCCESS = 0.85;
const AIM = 400 * Math.log10(1 / TARGET_SUCCESS - 1);   // ≈ −300: aim below the rating
const STRETCH = 60, EASE = 150;                      // a little up / a notch down on the rating scale
const TRIAL = 130;                                   // a rank trial sits this far above normal
const STRETCH_EVERY = 3, EASE_AFTER = 2;             // right in a row → stretch; wrong in a row → ease
const RAMP_UP = 25, RAMP_DOWN = 60;                  // how far the problem level may move per problem
const SHOW_OFF = 3;                                  // problems after a promotion that feature the unlock
const SPREAD = 50;                                   // random spread around the aimed difficulty
const WRITE_TIME = 3.5;                              // s to write a digit and let it be read (a first guess)
const PACE_EASY = 1.6, PACE_HARD = 1.0;              // multiplier on travel time
const PACE_STEP = 0.02;                              // tightening per right answer
const BREATH = 2.0;                                  // s of slack between yokai on top of one written answer

const rankOf = (r) => RANKS.reduce((best, rk, i) => (r >= rk.min ? i : best), 0);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function createDirector() {
  let rating = START, pace = 1.45, rank = 0, answered = 0, peak = START;
  let served = START;                                // the level problems are pitched at: trails the rating
  let fresh = 0;                                     // problems left that should feature the newest unlock
  let writeTime = WRITE_TIME;                        // measured s per written answer; a habit, kept across runs
  let streak = 0, fails = 0, sinceStretch = 0;         // right in a row, wrong in a row, right since the last stretch
  let history = [];
  const recent = [];                                 // recently used texts, never repeated

  const expected = (d) => 1 / (1 + 10 ** ((d - rating) / 400));
  const level = () => clamp((PACE_EASY - pace) / (PACE_EASY - PACE_HARD), 0, 1);   // 0 relaxed → 1 frantic

  function remember(text) {
    recent.push(text);
    if (recent.length > 160) recent.shift();
  }

  return {
    get rating() { return Math.round(rating); },
    get rank() { return rank; },
    get rankKey() { return RANKS[rank].key; },
    get streak() { return streak; },
    // how far toward the next rank trial, 0–1 (1 at the top rank)
    get progress() {
      if (rank >= RANKS.length - 1) return 1;
      const lo = rank ? RANKS[rank].min : START;
      return clamp((rating - lo) / (RANKS[rank + 1].min - lo), 0, 1);
    },

    startRun() {
      rating = peak = served = START;
      rank = fresh = 0;
      pace = 1.45;
      answered = streak = fails = sinceStretch = 0;
      history = [rating];
    },

    // boss: a rank trial, pitched above the player's comfort zone.
    // The problem comes back flagged .stretch (a notch up) or .eased (a notch down).
    nextProblem({ answer, avoid = new Set(), boss = false } = {}) {
      const stretch = !boss && sinceStretch >= STRETCH_EVERY;
      const eased = !boss && !stretch && fails >= EASE_AFTER;
      if (stretch) sinceStretch = 0;
      const offset = boss ? TRIAL : stretch ? STRETCH : eased ? -EASE : 0;
      const target = served + AIM + offset + (Math.random() - 0.5) * SPREAD;
      const feature = !boss && fresh > 0 ? RANKS[rank].unlock : null;
      if (feature) fresh--;
      const p = makeProblem(target, { answer, avoid: new Set([...avoid, ...recent]), allow: RANKS[rank].allow, feature });
      remember(p.text);
      return Object.assign(p, { stretch, eased });
    },

    // seconds a yokai carrying problem p takes to reach the hero
    travelTime(p) {
      const think = 2 + Math.max(0, p.difficulty - 450) / 110;
      return (think + Math.max(WRITE_TIME, writeTime)) * pace;
    },
    // never faster than one written answer apart, plus a breath
    spawnInterval() { return Math.max(writeTime + BREATH, 5.2 - 1.6 * level()); },
    maxAlive() { return 1 + Math.min(2, Math.floor(level() * 2.6)); },
    // seconds from pen down to the model's reading, for one answer
    noteWrite(s) { writeTime += 0.3 * (clamp(s, 1.5, 10) - writeTime); },
    runSpeed() { return 7 + 4 * level(); },
    tempo() { return rank * 2 + Math.round(level() * 6); },

    // outcome of a problem's first attempt (later ones return null):
    // { trial: a rank trial is now due, streak: right answers in a row }
    record(p, { correct, time = 0, travel = 1 }) {
      if (!p?.difficulty || p.scored) return null;
      p.scored = true;
      const S = correct ? 1 : 0;
      streak = correct ? streak + 1 : 0;
      fails = correct ? 0 : fails + 1;
      sinceStretch = correct ? sinceStretch + 1 : 0;
      // big steps while the run is young, then finer; a hot streak or a quick answer climbs faster
      const quick = correct && time < travel * 0.5;
      const K = (answered < 10 ? 90 : 40) * (streak >= 3 ? 1.5 : 1) * (quick ? 1.25 : 1);
      rating = Math.max(START - 100, rating + K * (S - expected(p.difficulty)));
      answered++;
      peak = Math.max(peak, rating);
      served += clamp(rating - served, -RAMP_DOWN, RAMP_UP);   // climb gently, back off quicker
      history.push(rating);
      pace = correct ? Math.max(PACE_HARD, pace - PACE_STEP) : pace;
      return { trial: rankOf(rating) > rank, streak };
    },
    // a yokai got through: ease off
    hit() { pace = Math.min(PACE_EASY, pace + 0.22); },
    // the trial boss was beaten: the new rank holds for the rest of the run
    promote() {
      rank = Math.min(RANKS.length - 1, rank + 1);
      fresh = SHOW_OFF;
    },

    endRun() {
      return { rating: Math.round(rating), start: START, peak: Math.round(peak), rank, history: [...history] };
    },
  };
}
