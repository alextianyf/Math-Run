// ui.js — everything on screen that isn't 3D: the HUD, the equation tags that
// follow the yokai, popups and banners, the "AI view" panel and the overlay
// screens — plus saved settings and the language switch (texts are in strings.js).
import { STRINGS } from './strings.js';

const $ = (id) => document.getElementById(id);

/* ===================== storage (never throws) ===================== */
export const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem('mathrun.' + key); return v === null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('mathrun.' + key, JSON.stringify(value)); } catch { /* private mode etc. */ }
  },
};

/* ===================== language ===================== */
let lang = store.get('lang', (navigator.language || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en');

export function t(key, vars = {}) {
  const s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}
export function getLang() { return lang; }
export function setLang(l) {
  lang = l;
  store.set('lang', l);
  applyI18n();
}
export function applyI18n() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-label]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nLabel)); });
}

/* ===================== HUD ===================== */
export function setHearts(n, max) {
  const box = $('hearts');
  if (box.children.length !== max) {
    box.innerHTML = '';
    for (let i = 0; i < max; i++) {
      const h = document.createElement('span');
      h.className = 'heart';
      h.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3.1 1.7-1.9 3.2-3.1 5.3-3.1 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>';
      box.appendChild(h);
    }
  }
  [...box.children].forEach((h, i) => {
    const was = !h.classList.contains('lost');
    h.classList.toggle('lost', i >= n);
    if (was !== i < n) { h.classList.remove('pop'); void h.offsetWidth; h.classList.add('pop'); }   // lost or won back
  });
  box.setAttribute('aria-label', `${n}/${max}`);
}
export function setScore(n) { $('score').textContent = n.toLocaleString(); }
export function setDistance(m) { $('dist').textContent = Math.floor(m).toLocaleString(); }
export function setBest(n) {
  $('best').textContent = n.toLocaleString();
  $('title-best').textContent = n ? `${t('best')} ${n.toLocaleString()}` : t('noBest');
  $('btn-share-best').disabled = !n;          // no record yet: the tile stays, but there's nothing to share
}
/* ===================== ranks ===================== */
// one seal character per rank: 阴阳生 · 阴阳师 · 阴阳博士 · 阴阳头 · 晴明
const SEALS = ['生', '师', '博', '头', '明'];
export const rankSeal = (i) => SEALS[i] ?? SEALS[0];

// HUD: the rank's seal and title, a thin bar toward the next trial (no numbers;
// the rating waits for the game-over card) and a hint.
// state: '' · 'near' (trial soon) · 'trial' (under way) · 'top' (nothing above)
export function setRank(i, progress = 0, state = '') {
  $('rank-seal').textContent = SEALS[i];
  $('rank-name').textContent = t(`rank${i}`);
  $('rank-fill').style.width = `${Math.round(progress * 100)}%`;
  $('rank-hint').textContent = state === 'near' ? t('nearTrial') : state === 'trial' ? t('inTrial') : '';
  const chip = $('rank-chip');
  for (const s of ['near', 'trial', 'top']) chip.classList.toggle(s, state === s);
}

// "Achievement unlocked": a small card at the top; several in a row wait their turn
const toasts = [];
function nextToast() {
  const el = $('achievement-toast');
  if (el.classList.contains('show') || !toasts.length) return;
  const [icon, label, name] = toasts.shift();
  el.innerHTML = `<span class="stamp"><b>${icon}</b></span><span><small>${label}</small><b>${name}</b></span>`;
  el.classList.add('show');
  setTimeout(() => { el.classList.remove('show'); setTimeout(nextToast, 400); }, 2600);
}
export function achievementToast(icon, label, name) {
  toasts.push([icon, label, name]);
  nextToast();
}


// The five ranks as seals: lit up to `reached`, the next one filling up with
// `progress`, and anything past `known` hidden as ？ — the next goal is always shown.
export function renderLadder(el, { reached, progress = 0, known = reached + 1, labels = true }) {
  el.innerHTML = SEALS.map((ch, i) => {
    const state = i < reached ? 'lit' : i === reached ? 'lit cur' : i === reached + 1 ? 'next' : 'locked';
    const shown = i <= known;
    const fill = i === reached + 1 ? `<i style="height:${Math.round(progress * 100)}%"></i>` : '';
    const name = shown ? t(`rank${i}`) : '？？？';
    return `<li class="${state}" title="${name}"><span class="stamp">${fill}<b>${shown ? ch : '？'}</b></span>${labels ? `<small>${name}</small>` : ''}</li>`;
  }).join('');
}
// title screen: the best rank ever reached (a record only; every run starts at the bottom)
export function setBestRank(i) {
  renderLadder($('title-ladder'), { reached: i, labels: false });
}

// rating over the run as a small area chart on the game-over card
export function setRankCurve(history) {
  const svg = $('st-curve');
  if (history.length < 2) { svg.style.display = 'none'; return; }
  svg.style.display = '';
  const lo = Math.min(...history) - 20, hi = Math.max(...history) + 20;
  const pts = history.map((v, i) => [(i / (history.length - 1)) * 200, 42 - ((v - lo) / (hi - lo)) * 38]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  svg.querySelector('.line').setAttribute('d', line);
  svg.querySelector('.area').setAttribute('d', `${line}L200 44L0 44Z`);
}
export function setCombo(n) {
  const el = $('combo');
  if (n < 2) { el.classList.remove('show'); return; }
  el.innerHTML = `<b>×${n}</b> ${t('combo')}`;
  el.classList.add('show');
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}

/* ===================== equation tags ===================== */
// Unicode superscripts (2⁶) are tiny at a distance: render exponents as real <sup>
const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
function setEquation(el, text) {
  const safe = text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  el.innerHTML = safe.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => `<sup>${[...m].map((c) => SUPS.indexOf(c)).join('')}</sup>`);
}
const tagLayer = () => $('labels');

