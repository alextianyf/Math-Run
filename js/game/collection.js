// collection.js — the Collection screen: achievements (unearned ones greyed out, with
// progress where it counts up), the yokai bestiary, and a transfer code that moves
// everything saved in this browser to another device — no server needed.
import * as ui from '../ui/ui.js';
import { ACHIEVEMENTS, YOKAI_TYPES, collection, progressOf, onUnlock } from './achievements.js';
import { $ } from './helpers.js';

const SAVED = ['best', 'bestRank', 'collection'];      // what a transfer code carries
const YOKAI_LOOK = {
  onibi: ['火', '#4aa8e0'], chochin: ['灯', '#e8892e'], hitotsume: ['目', '#d2a640'], kappa: ['河', '#4fa65a'],
  kitsunebi: ['狐', '#8a6aff'], kasa: ['伞', '#e0457f'], ittan: ['布', '#8fb4d8'], hyakume: ['百', '#e0804a'], nekomata: ['猫', '#d8a860'],
  tengu: ['天', '#5a6ad0'], rokurokubi: ['首', '#a058c8'], nopperabo: ['无', '#8a8a9a'], kamaitachi: ['镰', '#c88a3a'], oni: ['鬼', '#c9302c'],
};
const CODE_PREFIX = 'MR1.';
const day = (time) => new Date(time).toLocaleDateString(ui.getLang() === 'zh' ? 'zh-CN' : 'en');

export function refreshCollectionChip() {
  $('collection-count').textContent = `${Object.keys(collection().earned).length}/${ACHIEVEMENTS.length}`;
}

function renderAchievements() {
  const { earned } = collection();
  $('achievement-list').innerHTML = ACHIEVEMENTS.map((a) => {
    const when = earned[a.id];
    const progress = !when && a.goal ? Math.min(progressOf(a) ?? 0, a.goal) : null;
    const extra = when ? `<small>${day(when)}</small>`
      : progress != null ? `<small class="progress"><i style="width:${(progress / a.goal) * 100}%"></i></small><small>${progress}/${a.goal}</small>` : '';
    return `<li class="${when ? 'earned' : 'locked'}"><span class="stamp"><b>${a.icon}</b></span>
      <div><b>${ui.t(`a_${a.id}`)}</b><p>${ui.t(`ad_${a.id}`)}</p>${extra}</div></li>`;
  }).join('');
}

function renderBestiary() {
  const { seen } = collection();
  $('bestiary-list').innerHTML = YOKAI_TYPES.map((type) => {
    const [seal, color] = YOKAI_LOOK[type];
    const met = seen[type];
    return `<li class="${met ? 'earned' : 'locked'}"><span class="stamp" style="background:${met ? color : ''}"><b>${met ? seal : '？'}</b></span>
      <div><b>${met ? ui.t(`y_${type}`) : '？？？'}</b><p>${met ? ui.t(`yd_${type}`) : ui.t('notMet')}</p>${met ? `<small>${day(met)}</small>` : ''}</div></li>`;
  }).join('');
}

/* ---------- moving progress to another device ---------- */
function exportCode() {
  const data = {};
  for (const key of SAVED) {
    const value = ui.store.get(key, null);
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
    for (const key of SAVED) if (key in data) ui.store.set(key, data[key]);
    $('transfer-msg').textContent = ui.t('transferDone');
    setTimeout(() => location.reload(), 800);
  } catch {
    $('transfer-msg').textContent = ui.t('transferBad');
  }
}

/* ---------- the screen ---------- */
export function openCollection() {
  renderAchievements();
  renderBestiary();
  $('transfer-out').value = exportCode();
  $('transfer-in').placeholder = ui.t('transferPaste');
  $('transfer-msg').textContent = '';
  ui.show('ov-collection');
}

export function initCollection() {
  refreshCollectionChip();
  // earned mid-game: a toast, and the title's counter goes up
  onUnlock((a) => {
    ui.achievementToast(a.icon, ui.t('unlocked'), ui.t(`a_${a.id}`));
    refreshCollectionChip();
  });
  $('btn-collection').addEventListener('click', openCollection);
  $('btn-collection-close').addEventListener('click', () => ui.show('ov-collection', false));
  for (const tab of document.querySelectorAll('#ov-collection .tab')) {
    tab.addEventListener('click', () => {
      for (const other of document.querySelectorAll('#ov-collection .tab')) {
        other.classList.toggle('active', other === tab);
        $(other.dataset.tab).hidden = other !== tab;
      }
    });
  }
  $('btn-transfer-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('transfer-out').value); $('transfer-msg').textContent = ui.t('shared'); } catch { $('transfer-out').select(); }
  });
  $('btn-transfer-apply').addEventListener('click', () => importCode($('transfer-in').value));
}
