// state.js — the shared state of the game. Every game module reads and writes the
// same `S`, so there is one place to look up what is going on right now.
import { store } from '../ui/ui.js';

export const SPAWN_Z = -58;        // where yokai appear, far down the path
export const HIT_Z = -0.6;         // where they reach the hero
export const MAX_HEARTS = 3;

export const S = {
  mode: 'loading',                 // loading | title | intro | playing | paused | caught | over
  t: 0,                            // game time (s), slowed down during the capture
  introT: 0, caughtT: 0,           // time since the run's intro / the capture began
  speed: 3,                        // how fast the hero runs (and the world scrolls)
  hearts: MAX_HEARTS, score: 0, distance: 0, banished: 0,
  combo: 0, maxCombo: 0,
  spawnTimer: 0,                   // seconds until the next yokai may appear
  pendingBoss: false,              // a rank trial is due
  trialHold: 0,                    // seconds to wait before it may start
  cooldown: 0,                     // the talisman is locked after a miss
  invuln: 0,                       // brief safety after being hit
  enemies: [],                     // yokai on the path (see enemies.js)
  ai: { reads: 0, fixed: 0, unclear: 0 },   // what the AI did this run (game-over card)
  best: store.get('best', 0),
  bestRank: store.get('bestRank', 0),       // a record only: every run starts at the lowest rank
  tut: null,                       // the tutorial while it runs (see tutorial.js)
  // powers.js: the skill charge (0–1) and the skill it offers, skills still running,
  // the night ({ id, state, t }) and where the next begins, and the finisher's slow motion
  charge: 0, skill: null, freeze: 0, lucky: 0, barrier: false,
  night: { id: 'night', state: 'on', t: 0 }, nextNightAt: 0, slowmo: 0,
};

// yokai the player can still answer: not dying, not already hit, not in the capture scene
export const targets = () => S.enemies.filter((e) => !e.dying && !e.locked && !e.swarm);
