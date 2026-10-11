// tutorial.js — the coach layer for the opening tutorial: a dimming spotlight
// that glides between points of interest, a speech bubble placed beside it, a
// finger that demonstrates writing on the talisman, and a 3-2-1 countdown.
// The flow itself (which step, when to pause) lives in main.js.

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createCoach() {
  const root = $('tut'), hole = $('tut-hole'), bubble = $('tut-bubble');
  const titleEl = $('tut-title'), textEl = $('tut-text'), actions = $('tut-actions');
  const demoSvg = $('tut-demo'), demoPath = $('tut-demo-path'), finger = $('tut-finger');
  const countEl = $('countdown');
  const pathLen = demoPath.getTotalLength();
  demoPath.style.strokeDasharray = `${pathLen}`;

  let target = null;          // () => { x, y, w, h, round } in viewport px, or null
  let demoOn = false, demoT = 0, demoRect = null;
  const pos = { x: 0, y: 0, ready: false };

  function rectOf() {
    const r = target?.();
    return r && r.w > 0 ? r : null;
  }

  // Bubble beside the spotlight: below, above, left or right — whichever fits
  function placeBubble(r, snap) {
    if (bubble.hidden) return;
    const vw = window.innerWidth, vh = window.innerHeight, m = 14, gap = 18;
    const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    let x, y;
    if (!r) { x = (vw - bw) / 2; y = vh * 0.4 - bh / 2; }
    else if (vh - (r.y + r.h) >= bh + gap + m) { x = r.x + r.w / 2 - bw / 2; y = r.y + r.h + gap; }
    else if (r.y >= bh + gap + m) { x = r.x + r.w / 2 - bw / 2; y = r.y - bh - gap; }
    else if (r.x >= bw + gap + m) { x = r.x - bw - gap; y = r.y + r.h / 2 - bh / 2; }
    else { x = r.x + r.w + gap; y = r.y + r.h / 2 - bh / 2; }
    x = Math.min(Math.max(m, x), vw - bw - m);
    y = Math.min(Math.max(m, y), vh - bh - m);
    const k = snap || !pos.ready ? 1 : 0.25;            // glide after the yokai's bobbing
    pos.x += (x - pos.x) * k; pos.y += (y - pos.y) * k; pos.ready = true;
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
      if (!on) { target = null; demoOn = false; demoSvg.toggleAttribute('hidden', true); bubble.hidden = true; pos.ready = false; }
    },
    // spotlight a target (function returning a rect) or nothing; dim the rest or not
    focus(fn, { dim = true } = {}) {
      target = fn;
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
      bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
      placeBubble(rectOf(), true);
      actions.querySelector('.primary')?.focus({ preventScroll: true });
    },
    // swap the bubble text with a little nudge (wrong answer, unreadable digit…)
    nudge(text) {
      textEl.textContent = text;
      bubble.classList.remove('nudge'); void bubble.offsetWidth; bubble.classList.add('nudge');
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
      placeBubble(r, false);
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
