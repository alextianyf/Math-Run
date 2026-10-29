// collection.js — the Achievements screen (unearned ones greyed out, with progress
// where it counts up, and a transfer code that moves everything saved in this browser
// to another device — no server needed) and the yokai Bestiary. Each has its own tile
// on the title; they share one overlay.
import * as ui from '../ui/ui.js';
import { ACHIEVEMENTS, YOKAI_TYPES, collection, progressOf, onUnlock } from './achievements.js';
import { showYokai, hideYokai } from './bestiaryView.js';
import { YOKAI_LOOK, TRAITS } from './yokaiInfo.js';
import { $ } from '../core/dom.js';
import { getLang, t } from '../core/i18n.js';
import { store } from '../core/store.js';

const SAVED = ['best', 'bestRun', 'bestRank', 'collection'];      // what a transfer code carries
const CODE_PREFIX = 'MR1.';
const day = (time) => new Date(time).toLocaleDateString(getLang() === 'zh' ? 'zh-CN' : 'en');

export function refreshCollectionChip() {
  const { earned, seen } = collection();
  $('collection-count').textContent = `${Object.keys(earned).length}/${ACHIEVEMENTS.length}`;
  $('bestiary-count').textContent = `${YOKAI_TYPES.filter((type) => seen[type]).length}/${YOKAI_TYPES.length}`;
}

function renderAchievements() {
  const { earned } = collection();
  $('achievement-list').innerHTML = ACHIEVEMENTS.map((a) => {
    const when = earned[a.id];
    const progress = !when && a.goal ? Math.min(progressOf(a) ?? 0, a.goal) : null;
    const extra = when ? `<small>${day(when)}</small>`
      : progress != null ? `<small class="progress"><i style="width:${(progress / a.goal) * 100}%"></i></small><small>${progress}/${a.goal}</small>` : '';
    return `<li class="${when ? 'earned' : 'locked'}"><span class="stamp"><b>${a.icon}</b></span>
      <div><b>${t(`a_${a.id}`)}</b><p>${t(`ad_${a.id}`)}</p>${extra}</div></li>`;
  }).join('');
}

// the bestiary: one row per yokai (tap one to see it turning above the list)
let shown = null;
function renderBestiary() {
  const { seen } = collection();
  $('bestiary-list').innerHTML = YOKAI_TYPES.map((type) => {
    const [seal, color] = YOKAI_LOOK[type];
    const met = seen[type];
    return `<li class="${met ? 'earned' : 'locked'}${type === shown ? ' selected' : ''}" data-type="${type}" tabindex="0" role="button">
      <span class="stamp" style="background:${met ? color : ''}"><b>${met ? seal : '？'}</b></span>
      <div><b>${met ? t(`y_${type}`) : '？？？'}</b><p>${met ? t(`yd_${type}`) : t('notMet')}</p>${met && TRAITS[type] ? `<p class="trait"><span class="badge">${t(`tr_${TRAITS[type]}`)}</span>${t(`yt_${TRAITS[type]}`)}</p>` : ''}${met ? `<small>${day(met)}</small>` : ''}</div></li>`;
  }).join('');
}
function view(type) {
  const met = !!collection().seen[type];
  shown = type;
  showYokai($('bestiary-view'), type, met);
  $('bestiary-caption').textContent = met ? t(`y_${type}`) : t('notMetView');
  for (const li of $('bestiary-list').children) li.classList.toggle('selected', li.dataset.type === type);
}
function openBestiary() {
  renderBestiary();
  const { seen } = collection();
  view(shown ?? YOKAI_TYPES.find((type) => seen[type]) ?? YOKAI_TYPES[0]);
}

/* ---------- moving progress to another device ---------- */
function exportCode() {
  const data = {};
  for (const key of SAVED) {
    const value = store.get(key, null);
    if (value != null) data[key] = value;
  }
  return CODE_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}

function importCode(code) {
  try {
    const text = code.trim();
    if (!text.startsWith(CODE_PREFIX)) throw new Error('prefix');
    const data = JSON.parse(decodeURIComponent(escape(atob(text.slice(CODE_PREFIX.length)))));
    if (typeof data !== 'object' || !data) throw new Error('shape');
    for (const key of SAVED) if (key in data) store.set(key, data[key]);
    $('transfer-msg').textContent = t('transferDone');
    setTimeout(() => location.reload(), 800);
  } catch {
    $('transfer-msg').textContent = t('transferBad');
  }
}

/* ---------- the screen ---------- */
// which: 'achievements' (with the transfer code) or 'bestiary'
export function openCollection(which) {
  const bestiary = which === 'bestiary';
  $('collection-title').textContent = t(bestiary ? 'tabBestiary' : 'tabAchievements');
  $('achievement-list').hidden = bestiary;
  $('bestiary-pane').hidden = !bestiary;
  document.querySelector('#ov-collection .transfer').hidden = bestiary;
  if (bestiary) openBestiary();
  else {
    hideYokai();
    renderAchievements();
    $('transfer-out').value = exportCode();
    $('transfer-in').placeholder = t('transferPaste');
    $('transfer-msg').textContent = '';
  }
  ui.show('ov-collection');
}

export function initCollection() {
  refreshCollectionChip();
  // earned mid-game: a toast, and the title's counter goes up
  onUnlock((a) => {
    ui.achievementToast(a.icon, t('unlocked'), t(`a_${a.id}`));
    refreshCollectionChip();
  });
  $('btn-achievements').addEventListener('click', () => openCollection('achievements'));
  $('btn-bestiary').addEventListener('click', () => openCollection('bestiary'));
  $('btn-collection-close').addEventListener('click', () => { hideYokai(); ui.show('ov-collection', false); });
  const pick = (e) => { const li = e.target.closest('li[data-type]'); if (li) view(li.dataset.type); };
  $('bestiary-list').addEventListener('click', pick);
  $('bestiary-list').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e); } });
  $('btn-transfer-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('transfer-out').value); $('transfer-msg').textContent = t('shared'); } catch { $('transfer-out').select(); }
  });
  $('btn-transfer-apply').addEventListener('click', () => importCode($('transfer-in').value));
}
