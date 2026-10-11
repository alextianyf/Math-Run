// ui.js — DOM side of the game: i18n, HUD, equation tags that follow the yokai,
// popups/banners, the "AI view" panel and the overlay screens.

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

/* ===================== i18n ===================== */
const DICT = {
  zh: {
    kicker: '少年阴阳师 × 手写 AI',
    subtitle: '百鬼夜行',
    tagline: '妖怪们带着算式从夜色里涌来。在符纸上写下答案，降妖除魔！',
    how1: '每只妖怪头上都有一道算式',
    how2: '在符纸上手写答案（0–9），浏览器里的神经网络会认出你的字',
    how3: '一张符能同时打中所有答案相同的妖怪',
    loading: 'AI 模型加载中…',
    loadFail: 'AI 模型加载失败，请刷新重试',
    start: '开始奔跑',
    best: '最高',
    rank0: '阴阳生',
    rank1: '阴阳师',
    rank2: '阴阳博士',
    rank3: '阴阳头',
    rank4: '晴明',
    wave: '第 {n} 波',
    trial: '晋升考核！',
    stretch: '挑战',
    promoted: '晋升 · {r}',
    statRank: '阶位 · 实力分',
    bestRank: '最高阶位',
    nearTrial: '考核将至',
    inTrial: '考核中',
    oneTrial: '只差一场考核就是{r}！',
    nearNext: '差一点就能挑战{r}！',
    nextRank: '下一阶：{r}',
    topReached: '已达最高阶 · 晴明！',
    unlock1: '解锁：乘法与除法',
    unlock2: '解锁：括号与多步运算',
    unlock3: '解锁：平方与开方',
    unlock4: '解锁：立方、乘方与开立方',
    rankLine: '{r} · {v}（{d}）',
    combo: '连击',
    tutSkip: '跳过教程',
    tutNext: '知道了',
    tutYokaiT: '妖怪来了！',
    tutYokai: '百鬼夜行的妖怪会从参道深处朝你飘过来——千万别让它碰到你。',
    tutEqT: '看它头上的算式',
    tutEq: '每只妖怪都挂着一道算式，算出答案就能降服它。这一只是 1 + 2。',
    tutWriteT: '在符纸上写答案',
    tutWrite: '用手指或鼠标在符纸上写出答案，写完停一下，符咒就会自己飞出去。',
    tutWrong: '{d} 不对哦——1 + 2 等于几？再写一次。',
    tutHint: '提示：写一个大大的 3。',
    tutUnclear: 'AI 没看清，写大一点、清楚一点。',
    tutNiceT: '降妖成功！',
    tutNice: '答对了，符咒会自动追上妖怪。答案相同的妖怪，一张符就能一起打中。',
    tutDangerT: '小心被抓',
    tutDanger: '答错或者太慢，妖怪碰到你就会掉一颗心。三颗心都没了，大鬼就会把你抓走！',
    tutReadyT: '听懂了吗？',
    tutReady: '真正的百鬼夜行就要开始了。',
    tutReplay: '再听一遍',
    tutGo: '继续奔跑',
    unclear: '看不清，再写一次',
    miss: '没有妖怪等于 {d}',
    idle: '还没有妖怪',
    multi2: '一符双妖！',
    multi3: '一符三妖！',
    multi4: '百鬼退散！',
    heal: '+1 生命',
    paused: '暂停',
    resume: '继续',
    quit: '回到标题',
    overTitle: '被大鬼抓住了！',
    newBest: '新纪录！',
    retry: '再跑一次',
    statBanished: '降服妖怪',
    statCombo: '最高连击',
    statDist: '奔跑距离',
    statAI: 'AI 读字',
    aiStat: '{n} 次 · 修正 {c} · 看不清 {u}',
    aiTitle: 'AI 视角',
    aiIdle: '写个数字试试',
    aiRead: '读到 {d} · {p}%',
    aiFix: '结合场上答案：{a} → {b}',
    aiUnsure: '不确定（{d} · {p}%）',
    ready: 'AI 就绪',
    go: '出发！',
    skip: '点击跳过',
    lang: 'EN',
  },
  en: {
    kicker: 'Onmyōji × Handwriting AI',
    subtitle: 'Night Parade',
    tagline: 'Yokai pour out of the night, each carrying a math riddle. Write the answer on your talisman to banish them!',
    how1: 'Every yokai carries an equation',
    how2: 'Handwrite the answer (0–9) — a neural net in your browser reads it',
    how3: 'One talisman hits every yokai with that answer',
    loading: 'Loading AI model…',
    loadFail: 'AI model failed to load — please refresh',
    start: 'Start running',
    best: 'Best',
    rank0: 'Apprentice',
    rank1: 'Onmyōji',
    rank2: 'Master',
    rank3: 'Grand Master',
    rank4: 'Seimei',
    wave: 'Wave {n}',
    trial: 'Rank trial!',
    stretch: 'Challenge',
    promoted: 'Promoted · {r}',
    statRank: 'Rank · rating',
    bestRank: 'Best rank',
    nearTrial: 'Trial soon',
    inTrial: 'Trial!',
    oneTrial: 'One trial away from {r}!',
    nearNext: 'So close to the {r} trial!',
    nextRank: 'Next: {r}',
    topReached: 'Top rank reached: Seimei!',
    unlock1: 'Unlocked: × and ÷',
    unlock2: 'Unlocked: brackets, multi-step',
    unlock3: 'Unlocked: squares and roots',
    unlock4: 'Unlocked: cubes, powers, cube roots',
    rankLine: '{r} · {v} ({d})',
    combo: 'Combo',
    tutSkip: 'Skip tutorial',
    tutNext: 'Got it',
    tutYokaiT: 'A yokai!',
    tutYokai: 'The Night Parade drifts down the shrine path toward you — don’t let it touch you.',
    tutEqT: 'Read its equation',
    tutEq: 'Every yokai carries an equation. Solve it to banish it — this one says 1 + 2.',
    tutWriteT: 'Write the answer',
    tutWrite: 'Write the answer on the talisman with your finger or mouse, then pause — it flies by itself.',
    tutWrong: '{d} isn’t right — what’s 1 + 2? Try again.',
    tutHint: 'Hint: write a big 3.',
    tutUnclear: 'The AI couldn’t read that — write it bigger and clearer.',
    tutNiceT: 'Banished!',
    tutNice: 'Right answer — the talisman homes in. Yokai that share an answer are all hit by one talisman.',
    tutDangerT: 'Don’t get caught',
    tutDanger: 'Too slow or wrong, and a yokai that reaches you takes a heart. Lose all three and the great oni carries you off!',
    tutReadyT: 'Got it?',
    tutReady: 'The real Night Parade is about to begin.',
    tutReplay: 'Once more',
    tutGo: 'Keep running',
    unclear: "Can't read that — try again",
    miss: 'No yokai equals {d}',
    idle: 'No yokai yet',
    multi2: 'Double banish!',
    multi3: 'Triple banish!',
    multi4: 'Parade scattered!',
    heal: '+1 life',
    paused: 'Paused',
    resume: 'Resume',
    quit: 'Title screen',
    overTitle: 'Caught by the oni!',
    newBest: 'New best!',
    retry: 'Run again',
    statBanished: 'Yokai banished',
    statCombo: 'Best combo',
    statDist: 'Distance',
    statAI: 'AI reads',
    aiStat: '{n} · fixed {c} · unclear {u}',
    aiTitle: 'AI view',
    aiIdle: 'Write a digit',
    aiRead: 'Read {d} · {p}%',
    aiFix: 'Context fix: {a} → {b}',
    aiUnsure: 'Unsure ({d} · {p}%)',
    ready: 'AI ready',
    go: 'Go!',
    skip: 'Tap to skip',
    lang: '中',
  },
};

