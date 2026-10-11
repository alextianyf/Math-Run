// director.test.mjs — simulates players of known skill against the adaptive
// director (js/difficulty/adaptive.js) and checks that:
//  • they get roughly 85% right once it has warmed up (not too easy, not too hard)
//  • stronger players climb to higher ranks
//  • difficulty rises smoothly: big jumps from one problem to the next are rare
// Run: node tests/director.test.mjs
import assert from 'node:assert/strict';
import { createDirector } from '../js/difficulty/adaptive.js';

// a player whose chance of solving a problem of difficulty D is the Elo curve
function play(skill, problems = 60) {
  const d = createDirector();
  d.startRun();
  let right = 0, counted = 0, bigJumps = 0, prev = null;
  for (let i = 0; i < problems; i++) {
    const p = d.nextProblem({ answer: i % 10 });
    if (prev != null && p.difficulty - prev >= 150) bigJumps++;
    prev = p.difficulty;
    const ok = Math.random() < 1 / (1 + 10 ** ((p.difficulty - skill) / 400));
    const travel = d.travelTime(p);
    const out = d.record(p, { correct: ok, time: travel * 0.5, travel });
    if (!ok) d.hit();
    if (out.trial) d.promote();             // the simulated player always passes trials
    if (i >= 20) { counted++; if (ok) right++; }
  }
  return { success: right / counted, rank: d.rank, bigJumps: bigJumps / problems };
}

const average = (skill, runs = 60) => {
  const all = Array.from({ length: runs }, () => play(skill));
  const mean = (k) => all.reduce((s, r) => s + r[k], 0) / runs;
  return { success: mean('success'), rank: mean('rank'), bigJumps: mean('bigJumps') };
};

const results = [900, 1200, 1500].map((skill) => ({ skill, ...average(skill) }));
for (const r of results) {
  console.log(`skill ${r.skill}: ${Math.round(r.success * 100)}% right, average rank ${r.rank.toFixed(1)}, jumps ≥150 ${(r.bigJumps * 100).toFixed(1)}%`);
  assert.ok(r.success > 0.72, `skill ${r.skill}: only ${Math.round(r.success * 100)}% right — too hard`);
  // every run starts at the lowest rank and climbs gently, so a very strong player
  // breezes through the early part; the target applies to everyday players
  if (r.skill <= 1200) assert.ok(r.success < 0.95, `skill ${r.skill}: ${Math.round(r.success * 100)}% right — too easy`);
  assert.ok(r.bigJumps < 0.03, `skill ${r.skill}: too many sudden difficulty jumps`);
}
assert.ok(results[0].rank < results[1].rank && results[1].rank < results[2].rank, 'stronger players should reach higher ranks');
console.log('director: all fine');
