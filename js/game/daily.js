// daily.js — the rules of the daily challenge: the same 10 problems for everyone on a
// given day, built from the date, easy to hard, each carried by a different yokai;
// each worth more than the last, and worth less the longer you take. Also keeps each day's first result (saved in this
// browser), the streak of days played, and the shareable result card.
// (dailyRun.js plays it.)
import { makeProblem, withRandom } from '../difficulty/problems.js';
import { RANKS } from '../difficulty/adaptive.js';
import { store } from '../ui/ui.js';

export const DAILY_COUNT = 10;
export const FULL_TIME = 5;                    // answered within this many seconds: full points
export const SLOW_TIME = 35;                   // by now the points are down to…
export const SLOW_SHARE = 0.3;                 // …this share, and stay there
const FIRST_DAY = Date.UTC(2026, 9, 25);       // Daily #1
const KEEP_DAYS = 400;                         // results older than this are dropped

// "2026-10-26" for the player's own calendar day
export function todayKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
const dayIndex = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - FIRST_DAY) / 86400000);
};
export const dayNumber = (key) => dayIndex(key) + 1;

// a small seeded random generator (mulberry32) and a string hash (FNV-1a)
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

// Problem by problem: the yokai that carries it, and what it may use
//   1–3 (+ −) · 4–6 (× ÷) · 7–9 (brackets, squares, roots) · 10 the oni (anything)
const ORDER = ['onibi', 'hitotsume', 'chochin', 'kappa', 'kitsunebi', 'kasa', 'ittan', 'hyakume', 'nekomata', 'oni'];
const ALLOW = (index) => (index < 3 ? RANKS[0] : index < 6 ? RANKS[1] : index < DAILY_COUNT - 1 ? RANKS[3] : RANKS[4]).allow;

// The day's problems: difficulty climbs from about 520 to 1420. Problem n is worth n × 100.
export function dailyProblems(key = todayKey()) {
  const rng = seeded(hash(`mathrun-daily:${key}`));
  return withRandom(rng, () => {
    const seen = new Set();
    return Array.from({ length: DAILY_COUNT }, (_, index) => {
      const answer = Math.floor(rng() * 10);
      const problem = makeProblem(520 + (index / (DAILY_COUNT - 1)) * 900, { answer, avoid: seen, allow: ALLOW(index) });
      seen.add(problem.text);
      return Object.assign(problem, { index, type: ORDER[index], worth: (index + 1) * 100 });
    });
  });
}
export const MAX_SCORE = ((DAILY_COUNT * (DAILY_COUNT + 1)) / 2) * 100;

// share of the points still on offer after `seconds`
export function timeShare(seconds) {
  if (seconds <= FULL_TIME) return 1;
  return Math.max(SLOW_SHARE, 1 - ((seconds - FULL_TIME) / (SLOW_TIME - FULL_TIME)) * (1 - SLOW_SHARE));
}
// points for answering `problem` right after `seconds`, rounded to tens
export const pointsFor = (problem, seconds) => Math.round((problem.worth * timeShare(seconds)) / 10) * 10;

/* ---------- results ---------- */
// result: { score, outcomes } — one outcome per problem: { mark, points }, where mark is
// 'full' (right, in time for full points), 'slow' (right, but slower) or 'wrong'
const results = () => store.get('daily', {});
export const dailyResult = (key = todayKey()) => results()[key] ?? null;

// only the first attempt of a day counts; returns true if this one was it
export function saveDaily(key, result) {
  const all = results();
  if (all[key]) return false;
  all[key] = result;
  for (const k of Object.keys(all)) if (dayIndex(key) - dayIndex(k) > KEEP_DAYS) delete all[k];
  store.set('daily', all);
  return true;
}

// days in a row with a result, counting back from today (or yesterday, if today
// hasn't been played yet — the streak isn't broken until the day is over)
export function dailyStreak(key = todayKey()) {
  const all = results();
  let day = dayIndex(key);
  if (!Object.keys(all).some((k) => dayIndex(k) === day)) day--;
  const played = new Set(Object.keys(all).map(dayIndex));
  let streak = 0;
  while (played.has(day - streak)) streak++;
  return streak;
}

export const solvedCount = (result) => result.outcomes.filter((o) => o && o.mark !== 'wrong').length;
const SQUARE = { full: '🟩', slow: '🟨', wrong: '🟥' };

// Wordle-style card: one square per problem, rows of five
export function shareText(key, result) {
  const squares = result.outcomes.map((o) => SQUARE[o?.mark] ?? '⬛');
  const rows = [];
  for (let i = 0; i < squares.length; i += 5) rows.push(squares.slice(i, i + 5).join(''));
  return [
    `百鬼夜行 · Math Run — Daily #${dayNumber(key)}`,
    `${result.score.toLocaleString('en')} / ${MAX_SCORE.toLocaleString('en')}`,
    ...rows,
    'https://alextianyf.github.io/Math-Run/',
  ].join('\n');
}
