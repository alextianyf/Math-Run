// pad.js — the talisman (符纸). Captures handwriting with Pointer Events, draws it
// in vermilion ink, and re-renders the strokes as white-on-black at a normalized
// size so the MNIST pipeline always sees a consistent stroke thickness.

export const MODEL_SIZE = 280;     // side of the square image fed to preprocessToMNIST
const MODEL_BOX = 190;             // longest side of the digit inside that image
const MODEL_LINE = 18;             // stroke width inside that image (best of 12–22 on jittered test digits)
const INK = '#b3170f';
// How long to wait (ms) after the pen lifts before reading the digit: [after the
// first stroke, after later strokes]. One stroke may be an unfinished 4, 5 or crossed 7,
// so that wait is longer; writing with a mouse is slower than with a finger or pen.
const WAITS = { mouse: [1500, 1100], touch: [1100, 800], pen: [1100, 800] };

// onArm(ms) fires when the submit countdown starts, onDisarm() when it's cancelled
export function createPad(canvas, { onInput, onFinish, onArm, onDisarm } = {}) {
  const ctx = canvas.getContext('2d');
  const modelCanvas = document.createElement('canvas');
  modelCanvas.width = modelCanvas.height = MODEL_SIZE;
  const mctx = modelCanvas.getContext('2d', { willReadFrequently: true });

  let strokes = [];
  let current = null;
  let dpr = 1, w = 1, h = 1;
  let idleTimer = 0;
  let pointerType = 'mouse';
  let enabled = true;

  const inkWidth = () => Math.max(7, Math.min(w, h) * 0.07);

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    // keep strokes proportional when the pad changes size
    if (w > 1 && h > 1 && r.width > 0) {
      const sx = r.width / w, sy = r.height / h;
      strokes = strokes.map((s) => s.map(([x, y]) => [x * sx, y * sy]));
    }
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    redraw();
  }

  function styleInk(c, width, color) {
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = width;
    c.strokeStyle = color;
    c.fillStyle = color;
  }

  // Draw one stroke. smooth=true curves through segment midpoints (nicer ink);
  // the model gets the raw polyline so sharp corners (4, 7) survive.
  function tracePath(c, pts, smooth = true) {
    if (pts.length === 1) {
      c.beginPath();
      c.arc(pts[0][0], pts[0][1], c.lineWidth / 2, 0, Math.PI * 2);
      c.fill();
      return;
    }
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      if (!smooth) { c.lineTo(pts[i][0], pts[i][1]); continue; }
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      c.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const last = pts[pts.length - 1];
    c.lineTo(last[0], last[1]);
    c.stroke();
  }

  function redraw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    styleInk(ctx, inkWidth(), INK);
    for (const s of strokes) tracePath(ctx, s);
  }

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!enabled || current) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* capture is a nicety */ }
    disarm();
    pointerType = e.pointerType in WAITS ? e.pointerType : 'mouse';
    current = [pos(e)];
    strokes.push(current);
    redraw();
    onInput?.();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!current) return;
    e.preventDefault();
    const p = pos(e), last = current[current.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 1.5) return;
    current.push(p);
    redraw();
    onInput?.();
  });
  const end = (e) => {
    if (!current) return;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
    current = null;
    const wait = WAITS[pointerType][strokes.length > 1 ? 1 : 0];
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { idleTimer = 0; onFinish?.(); }, wait);
    onArm?.(wait);
  };
  function disarm() {
    if (idleTimer) onDisarm?.();
    clearTimeout(idleTimer);
    idleTimer = 0;
  }
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);

  function bbox() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of strokes) for (const [x, y] of s) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return { x0, y0, x1, y1, ext: Math.max(x1 - x0, y1 - y0) };
  }

  return {
    resize,
    get writing() { return !!current; },
    hasInk() { return strokes.length > 0; },
    setEnabled(v) { enabled = v; if (!v) { current = null; disarm(); } },
    clear() {
      strokes = [];
      current = null;
      disarm();
      redraw();
    },

    // RGBA pixels of the strokes, white on black, digit centred & scaled to MODEL_BOX.
    // Returns null when there's nothing meaningful written.
    renderForModel() {
      if (!strokes.length) return null;
      const b = bbox();
      if (b.ext < Math.min(w, h) * 0.06) return null;            // a stray dot
      const scale = MODEL_BOX / b.ext;
      mctx.setTransform(1, 0, 0, 1, 0, 0);
      mctx.fillStyle = '#000';
      mctx.fillRect(0, 0, MODEL_SIZE, MODEL_SIZE);
      mctx.setTransform(scale, 0, 0, scale,
        MODEL_SIZE / 2 - ((b.x0 + b.x1) / 2) * scale,
        MODEL_SIZE / 2 - ((b.y0 + b.y1) / 2) * scale);
      styleInk(mctx, MODEL_LINE / scale, '#fff');
      for (const s of strokes) tracePath(mctx, s, false);
      mctx.setTransform(1, 0, 0, 1, 0, 0);
      return mctx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE).data;
    },

    // A small paper-talisman image of what was written (for the flying talisman)
    snapshot() {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 192;
      const g = c.getContext('2d');
      const grd = g.createLinearGradient(0, 0, 0, 192);
      grd.addColorStop(0, '#f7dc7a'); grd.addColorStop(1, '#e8b94a');
      g.fillStyle = grd;
      g.fillRect(0, 0, 128, 192);
      g.strokeStyle = '#b3170f'; g.lineWidth = 4;
      g.strokeRect(7, 7, 114, 178);
      g.lineWidth = 1.5;
      g.strokeRect(13, 13, 102, 166);
      if (strokes.length) {
        const b = bbox();
        const s = 110 / Math.max(b.ext, 1);
        g.setTransform(s, 0, 0, s, 64 - ((b.x0 + b.x1) / 2) * s, 98 - ((b.y0 + b.y1) / 2) * s);
        styleInk(g, 11 / s, '#b3170f');
        for (const st of strokes) tracePath(g, st);
      }
      return c;
    },
  };
}
