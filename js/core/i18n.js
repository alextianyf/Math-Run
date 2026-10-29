// i18n.js — the language switch. The texts themselves are in ui/strings.js;
// {name} in a text marks a value filled in at run time: t('best', { n: 3 }).
import { STRINGS } from '../ui/strings.js';
import { store } from './store.js';

function defaultLang() {
  const browserLang = (navigator.language || 'en').toLowerCase();
  if (browserLang.startsWith('zh')) return 'zh';
  return 'en';
}

let lang = store.get('lang', defaultLang());

export function t(key, vars = {}) {
  const text = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '');
}

export function getLang() {
  return lang;
}

export function setLang(newLang) {
  lang = newLang;
  store.set('lang', newLang);
  applyI18n();
}

// fill every element marked data-i18n (its text) or data-i18n-label (its aria-label)
export function applyI18n() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of document.querySelectorAll('[data-i18n-label]')) {
    el.setAttribute('aria-label', t(el.dataset.i18nLabel));
  }
}
