// popups.js — what flashes up over the game for a moment: score pops, banners,
// the achievement toast and the screen flashes for a kill or a hit.
import { t } from '../core/i18n.js';
import { $, restartAnimation } from '../core/dom.js';
import { rankSeal } from './ranks.js';

// "+120" floating up from where a yokai was banished
export function popup(text, x, y, cls = '') {
  const el = document.createElement('div');
  el.className = 'popup ' + cls;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  $('popups').appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

/* ---------- banners ---------- */
let bannerTimer = 0;
let bannerLevel = 0;
let bannerNext = null;

// level: a banner never cuts off a more important one still on screen
// (2 promotion / rank trial / finisher · 1 heal / night / skill · 0 the rest); a level-1 banner
// waits its turn, a passing one (multi-kill) is simply dropped.
// html: markup we build ourselves (never user text); ms: how long it stays
export function banner(text, cls = '', level = 0, { html = null, ms = 1500 } = {}) {
  if (level < bannerLevel) {
    if (level >= 1) bannerNext = [text, cls, level, { html, ms }];
    return;
  }
  const el = $('banner');
  bannerLevel = level;
  el.className = 'banner ' + cls;
  if (html) {
    el.innerHTML = html;
  } else {
    el.textContent = text;
  }
  el.style.animationDuration = `${ms}ms`;
  restartAnimation(el, 'show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => {
    el.classList.remove('show');
    bannerLevel = 0;
    const next = bannerNext;
    bannerNext = null;
    if (next) banner(...next);
  }, ms);
}

// promotion: the new rank's seal stamps down, with what the rank unlocks
export function promoBanner(i) {
  const title = t('promoted', { r: t(`rank${i}`) });
  const html = `<span class="stamp"><b>${rankSeal(i)}</b></span>`
    + `<span class="promo-text"><span class="promo-title">${title}</span>`
    + `<span class="promo-sub">${t(`unlock${i}`)}</span></span>`;
  banner('', 'promo', 2, { html, ms: 2600 });
}

/* ---------- achievement toast ---------- */
// "Achievement unlocked": a small card at the top; several in a row wait their turn
const toasts = [];
let toastHome = null;

function nextToast() {
  const el = $('achievement-toast');
  toastHome ??= el.parentNode;
  if (el.classList.contains('show') || !toasts.length) return;
  const [icon, label, name] = toasts.shift();
  // mid-run it sits in the stage, under the equations (styles.css #labels); otherwise over everything
  const host = document.body.classList.contains('in-game') ? $('stage') : toastHome;
  if (el.parentNode !== host) host.appendChild(el);
  el.innerHTML = `<span class="stamp"><b>${icon}</b></span><span><small>${label}</small><b>${name}</b></span>`;
  el.classList.add('show');
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(nextToast, 400);
  }, 2600);
}

export function achievementToast(icon, label, name) {
  toasts.push([icon, label, name]);
  nextToast();
}

/* ---------- screen flashes ---------- */
// a kill: a quick warm flash over the whole screen
export function killFlash() {
  restartAnimation($('vignette'), 'zap');
}

// a hit: red at the edges
export function damageFlash() {
  restartAnimation($('vignette'), 'hit');
}
