// problems.test.mjs — checks the problem generator (js/difficulty/problems.js):
//  • every problem's answer is right, and its text reads back to the same answer
//  • every step along the way is a whole number ≥ 0 (solvable in your head)
//  • each rank only gets the kinds of problems it has unlocked
// Run: node tests/problems.test.mjs
import assert from 'node:assert/strict';
import { makeProblem, evaluate } from '../js/difficulty/problems.js';
import { RANKS } from '../js/difficulty/adaptive.js';

// an independent reader for the rendered text: + − × ÷, brackets, ² ³ …, √ ∛
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
function read(text) {
  const s = text.replace(/ /g, '');
  let i = 0;
  const peek = () => s[i];
  const atom = () => {
    if (peek() === '(') { i++; const v = expr(); assert.equal(s[i++], ')', `bracket in ${text}`); return v; }
    let d = '';
    while (/[0-9]/.test(peek() ?? '')) d += s[i++];
    assert.ok(d, `unexpected "${peek()}" in ${text}`);
    return Number(d);
  };
  const factor = () => {
    if (peek() === '√' || peek() === '∛') { const k = s[i++] === '√' ? 2 : 3; return Math.round(atom() ** (1 / k)); }
    const v = atom();
    let e = '';
    while (i < s.length && SUP.includes(peek())) e += SUP.indexOf(s[i++]);
    return e ? v ** Number(e) : v;
  };
  const term = () => { let v = factor(); while (peek() === '×' || peek() === '÷') { const op = s[i++]; const r = factor(); v = op === '×' ? v * r : v / r; } return v; };
  const expr = () => { let v = term(); while (peek() === '+' || peek() === '−') { const op = s[i++]; const r = term(); v = op === '+' ? v + r : v - r; } return v; };
  const v = expr();
  assert.equal(i, s.length, `trailing input in ${text}`);
  return v;
}

const steps = (n, out = []) => {
  out.push(evaluate(n));
  for (const child of [n.a, n.b, n.base]) if (child) steps(child, out);
  return out;
};

let count = 0;
for (const [r, rank] of RANKS.entries()) {
  const allowed = new Set([...rank.allow.ops, ...(rank.allow.brackets ? ['()'] : [])]);
  const lo = rank.min ? rank.min - 300 : 400;
  const hi = (RANKS[r + 1]?.min ?? 1700) - 300 + 130;
  for (let target = lo; target <= hi; target += 25) {
    for (let k = 0; k < 30; k++) {
      const answer = k % 10;
      const p = makeProblem(target, { answer, allow: rank.allow, feature: k % 3 ? null : rank.unlock });
      count++;
      assert.equal(evaluate(p.tree), answer, `${p.text} should be ${answer}`);
      assert.equal(read(p.text), answer, `"${p.text}" reads back wrong`);
      for (const v of steps(p.tree)) assert.ok(Number.isInteger(v) && v >= 0, `${p.text} has a step ${v}`);
      for (const kind of p.kinds) {
        const ok = allowed.has(kind) || (kind === 'cube' && allowed.has('pow'));
        assert.ok(ok, `${rank.key} got "${kind}" in ${p.text}`);
      }
    }
  }
}
console.log(`problems: ${count} checked, all fine`);
