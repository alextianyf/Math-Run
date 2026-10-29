// shareCard.js — a player's own result page, without a server: the run is packed into
// the link itself (…/#r=<code>), and whoever opens it sees that player's card first,
// with a button to take up the challenge. The checksum only stops casual editing of
// the link; a static site can't truly verify a score.
import { showOverlay } from '../ui/overlays.js';
import { rankSeal } from '../ui/ranks.js';
import { $ } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { store } from '../core/store.js';

const SITE = 'https://alextianyf.github.io/Math-Run/';
const NAME_MAX = 12;

// FNV-1a over the payload, salted: enough to notice a hand-edited link
const check = (text) => {
  let h = 2166136261;
  for (const ch of `mathrun-card:${text}`) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return (h >>> 0).toString(36);
};
const toB64 = (text) => btoa(unescape(encodeURIComponent(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (code) => decodeURIComponent(escape(atob(code.replace(/-/g, '+').replace(/_/g, '/'))));

// run: { score, banished?, combo?, distance?, rank?, name?, day? } → the code in the link
export function encodeRun(run) {
  const data = JSON.stringify({ s: run.score, b: run.banished, c: run.combo, d: run.distance, r: run.rank, n: run.name || undefined, t: run.day });
  return `${toB64(data)}.${check(data)}`;
}
export function decodeRun(code) {
  try {
    const [body, sum] = code.split('.');
    const data = fromB64(body);
    if (check(data) !== sum) return null;
    const o = JSON.parse(data);
    if (!Number.isInteger(o.s) || o.s < 0) return null;
    return { score: o.s, banished: o.b, combo: o.c, distance: o.d, rank: o.r, name: typeof o.n === 'string' ? o.n.slice(0, NAME_MAX) : '', day: o.t };
  } catch {
    return null;
  }
}
// the link to a run's page: this site's address (the live site when run locally from a file)
export function runLink(run) {
  const base = location.protocol.startsWith('http') ? `${location.origin}${location.pathname}` : SITE;
  return `${base}#r=${encodeRun(run)}`;
}

const esc = (text) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const today = () => new Date().toISOString().slice(0, 10);

function renderCard(run) {
  const name = run.name?.trim() || t('cardAnon');
  const stats = run.banished != null
    ? `<div class="sc-stats"><span><b>${run.banished}</b>${t('statBanished')}</span><span><b>${run.combo}</b>${t('statCombo')}</span><span><b>${run.distance} m</b>${t('statDist')}</span></div>` : '';
  const rank = run.rank != null
    ? `<div class="sc-rank"><span class="stamp"><b>${rankSeal(run.rank)}</b></span>${t(`rank${run.rank}`)}</div>` : '';
  $('share-card').innerHTML = `
    <div class="sc-head"><span>百鬼夜行 · MATH RUN</span><span>${run.day ?? ''}</span></div>
    <div class="sc-name">${t('cardOf', { n: esc(name) })}</div>
    <div class="sc-score">${run.score.toLocaleString('en')}</div>
    ${stats}${rank}`;
}

let current = null;           // the run on the card while it's open as the player's own

// the player's own card: a name to put on it, then copy or share the link
export function openShare(run) {
  current = { ...run, name: store.get('nickname', ''), day: run.day ?? today() };
  $('share-name').value = current.name;
  $('share-name').placeholder = t('cardNameHint');
  $('share-own').hidden = false;
  $('share-visit').hidden = true;
  $('share-title').textContent = t('cardTitleOwn');
  renderCard(current);
  showOverlay('ov-card');
}

async function shareLink() {
  const url = runLink(current);                      // just the link: the card says the rest
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: t('cardTitleOwn'), url }); return; }
    await navigator.clipboard.writeText(url);
    $('btn-card-copy').textContent = t('cardCopied');
    setTimeout(() => { $('btn-card-copy').textContent = t('cardCopy'); }, 2000);
  } catch { /* the player closed the share sheet */ }
}

// someone opened a shared link: their card first, then the game
export function openSharedLink() {
  const m = location.hash.match(/^#r=([\w.-]+)$/);
  if (!m) return;
  const run = decodeRun(m[1]);
  history.replaceState(null, '', location.pathname + location.search);
  if (!run) return;
  $('share-own').hidden = true;
  $('share-visit').hidden = false;
  $('share-title').textContent = t('cardTitleVisit');
  renderCard(run);
  showOverlay('ov-card');
}

export function initShareCard() {
  $('share-name').maxLength = NAME_MAX;
  $('share-name').addEventListener('input', () => {
    current.name = $('share-name').value.slice(0, NAME_MAX);
    store.set('nickname', current.name);
    renderCard(current);
  });
  $('btn-card-copy').addEventListener('click', shareLink);
  $('btn-card-close').addEventListener('click', () => showOverlay('ov-card', false));
  $('btn-card-play').addEventListener('click', () => showOverlay('ov-card', false));
  openSharedLink();
}
