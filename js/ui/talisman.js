// talisman.js — the talisman's own feedback: how it reacts to a cast or a miss, the
// digit the AI guesses, the bar that fills before it's read, and the short message
// above it ("not sure — write it again").
import { $, restartAnimation } from '../core/dom.js';

// state: 'cast' · 'fizzle' · 'shake', or null to clear
export function talismanState(state) {
  const el = $('talisman');
  el.classList.remove('cast', 'fizzle', 'shake');
  if (state) restartAnimation(el, state);
}

// the digit the AI reads, in the corner; null hides it
export function setGuess(digit, p) {
  const el = $('guess');
  if (digit == null) {
    el.classList.remove('show');
    return;
  }
  el.textContent = String(digit);
  el.style.setProperty('--conf', p.toFixed(2));
  el.classList.add('show');
}

// the gold bar that fills while the talisman waits to be read
export function armTalisman(ms) {
  const el = $('pad-timer');
  el.style.setProperty('--wait', `${ms}ms`);
  restartAnimation(el, 'run');
}

export function disarmTalisman() {
  $('pad-timer').classList.remove('run');
}

let toastTimer = 0;
export function padToast(text, cls = '') {
  const el = $('pad-toast');
  el.className = 'pad-toast show ' + cls;
  el.textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1300);
}
