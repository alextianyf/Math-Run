// problems.js — procedural equation generator. Every answer is a whole number 0–9
// (one handwritten digit), but the expression around it can mix + − × ÷, brackets,
// powers (x², x³, 2⁵, 7⁰) and roots (√, ∛), nested as deep as the player can take.
//
// It works backwards: pick the answer, then repeatedly "explain" a number as an
// operation whose result is that number:  7 → 12 − 5 → 3 × 4 − 5 → √16 × 3 − 5.
// Every intermediate value is a non-negative integer under a cap, so the problem is
// always solvable by mental math, and the space of problems is far too large to
// repeat. Each problem is scored on the same scale as the player's rating
// (adaptive.js), so the director can simply ask for "something around 950" —
// and say which operations the player has unlocked so far.

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n) => String(n).split('').map((d) => SUP[+d]).join('');
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const BASIC = ['+', '−', '×', '÷'];
export const ALL = [...BASIC, 'sq', 'sqrt', 'cube', 'cbrt', 'pow'];
// What the generator may use, by target difficulty. Candidates are scored and the
// closest one wins, so the bands only need to be roughly right.
const BANDS = [
  { upTo: 600, ops: ['+', '−'], steps: [1, 1], cap: 18 },
  { upTo: 760, ops: BASIC, steps: [1, 2], cap: 36 },
  { upTo: 900, ops: BASIC, steps: [2, 3], cap: 60 },
  { upTo: 1100, ops: [...BASIC, 'sq', 'sqrt'], steps: [2, 3], cap: 100 },
  { upTo: 1350, ops: ALL, steps: [2, 4], cap: 125, deep: true },
  { upTo: Infinity, ops: ALL, steps: [3, 5], cap: 150, deep: true },
];
const EXOTIC = new Set(['sq', 'sqrt', 'cube', 'cbrt', 'pow']);
const POWERS = {
  1: [[2, 0], [3, 0], [5, 0], [7, 0], [9, 0]],
  16: [[2, 4]],
  32: [[2, 5]],
  64: [[2, 6], [4, 3]],
  81: [[3, 4]],
};
const CUBES = { 8: 2, 27: 3, 64: 4, 125: 5 };
const isSquare = (v) => v >= 4 && Number.isInteger(Math.sqrt(v));

/* ===================== building expression trees ===================== */
const num = (v) => ({ t: 'n', v });

function factorPairs(v) {
  const out = [];
  for (let a = 2; a * a <= v; a++) if (v % a === 0) out.push([a, v / a], [v / a, a]);
  return out;
}

function feasible(v, cfg) {
  return cfg.ops.filter((op) => {
    switch (op) {
      case '+': return v >= 2;
      case '−': return v + 1 <= cfg.cap;
      case '×': return factorPairs(v).length > 0;      // never "0 × …": too easy to spot
      case '÷': return v >= 1 && v * 2 <= cfg.cap;    // never "0 ÷ …" either
      case 'sq': return isSquare(v) && v <= cfg.cap;
      case 'cube': return v in CUBES && v <= cfg.cap;
      case 'pow': return v in POWERS && v <= cfg.cap;
      case 'sqrt': return v >= 2 && v * v <= cfg.cap;
      case 'cbrt': return v >= 2 && v ** 3 <= cfg.cap;
      default: return false;
    }
  });
}

// a perfect power near v, so + and − can open the door to powers and roots
function powerOperand(cfg, min, max) {
  const options = [];
  for (let b = 2; b * b <= max; b++) if (b * b >= min) options.push(b * b);
  for (const c of Object.keys(CUBES).map(Number)) if (c >= min && c <= max) options.push(c);
  return options.length ? pick(options) : null;
}

function split(steps) {
  const left = ri(0, steps);
  return [left, steps - left];
}

// how often an operation goes in the draw: exotic ones ×3, × and ÷ ×2, + and − once
function weightOf(op) {
  if (EXOTIC.has(op)) return 3;
  if (op === '×' || op === '÷') return 2;
  return 1;
}

