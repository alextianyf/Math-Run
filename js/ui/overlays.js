// overlays.js — the full-screen cards: title, pause, game over, collection, rules, share.
import { $ } from '../core/dom.js';

// Show or hide an overlay. A scroll card (.scroll) rolls itself up before it goes.
export function showOverlay(id, visible = true) {
  const el = $(id);
  const scroll = el.querySelector(':scope > .scroll');
  scroll?.classList.remove('rolling-up');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (visible || el.hidden || !scroll || reducedMotion) {
    el.hidden = !visible;
    return;
  }
  scroll.classList.add('rolling-up');
  const done = () => {
    if (!scroll.classList.contains('rolling-up')) return;
    scroll.classList.remove('rolling-up');
    el.hidden = true;
  };
  scroll.addEventListener('animationend', done, { once: true });
  setTimeout(done, 450);                     // in case the animation never runs
}
