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
    wave: '第 {n} 波',
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
    boss: '大鬼来袭！',
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
    ready: 'AI 就绪 · {b}',
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
    wave: 'Wave {n}',
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
    boss: 'Oni boss!',
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
    ready: 'AI ready · {b}',
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
    if (was && i >= n) { h.classList.remove('pop'); void h.offsetWidth; h.classList.add('pop'); }
  });
  box.setAttribute('aria-label', `${n}/${max}`);
}
export function setScore(n) { $('score').textContent = n.toLocaleString(); }
export function setDistance(m) { $('dist').textContent = Math.floor(m).toLocaleString(); }
export function setBest(n) {
  $('best').textContent = n.toLocaleString();
  $('title-best').textContent = n ? `${t('best')} ${n.toLocaleString()}` : '';
}
export function setWave(n) { $('wave').textContent = t('wave', { n }); }
export function setCombo(n) {
  const el = $('combo');
  if (n < 2) { el.classList.remove('show'); return; }
  el.innerHTML = `<b>×${n}</b> ${t('combo')}`;
  el.classList.add('show');
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}

/* ===================== equation tags ===================== */
const tagLayer = () => $('labels');

export function createTag(text, { boss = false, hp = 0 } = {}) {
  const el = document.createElement('div');
  el.className = 'tag' + (boss ? ' boss' : '');
  el.innerHTML = `<div class="tag-in"><span class="eq"></span>${boss ? '<span class="hp"></span>' : ''}</div>`;
  el.querySelector('.eq').textContent = text;
  if (boss) setTagHp(el, 0, hp);
  tagLayer().appendChild(el);
  return el;
}
export function setTagText(el, text) {
  el.querySelector('.eq').textContent = text;
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

let bannerTimer = 0;
export function banner(text, cls = '') {
  const el = $('banner');
  el.className = 'banner ' + cls;
  el.textContent = text;
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => el.classList.remove('show'), 1500);
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
