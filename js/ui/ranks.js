// ranks.js — the five ranks as seals: the chip in the HUD, the ladder on the title
// and game-over screens, and the rating curve on the game-over card.
import { t } from '../core/i18n.js';
import { $ } from '../core/dom.js';

// one seal character per rank: 阴阳生 · 阴阳师 · 阴阳博士 · 阴阳头 · 晴明
const SEALS = ['生', '师', '博', '头', '明'];

export function rankSeal(i) {
  return SEALS[i] ?? SEALS[0];
}

const HINTS = { near: 'nearTrial', trial: 'inTrial' };

// HUD: the rank's seal and title, a thin bar toward the next trial (no numbers;
// the rating waits for the game-over card) and a hint.
// state: '' · 'near' (trial soon) · 'trial' (under way) · 'top' (nothing above)
export function setRank(i, progress = 0, state = '') {
  $('rank-seal').textContent = SEALS[i];
  $('rank-name').textContent = t(`rank${i}`);
  $('rank-fill').style.width = `${Math.round(progress * 100)}%`;
  $('rank-hint').textContent = HINTS[state] ? t(HINTS[state]) : '';
  const chip = $('rank-chip');
  for (const s of ['near', 'trial', 'top']) chip.classList.toggle(s, state === s);
}

function sealState(i, reached) {
  if (i < reached) return 'lit';
  if (i === reached) return 'lit cur';
  if (i === reached + 1) return 'next';
  return 'locked';
}

// The five ranks as seals: lit up to `reached`, the next one filling up with
// `progress`, and anything past `known` hidden as ？ — the next goal is always shown.
export function renderLadder(el, { reached, progress = 0, known = reached + 1, labels = true }) {
  const items = SEALS.map((seal, i) => {
    const shown = i <= known;
    const name = shown ? t(`rank${i}`) : '？？？';
    let fill = '';
    if (i === reached + 1) fill = `<i style="height:${Math.round(progress * 100)}%"></i>`;
    const label = labels ? `<small>${name}</small>` : '';
    return `<li class="${sealState(i, reached)}" title="${name}">`
      + `<span class="stamp">${fill}<b>${shown ? seal : '？'}</b></span>${label}</li>`;
  });
  el.innerHTML = items.join('');
}

// title screen: the best rank ever reached (a record only; every run starts at the bottom)
export function setBestRank(i) {
  renderLadder($('title-ladder'), { reached: i, labels: false });
}

// rating over the run as a small area chart on the game-over card
export function setRankCurve(history) {
  const svg = $('st-curve');
  if (history.length < 2) {
    svg.style.display = 'none';
    return;
  }
  svg.style.display = '';
  const lo = Math.min(...history) - 20;
  const hi = Math.max(...history) + 20;
  const points = history.map((rating, i) => {
    const x = (i / (history.length - 1)) * 200;
    const y = 42 - ((rating - lo) / (hi - lo)) * 38;
    return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const line = points.join('');
  svg.querySelector('.line').setAttribute('d', line);
  svg.querySelector('.area').setAttribute('d', `${line}L200 44L0 44Z`);
}
