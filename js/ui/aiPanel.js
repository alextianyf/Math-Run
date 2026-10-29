// aiPanel.js — the "AI view": the 28×28 image the model saw, its three best
// guesses with their probabilities, and what the game decided.
import { t } from '../core/i18n.js';
import { $ } from '../core/dom.js';

function drawInput(img28) {
  const g = $('ai-input').getContext('2d');
  const img = g.createImageData(28, 28);
  for (let i = 0; i < 28 * 28; i++) {
    const v = Math.round(img28[i] * 255);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

function setVerdict(text, cls = '') {
  const el = $('ai-verdict');
  el.textContent = text;
  el.className = 'ai-verdict ' + cls;
}

// verdict: { text, cls } or nothing
export function showAI(img28, probs, verdict) {
  drawInput(img28);
  const top = probs
    .map((p, digit) => ({ p, digit }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 3);
  const rows = top.map(({ digit, p }, i) => {
    const cls = i === 0 ? 'lead' : '';
    const bar = `<span class="bar"><i style="width:${(p * 100).toFixed(1)}%"></i></span>`;
    return `<li class="${cls}"><b>${digit}</b>${bar}<em>${Math.round(p * 100)}%</em></li>`;
  });
  $('ai-top').innerHTML = rows.join('');
  if (verdict) setVerdict(verdict.text, verdict.cls);
}

export function resetAI() {
  $('ai-input').getContext('2d').clearRect(0, 0, 28, 28);
  $('ai-top').innerHTML = '';
  setVerdict(t('aiIdle'));
}

// the model's name and timing, beside the panel's title
export function setAIMeta(text, title = '') {
  const el = $('ai-meta');
  el.textContent = text;
  el.title = title;
}
