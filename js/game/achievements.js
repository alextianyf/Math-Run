// achievements.js — achievements and the yokai bestiary. Everything is saved in this
// browser (a static site has no accounts); collection.js can move it to another
// device with a transfer code. It only listens to game events (events.js).
import { store } from '../ui/ui.js';
import { on } from './events.js';
import { YOKAI_TYPES } from '../scene/yokai.js';

export { YOKAI_TYPES };

// id → when it's earned. `goal` is shown as progress for the counting ones.
export const ACHIEVEMENTS = [
  { id: 'firstBanish', icon: '符' },
  { id: 'double', icon: '双' },
  { id: 'triple', icon: '三' },
  { id: 'combo10', icon: '十' },
  { id: 'combo25', icon: '廿' },
  { id: 'score10k', icon: '万' },
  { id: 'score30k', icon: '极' },
  { id: 'rank1', icon: '师' },
  { id: 'rank2', icon: '博' },
  { id: 'rank3', icon: '头' },
  { id: 'rank4', icon: '明' },
  { id: 'hundred', icon: '百', goal: 100 },
  { id: 'thousand', icon: '千', goal: 1000 },
  { id: 'run1k', icon: '里' },
  { id: 'runs10', icon: '局', goal: 10 },
  { id: 'bestiary', icon: '鉴', goal: YOKAI_TYPES.length },
];

// saved as { earned: { id: time }, seen: { type: time }, banished: n, runs: n }
const load = () => ({ earned: {}, seen: {}, banished: 0, runs: 0, ...store.get('collection', {}) });
let data = load();
const save = () => store.set('collection', data);

let announce = () => {};           // set by main.js: shows the "achievement unlocked" toast
export function onUnlock(show) { announce = show; }

function earn(id) {
  if (data.earned[id]) return;
  data.earned[id] = Date.now();
  save();
  announce(ACHIEVEMENTS.find((a) => a.id === id));
}

export const collection = () => data;
export const reloadCollection = () => { data = load(); };   // after a transfer code was applied
export function progressOf(achievement) {
  if (achievement.id === 'hundred' || achievement.id === 'thousand') return data.banished;
  if (achievement.id === 'bestiary') return Object.keys(data.seen).length;
  if (achievement.id === 'runs10') return data.runs;
  return null;
}

/* ---------- what earns them ---------- */
on('meet', ({ type }) => {
  if (data.seen[type]) return;
  data.seen[type] = Date.now();
  save();
  if (YOKAI_TYPES.every((t) => data.seen[t])) earn('bestiary');
});
on('banish', ({ combo }) => {
  data.banished++;
  save();
  earn('firstBanish');
  if (data.banished >= 100) earn('hundred');
  if (data.banished >= 1000) earn('thousand');
  if (combo >= 10) earn('combo10');
  if (combo >= 25) earn('combo25');
});
on('cast', ({ victims }) => {
  if (victims >= 2) earn('double');
  if (victims >= 3) earn('triple');
});
on('score', ({ score }) => {
  if (score >= 10000) earn('score10k');
  if (score >= 30000) earn('score30k');
});
on('promote', ({ rank }) => { for (let r = 1; r <= rank; r++) earn(`rank${r}`); });
on('runEnd', ({ distance }) => {
  data.runs++;
  save();
  if (distance >= 1000) earn('run1k');
  if (data.runs >= 10) earn('runs10');
});