function build(v, steps, cfg) {
  if (steps <= 0) return num(v);
  const ops = feasible(v, cfg);
  if (!ops.length) return num(v);
  // exotic operations are rarer to be feasible, so favour them when they are
  const weighted = ops.flatMap((op) => Array(weightOf(op)).fill(op));
  const op = pick(weighted);
  const rest = steps - 1;
  const exoticOn = cfg.ops.some((o) => EXOTIC.has(o));
  switch (op) {
    case '+': {
      let a = exoticOn && Math.random() < 0.45 ? powerOperand(cfg, 1, v - 1) : null;
      if (a == null) a = ri(1, v - 1);
      const [l, r] = split(rest);
      return { t: 'b', op, a: build(a, l, cfg), b: build(v - a, r, cfg), v };
    }
    case '−': {
      let a = exoticOn && Math.random() < 0.5 ? powerOperand(cfg, v + 1, cfg.cap) : null;
      if (a == null) a = v + ri(1, cfg.cap - v);
      const [l, r] = split(rest);
      return { t: 'b', op, a: build(a, l, cfg), b: build(a - v, r, cfg), v };
    }
    case '×': {
      const [a, b] = pick(factorPairs(v));
      const [l, r] = split(rest);
      return { t: 'b', op, a: build(a, l, cfg), b: build(b, r, cfg), v };
    }
    case '÷': {
      const b = ri(2, Math.min(9, Math.floor(cfg.cap / v)));
      const [l, r] = split(rest);
      return { t: 'b', op, a: build(v * b, l, cfg), b: build(b, Math.min(r, 1), cfg), v };
    }
    case 'sq':
      return { t: 'p', e: 2, base: build(Math.sqrt(v), cfg.deep ? rest : 0, cfg), v };
    case 'cube':
      return { t: 'p', e: 3, base: build(CUBES[v], cfg.deep ? rest : 0, cfg), v };
    case 'pow': {
      const [b, e] = pick(POWERS[v]);
      return { t: 'p', e, base: num(b), v };
    }
    case 'sqrt':
      return { t: 'r', k: 2, a: build(v * v, cfg.deep ? rest : Math.min(rest, 1), cfg), v };
    case 'cbrt':
      return { t: 'r', k: 3, a: build(v ** 3, cfg.deep ? rest : 0, cfg), v };
  }
  return num(v);
}

/* ===================== rendering (minimal brackets) ===================== */
const PREC = { '+': 1, '−': 1, '×': 2, '÷': 2 };

function render(n, stats) {
  if (n.t === 'n') return String(n.v);
  if (n.t === 'p') {
    const base = n.base.t === 'n' ? String(n.base.v) : `(${render(n.base, stats)})`;
    if (n.base.t !== 'n') stats.parens++;
    return base + sup(n.e);
  }
  if (n.t === 'r') {
    const inner = n.a.t === 'n' ? String(n.a.v) : `(${render(n.a, stats)})`;
    if (n.a.t !== 'n') stats.parens++;
    return (n.k === 2 ? '√' : '∛') + inner;
  }
  const p = PREC[n.op];
  const side = (child, right) => {
    const s = render(child, stats);
    if (child.t !== 'b') return s;
    const cp = PREC[child.op];
    // a − (b + c) and a ÷ (b × c) need brackets; a + (b − c) and a × (b ÷ c) don't
    const need = cp < p || (right && cp === p && (n.op === '−' || n.op === '÷'));
    if (need) stats.parens++;
    return need ? `(${s})` : s;
  };
  return `${side(n.a, false)} ${n.op} ${side(n.b, true)}`;
}

/* ===================== difficulty (rating scale) ===================== */
const W = { '+': 70, '−': 90, '×': 170, '÷': 200 };
// squares, cubes and other powers: [kind, difficulty]
const EXPONENT_COST = { 2: ['sq', 320], 3: ['cube', 400] };

