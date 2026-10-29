// hints.js — the first few times a yokai with a trick appears, a small card says what
// to watch for: once per run per trick, and only in a player's first HINT_RUNS runs with it.
import { YOKAI_LOOK } from './yokaiInfo.js';
import { $, restartAnimation } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { store } from '../core/store.js';

const HINT_RUNS = 3;
const HINT_MS = 4200;
const hinted = new Set();
let hintTimer = 0;

export function yokaiHint(type, trait) {
  if (hinted.has(trait)) return;
  const seen = store.get('hints', {});
  if ((seen[trait] ?? 0) >= HINT_RUNS || !$('hint').hidden) return;
  hinted.add(trait);
  seen[trait] = (seen[trait] ?? 0) + 1;
  store.set('hints', seen);
  const [seal, color] = YOKAI_LOOK[type];
  $('hint-seal').textContent = seal;
  $('hint-seal').parentElement.style.background = color;
  $('hint-title').textContent = t('hintLook', { y: t(`y_${type}`) });
  $('hint-text').textContent = t(`tip_${trait}`);
  const el = $('hint');
  el.hidden = false;
  restartAnimation(el, 'show');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { el.hidden = true; }, HINT_MS);
}

export function resetHints() {
  hinted.clear();
}