let lang = store.get('lang', (navigator.language || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en');

export function t(key, vars = {}) {
  const s = DICT[lang][key] ?? DICT.en[key] ?? key;
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
  $('title-best').textContent = n ? `${t('best')} ${n.toLocaleString()}` : '';
}
/* ===================== ranks ===================== */
// one seal character per rank: 阴阳生 · 阴阳师 · 阴阳博士 · 阴阳头 · 晴明
export const SEALS = ['生', '师', '博', '头', '明'];

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

// stretch: a problem a notch above the player's level, marked with a small badge
export function createTag(text, { boss = false, hp = 0, stretch = false } = {}) {
  const el = document.createElement('div');
  el.className = 'tag' + (boss ? ' boss' : '') + (stretch ? ' stretch' : '');
  el.innerHTML = `<div class="tag-in"><span class="eq"></span>${boss ? '<span class="hp"></span>' : ''}${stretch ? `<span class="badge">${t('stretch')}</span>` : ''}</div>`;
  setEquation(el.querySelector('.eq'), text);
  if (boss) setTagHp(el, 0, hp);
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
export function setAIVerdict(text, cls = '') {
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
export function setAIMeta(text) { $('ai-meta').textContent = text; }

/* ===================== overlays ===================== */
export function show(id, v = true) { $(id).hidden = !v; }
