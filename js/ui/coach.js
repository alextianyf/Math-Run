// coach.js — the look of the opening tutorial (its steps are in game/tutorial.js):
// a dimming spotlight that glides between points of interest, a speech bubble
// placed beside it, a finger that demonstrates writing on the talisman, and a
// 3-2-1 countdown.

import { $, restartAnimation } from '../core/dom.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createCoach() {
  const root = $('tut');
  const hole = $('tut-hole');
  const bubble = $('tut-bubble');
  const titleEl = $('tut-title');
  const textEl = $('tut-text');
  const actions = $('tut-actions');
  const demoSvg = $('tut-demo');
  const demoPath = $('tut-demo-path');
  const finger = $('tut-finger');
  const countEl = $('countdown');
  const pathLen = demoPath.getTotalLength();
  demoPath.style.strokeDasharray = `${pathLen}`;

  let target = null;          // () => { x, y, w, h, round } in viewport px, or null
  let anchor = null;          // what the bubble sits beside, when not the target itself
  let demoOn = false;
  let demoT = 0;
  let demoRect = null;
  const pos = { x: 0, y: 0, ready: false };

  function rectOf() {
    const r = target?.();
    return r && r.w > 0 ? r : null;
  }
  const anchorOf = () => {
    const r = anchor?.();
    return r && r.w > 0 ? r : rectOf();
  };

  // Bubble beside the spotlight: below, above, left or right — whichever fits
  function placeBubble(r, snap) {
    if (bubble.hidden) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const m = 14;
    const gap = 18;
    const bw = bubble.offsetWidth;
    const bh = bubble.offsetHeight;
    let x;
    let y;
    if (!r) {
      x = (vw - bw) / 2;
      y = vh * 0.4 - bh / 2;
    }
    else if (vh - (r.y + r.h) >= bh + gap + m) {
      x = r.x + r.w / 2 - bw / 2;
      y = r.y + r.h + gap;
    }
    else if (r.y >= bh + gap + m) {
      x = r.x + r.w / 2 - bw / 2;
      y = r.y - bh - gap;
    }
    else if (r.x >= bw + gap + m) {
      x = r.x - bw - gap;
      y = r.y + r.h / 2 - bh / 2;
    }
    else {
      x = r.x + r.w + gap;
      y = r.y + r.h / 2 - bh / 2;
    }
    x = Math.min(Math.max(m, x), vw - bw - m);
    y = Math.min(Math.max(m, y), vh - bh - m);
    const k = snap || !pos.ready ? 1 : 0.25;            // glide after the yokai's bobbing
    pos.x += (x - pos.x) * k;
    pos.y += (y - pos.y) * k;
    pos.ready = true;
    bubble.style.transform = `translate(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px)`;
  }

  function placeHole(r) {
    root.classList.toggle('target', !!r);
    if (!r) {
      Object.assign(hole.style, { left: '50%', top: '45%', width: '0px', height: '0px' });
      return;
    }
    Object.assign(hole.style, {
      left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px`,
      borderRadius: r.round ? '50%' : '16px',
    });
  }

  // One cycle: tap in, trace the digit, hold, fade — the finger rides the stroke
  function animateDemo(dt) {
    if (!demoOn) return;
    const r = demoRect?.();
    if (!r) return;
    Object.assign(demoSvg.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    demoT = (demoT + dt / 2.8) % 1;
    const draw = Math.min(1, Math.max(0, (demoT - 0.12) / 0.6));
    const fade = demoT > 0.86 ? 1 - (demoT - 0.86) / 0.14 : Math.min(1, demoT / 0.08);
    const p = demoPath.getPointAtLength(draw * pathLen);
    demoPath.style.strokeDashoffset = `${pathLen * (1 - draw)}`;
    demoPath.style.opacity = fade.toFixed(2);
    finger.setAttribute('transform', `translate(${(p.x - 9 * 1.7).toFixed(2)} ${(p.y - 1.5 * 1.7).toFixed(2)}) scale(1.7)`);
    finger.style.opacity = fade.toFixed(2);
    finger.classList.toggle('press', demoT > 0.1 && demoT < 0.74);
  }

  return {
    show(on) {
      root.hidden = !on;
      if (!on) {
        target = null;
        anchor = null;
        demoOn = false;
        demoSvg.toggleAttribute('hidden', true);
        bubble.hidden = true;
        pos.ready = false;
      }
    },
    // spotlight a target (function returning a rect) or nothing; dim the rest or not;
    // near: the bubble sits beside this instead (so it never covers what matters)
    focus(fn, { dim = true, near = null } = {}) {
      target = fn;
      anchor = near;
      root.classList.toggle('dim', dim);
      placeHole(rectOf());
    },
    say({ title, text, buttons = [] }) {
      bubble.hidden = false;
      titleEl.textContent = title;
      textEl.textContent = text;
      actions.replaceChildren(...buttons.map((b) => {
        const el = document.createElement('button');
        el.className = `btn small ${b.kind || 'primary'}`;
        el.textContent = b.label;
        el.addEventListener('click', b.onClick, { once: true });
        return el;
      }));
      restartAnimation(bubble, 'pop');
      placeBubble(anchorOf(), true);
      actions.querySelector('.primary')?.focus({ preventScroll: true });
    },
    // swap the bubble text with a little nudge (wrong answer, unreadable digit…)
    nudge(text) {
      textEl.textContent = text;
      restartAnimation(bubble, 'nudge');
    },
    hush() { bubble.hidden = true; },
    demo(on, rectFn) {
      demoOn = on;
      if (rectFn) demoRect = rectFn;
      demoSvg.toggleAttribute('hidden', !on);     // an SVG element has no .hidden property
      if (on) demoT = 0;
    },
    update(dt) {
      if (root.hidden) return;
      const r = rectOf();
      placeHole(r);
      placeBubble(anchorOf(), false);
      animateDemo(dt);
    },
    async countdown(labels, onTick) {
      for (let i = 0; i < labels.length; i++) {
        countEl.textContent = labels[i];
        countEl.className = 'countdown show' + (i === labels.length - 1 ? ' go' : '');
        onTick?.(i);
        await sleep(i === labels.length - 1 ? 700 : 820);
      }
      countEl.className = 'countdown';
    },
  };
}
