// problems.js — equation generator. Every answer is a single digit (0–9) so it
// can be handwritten in one go and read by the MNIST model.
//
// makeProblem(tier, answer?) lets the game ask for a *specific* answer, which is
// how it sets up "same value, different expression" pairs for multi-banishes.

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);

// Each generator takes the target answer and returns display text, or null if
// that answer can't be expressed nicely with this operation.
const OPS = {
  add(ans) {
    const a = ri(0, ans);
    return `${a} + ${ans - a}`;
  },
  sub(ans) {
    const b = ri(0, 9 - ans);
    return `${ans + b} − ${b}`;
  },
  subBig(ans) {
    const b = ri(4, 13);
    return `${ans + b} − ${b}`;
  },
  mul(ans) {
    const pairs = { 0: [[0, ri(1, 9)], [ri(1, 9), 0]], 2: [[1, 2], [2, 1]], 4: [[2, 2], [1, 4]], 6: [[2, 3], [3, 2]], 8: [[2, 4], [4, 2]], 9: [[3, 3]] }[ans];
    if (!pairs) return null;
    const [a, b] = pairs[ri(0, pairs.length - 1)];
    return `${a} × ${b}`;
  },
  div(ans) {
    const b = ri(2, 5);
    return `${ans * b} ÷ ${b}`;
  },
  divBig(ans) {
    const b = ri(3, 9);
    return `${ans * b} ÷ ${b}`;
  },
  addSub(ans) {                       // a + b − c
    const c = ri(1, 9), s = ans + c;
    if (s < 2 || s > 18) return null;
    const a = ri(Math.max(1, s - 9), Math.min(9, s - 1));
    return `${a} + ${s - a} − ${c}`;
  },
  mulSub(ans) {                       // a × b − c
    for (let tries = 0; tries < 12; tries++) {
      const a = ri(2, 6), b = ri(2, 6), c = a * b - ans;
      if (c >= 1 && c <= 12) return `${a} × ${b} − ${c}`;
    }
    return null;
  },
  mulAdd(ans) {                       // a × b + c
    const opts = [[2, 2], [2, 3], [3, 2], [2, 4], [4, 2], [3, 3]].filter(([a, b]) => a * b < ans);
    if (!opts.length) return null;
    const [a, b] = opts[ri(0, opts.length - 1)];
    return `${a} × ${b} + ${ans - a * b}`;
  },
  divAdd(ans) {                       // a ÷ b + c
    if (ans < 2) return null;
    const q = ri(1, ans - 1), b = ri(2, 6);
    return `${q * b} ÷ ${b} + ${ans - q}`;
  },
  groupDiv(ans) {                     // (a + b) ÷ c
    if (ans < 1) return null;
    const c = ri(2, 4), s = ans * c;
    const a = ri(1, s - 1);
    return `(${a} + ${s - a}) ÷ ${c}`;
  },
};

const TIERS = {
  1: ['add', 'sub'],
  2: ['add', 'sub', 'mul', 'div'],
  3: ['subBig', 'mul', 'divBig', 'addSub', 'div'],
  4: ['subBig', 'divBig', 'addSub', 'mulSub', 'mulAdd', 'divAdd', 'groupDiv'],
};

export function makeProblem(tier, answer = ri(0, 9), avoid = new Set()) {
  const ops = TIERS[Math.min(4, Math.max(1, tier))];
  for (let attempt = 0; attempt < 30; attempt++) {
    for (const op of shuffle(ops)) {
      const text = OPS[op](answer);
      if (text && !avoid.has(text)) return { text, answer };
    }
  }
  return { text: OPS.add(answer), answer };
}
