// tags.js — the equation plaques that hang over each yokai (enemies.js moves them).
import { t } from '../core/i18n.js';
import { $, restartAnimation } from '../core/dom.js';

// Unicode superscripts (2⁶) are tiny at a distance: render exponents as real <sup>
const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
// and the font's ÷ reads as + once it's small: draw it with big dots well clear of the bar
const DIV = '<span class="op-div" role="img" aria-label="÷"><svg viewBox="0 0 12 13" aria-hidden="true">'
  + '<rect x="0" y="5.4" width="12" height="2.2" rx="1.1"/>'
  + '<circle cx="6" cy="1.9" r="1.9"/><circle cx="6" cy="11.1" r="1.9"/></svg></span>';
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

function superscript(digits) {
  const plain = [...digits].map((c) => SUPS.indexOf(c)).join('');
  return `<sup>${plain}</sup>`;
}

function setEquation(el, text) {
  const safe = text.replace(/[&<>]/g, (c) => ESCAPES[c]);
  el.innerHTML = safe.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, superscript).replace(/÷/g, DIV);
}

// stretch: a problem a notch above the player's level, marked with a small badge;
// trait: what this yokai does (yokaiInfo.js TRAITS), as a badge of its own
export function createTag(text, { boss = false, hp = 0, stretch = false, trait = null } = {}) {
  const el = document.createElement('div');
  el.className = 'tag';
  if (boss) el.classList.add('boss');
  if (stretch) el.classList.add('stretch');

  let inner = '<span class="eq"></span>';
  if (hp > 1) inner += '<span class="hp"></span>';
  if (stretch) inner += `<span class="badge">${t('stretch')}</span>`;
  if (trait) inner += `<span class="badge trait">${trait}</span>`;
  el.innerHTML = `<div class="tag-in">${inner}</div>`;

  setEquation(el.querySelector('.eq'), text);
  if (hp > 1) setTagHp(el, 0, hp);
  $('labels').appendChild(el);
  return el;
}

export function setTagText(el, text) {
  setEquation(el.querySelector('.eq'), text);
  restartAnimation(el, 'swap');
}

// a boss's hits: one dot per hit needed, the ones done greyed out
export function setTagHp(el, done, total) {
  const hp = el.querySelector('.hp');
  if (!hp) return;
  let dots = '';
  for (let i = 0; i < total; i++) {
    dots += i < done ? '<i class="gone"></i>' : '<i class=""></i>';
  }
  hp.innerHTML = dots;
}

export function placeTag(el, x, y, scale, opacity, urgent) {
  el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%) scale(${scale.toFixed(3)})`;
  el.style.opacity = opacity.toFixed(2);
  el.classList.toggle('urgent', urgent);
}

export function setTagState(el, state) {
  el.classList.add(state);
}

export function removeTag(el, delay = 0) {
  if (delay) {
    setTimeout(() => el.remove(), delay);
  } else {
    el.remove();
  }
}

export function clearTags() {
  $('labels').innerHTML = '';
}