function score(n, acc) {
  if (n.t === 'n') return;
  if (n.t === 'b') {
    acc.kinds.add(n.op);
    acc.ops++;
    let w = W[n.op];
    const a = n.a.v;
    const b = n.b.v;
    if (n.op === '+' && Math.max(a, b) >= 10 && (a % 10) + (b % 10) >= 10) w += 40;   // carrying
    if (n.op === '−' && a >= 10 && a % 10 < b % 10) w += 40;                          // borrowing
    if (n.op === '×' && n.v >= 20) w += 40;
    if (n.op === '÷' && a >= 30) w += 40;
    acc.sum += w;
    score(n.a, acc);
    score(n.b, acc);
  } else if (n.t === 'p') {
    const [kind, cost] = EXPONENT_COST[n.e] ?? ['pow', 380];
    acc.kinds.add(kind);
    acc.ops++;
    acc.sum += cost + (n.base.t === 'n' ? 0 : 80);
    score(n.base, acc);
  } else {
    acc.kinds.add(n.k === 2 ? 'sqrt' : 'cbrt');
    acc.ops++;
    acc.sum += (n.k === 2 ? 330 + (n.a.v > 49 ? 50 : 0) : 430) + (n.a.t === 'n' ? 0 : 80);
    score(n.a, acc);
  }
}

const rate = (
  acc,
  parens
) => 450 + acc.sum + parens * 60 + Math.max(0, acc.kinds.size - 1) * 40 + (acc.ops >= 4 ? 60 : 0);

const APPLY = {
  '+': (a, b) => a + b,
  '−': (a, b) => a - b,
  '×': (a, b) => a * b,
  '÷': (a, b) => a / b,
};

// independent check: evaluate the tree exactly
export function evaluate(n) {
  if (n.t === 'n') return n.v;
  if (n.t === 'p') return evaluate(n.base) ** n.e;
  if (n.t === 'r') return Math.round(evaluate(n.a) ** (1 / n.k));
  const a = evaluate(n.a);
  const b = evaluate(n.b);
  return APPLY[n.op](a, b);
}

// kinds: the operations used ('+', '×', 'sqrt', 'pow', …) plus '()' for brackets
function generate(answer, cfg) {
  const steps = ri(cfg.steps[0], cfg.steps[1]);
  const tree = build(answer, steps, cfg);
  const stats = { parens: 0 };
  const text = render(tree, stats);
  const acc = { sum: 0, ops: 0, kinds: new Set() };
  score(tree, acc);
  const kinds = new Set(acc.kinds);
  if (stats.parens) kinds.add('()');
  return { text, answer, tree, difficulty: rate(acc, stats.parens), kinds };
}

const bandIndex = (target) => BANDS.findIndex((b) => target <= b.upTo);

// a band cut down to what the player has unlocked; featured operations are let in
// even where the band would not use them yet, so a fresh unlock shows up at once
function restrict(band, allow, feature) {
  if (!allow) return band;
  const ops = band.ops.filter((o) => allow.ops.includes(o));
  for (const f of feature ?? []) if (allow.ops.includes(f) && !ops.includes(f)) ops.push(f);
  const hi = Math.min(band.steps[1], allow.steps);
  return { ...band, ops: ops.length ? ops : allow.ops, steps: [Math.min(band.steps[0], hi), hi] };
}

// A problem whose difficulty is close to `target`, with the given answer (0–9),
// avoiding any text in `avoid`. Draws a batch of candidates and keeps the closest.
//   allow:   { ops, steps, brackets } — what the player has unlocked (default: everything)
//   feature: kinds to show off (a fresh unlock); candidates without one rank far behind
export function makeProblem(target, { answer = ri(0, 9), avoid = new Set(), allow = null, feature = null } = {}) {
  const i = bandIndex(target);
  let best = null;
  let bestGap = Infinity;
  for (let k = 0; k < 32; k++) {
    const band = BANDS[Math.max(0, Math.min(BANDS.length - 1, i + (Math.random() < 0.3 ? pick([-1, 1]) : 0)))];
    const p = generate(answer, restrict(band, allow, feature));
    if (avoid.has(p.text) || p.text.length > 24 || p.text === String(answer)) continue;
    if (allow && !allow.brackets && p.kinds.has('()')) continue;
    let gap = Math.abs(p.difficulty - target) + Math.random() * 30;   // a little noise keeps the mix varied
    if (feature && !feature.some((f) => p.kinds.has(f))) gap += 250;
    if (gap < bestGap) {
      best = p;
      bestGap = gap;
    }
  }
  return best ?? { text: `${answer} + 0`, answer, difficulty: 520, kinds: new Set(['+']) };
}