// stretch: a problem a notch above the player's level, marked with a small badge;
// trait: what this yokai does (yokaiInfo.js TRAITS), as a badge of its own
export function createTag(text, { boss = false, hp = 0, stretch = false, trait = null } = {}) {
  const el = document.createElement('div');
  el.className = 'tag' + (boss ? ' boss' : '') + (stretch ? ' stretch' : '');
  el.innerHTML = `<div class="tag-in"><span class="eq"></span>${hp > 1 ? '<span class="hp"></span>' : ''}`
    + `${stretch ? `<span class="badge">${t('stretch')}</span>` : ''}${trait ? `<span class="badge trait">${trait}</span>` : ''}</div>`;
  setEquation(el.querySelector('.eq'), text);
  if (hp > 1) setTagHp(el, 0, hp);
  tagLayer().appendChild(el);
  return el;
}
export function setTagText(el, text) {
  setEquation(el.querySelector('.eq'), text);
  el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap');
}
export function setTagHp(el, done, total) {
  const hp = el.querySelector('.hp');
  if (hp) hp.innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < done ? 'gone' : ''}"></i>`).join('');
}
export function placeTag(el, x, y, scale, opacity, urgent) {
  el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%) scale(${scale.toFixed(3)})`;
  el.style.opacity = opacity.toFixed(2);
  el.classList.toggle('urgent', urgent);
}
export function setTagState(el, state) { el.classList.add(state); }
export function removeTag(el, delay = 0) {
  if (delay) setTimeout(() => el.remove(), delay); else el.remove();
}
export function clearTags() { tagLayer().innerHTML = ''; }

/* ===================== popups & banners ===================== */
export function popup(text, x, y, cls = '') {
  const el = document.createElement('div');
  el.className = 'popup ' + cls;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  $('popups').appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

let bannerTimer = 0, bannerLevel = 0, bannerNext = null;
// level: a banner never cuts off a more important one still on screen
// (2 promotion / rank trial · 1 wave / heal · 0 the rest); a level-1 banner
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
  if (html) el.innerHTML = html; else el.textContent = text;
  el.style.animationDuration = `${ms}ms`;
  void el.offsetWidth;
  el.classList.add('show');
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
  const html = `<span class="stamp"><b>${SEALS[i]}</b></span>`
    + `<span class="promo-text"><span class="promo-title">${t('promoted', { r: t(`rank${i}`) })}</span>`
    + `<span class="promo-sub">${t(`unlock${i}`)}</span></span>`;
  banner('', 'promo', 2, { html, ms: 2600 });
}

let toastTimer = 0;
export function padToast(text, cls = '') {
  const el = $('pad-toast');
  el.className = 'pad-toast show ' + cls;
  el.textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1300);
}

export function talismanState(state) {
  const el = $('talisman');
  el.classList.remove('cast', 'fizzle', 'shake');
  void el.offsetWidth;
  if (state) el.classList.add(state);
}
export function setGuess(digit, p) {
  const el = $('guess');
  if (digit == null) { el.classList.remove('show'); return; }
  el.textContent = String(digit);
  el.style.setProperty('--conf', p.toFixed(2));
  el.classList.add('show');
}

// the gold bar that fills while the talisman waits to be read
export function armTalisman(ms) {
  const el = $('pad-timer');
  el.style.setProperty('--wait', `${ms}ms`);
  el.classList.remove('run'); void el.offsetWidth; el.classList.add('run');
}
export function disarmTalisman() { $('pad-timer').classList.remove('run'); }

export function damageFlash() {
  const v = $('vignette');
  v.classList.remove('hit'); void v.offsetWidth; v.classList.add('hit');
}

/* ===================== AI panel ===================== */
export function showAI(img28, probs, verdict) {
  const c = $('ai-input'), g = c.getContext('2d');
  const img = g.createImageData(28, 28);
  for (let i = 0; i < 784; i++) {
    const v = Math.round(img28[i] * 255);
    img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const top = probs.map((p, d) => ({ p, d })).sort((a, b) => b.p - a.p).slice(0, 3);
  $('ai-top').innerHTML = top.map(({ d, p }, i) =>
    `<li class="${i === 0 ? 'lead' : ''}"><b>${d}</b><span class="bar"><i style="width:${(p * 100).toFixed(1)}%"></i></span><em>${Math.round(p * 100)}%</em></li>`).join('');
  if (verdict) setAIVerdict(verdict.text, verdict.cls);
}
function setAIVerdict(text, cls = '') {
  const el = $('ai-verdict');
  el.textContent = text;
  el.className = 'ai-verdict ' + cls;
}
export function resetAI() {
  const c = $('ai-input');
  c.getContext('2d').clearRect(0, 0, 28, 28);
  $('ai-top').innerHTML = '';
  setAIVerdict(t('aiIdle'));
}
export function setAIMeta(text, title = '') { $('ai-meta').textContent = text; $('ai-meta').title = title; }

/* ===================== overlays ===================== */
export function show(id, v = true) { $(id).hidden = !v; }
