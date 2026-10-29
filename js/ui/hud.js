// hud.js — the bar over the game: hearts, combo, score, distance and the best score.
// (The rank chip is in ranks.js.)
import { t } from '../core/i18n.js';
import { $, restartAnimation } from '../core/dom.js';

const HEART_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 '
  + '6.7 4.5c2.1 0 3.6 1.2 5.3 3.1 1.7-1.9 3.2-3.1 5.3-3.1 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>';

export function setHearts(n, max) {
  const box = $('hearts');
  if (box.children.length !== max) {
    box.innerHTML = '';
    for (let i = 0; i < max; i++) {
      const heart = document.createElement('span');
      heart.className = 'heart';
      heart.innerHTML = HEART_SVG;
      box.appendChild(heart);
    }
  }
  [...box.children].forEach((heart, i) => {
    const wasFull = !heart.classList.contains('lost');
    const isFull = i < n;
    heart.classList.toggle('lost', !isFull);
    // lost or won back: the heart pops
    if (wasFull !== isFull) restartAnimation(heart, 'pop');
  });
  box.setAttribute('aria-label', `${n}/${max}`);
}

let shownScore = 0;
export function setScore(n) {
  const el = $('score');
  el.textContent = n.toLocaleString();
  // points coming in: the counter jumps and flashes gold
  if (n > shownScore) restartAnimation(el, 'bump');
  shownScore = n;
}

export function setDistance(metres) {
  $('dist').textContent = Math.floor(metres).toLocaleString();
}

export function setBest(n) {
  $('best').textContent = n.toLocaleString();
  if (n) {
    $('title-best').textContent = `${t('best')} ${n.toLocaleString()}`;
  } else {
    $('title-best').textContent = t('noBest');
  }
  // no record yet: the tile stays, but there's nothing to share
  $('btn-share-best').disabled = !n;
}

export function setCombo(n) {
  const el = $('combo');
  if (n < 2) {
    el.classList.remove('show');
    return;
  }
  el.innerHTML = `<b>×${n}</b> ${t('combo')}`;
  el.classList.add('show');
  restartAnimation(el, 'bump');
}
