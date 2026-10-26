// enemies.js — the yokai on the path: when and where they appear, how they move
// toward the hero, and the equation tags that float above them.
import * as THREE from 'three';
import { LANES } from '../scene/world.js';
import { createYokai } from '../scene/yokai.js';
import { sfx } from '../ui/audio.js';
import * as ui from '../ui/ui.js';
import { S, SPAWN_Z, HIT_Z, targets } from './state.js';
import { world, fx, director } from './stage.js';
import { showRank } from './progress.js';
import { emit } from './events.js';
import { rand, easeOutBack, smooth01 } from './helpers.js';

// × travel time: the slower ones give a little more thinking time
const TYPE_PACE = { onibi: 1, chochin: 1.08, hitotsume: 1.04, kappa: 1.12, kitsunebi: 0.92, kasa: 0.94, ittan: 0.9, hyakume: 1.15, nekomata: 1.0, oni: 2.3 };
// who walks the path: the common three from the start, the rest after enough banishments
const ROSTER = [
  { type: 'onibi', weight: 3, from: 0 }, { type: 'chochin', weight: 2, from: 0 }, { type: 'hitotsume', weight: 2, from: 0 },
  { type: 'kappa', weight: 1.5, from: 4 }, { type: 'kitsunebi', weight: 1.5, from: 6 }, { type: 'kasa', weight: 1.5, from: 6 },
  { type: 'ittan', weight: 1.2, from: 10 }, { type: 'hyakume', weight: 1, from: 12 }, { type: 'nekomata', weight: 1.2, from: 8 },
];
const tmp = new THREE.Vector3();
const scr = { x: 0, y: 0, visible: true };

function pickType() {
  const pool = ROSTER.filter((r) => S.banished >= r.from);
  let r = Math.random() * pool.reduce((sum, p) => sum + p.weight, 0);
  for (const p of pool) if ((r -= p.weight) < 0) return p.type;
  return 'onibi';
}

// prefer lanes with nothing near the spawn point, so equation tags don't overlap
function chooseLane() {
  const free = [0, 1, 2].filter((l) => !S.enemies.some((e) => e.lane === l && !e.dying && e.z < SPAWN_Z + 16));
  const pool = free.length ? free : [0, 1, 2];
  return pool[Math.floor(Math.random() * pool.length)];
}

// boss: a rank-trial oni (several problems in a row).
// forced: { type, lane, text, answer, z, speed, x?, free? } — a scripted yokai (the
// tutorial, the daily challenge); free: the caller moves it itself
export function spawn(boss = false, forced = null) {
  const type = forced?.type ?? (boss ? 'oni' : pickType());
  const lane = forced?.lane ?? (boss ? 1 : chooseLane());
  const live = targets();
  // ~30%: reuse an answer already on screen (different expression) → multi-banish chance
  const reuse = live.length && Math.random() < 0.3 ? live[Math.floor(Math.random() * live.length)].answer : undefined;
  const prob = forced ?? director.nextProblem({ answer: reuse, avoid: new Set(live.map((e) => e.text)), boss });
  const z0 = forced?.z ?? SPAWN_Z;

  // drift in from the forest on either side, settling into the lane as it approaches
  // (keeps far-away tags apart, where perspective squeezes the lanes together)
  const side = lane === 1 ? (Math.random() < 0.5 ? -1 : 1) : lane - 1;
  const x0 = forced?.x ?? (boss ? 0 : LANES[lane] + side * rand(3, 4.5));
  const yokai = createYokai(type);
  yokai.root.position.set(x0, 0, z0);
  yokai.root.scale.setScalar(0.01);
  world.scene.add(yokai.root);

  const hpTotal = boss ? 3 + (director.rank >= 3 ? 1 : 0) : 1;
  const qTravel = forced ? 1 : director.travelTime(prob);     // thinking time this problem deserves
  const e = {
    yokai, lane, boss, x0,
    z: z0,
    speed: forced?.speed ?? (HIT_Z - SPAWN_Z) / (qTravel * TYPE_PACE[type]),
    problem: prob, qStart: 0, qTravel,
    answer: prob.answer, text: prob.text,
    tag: ui.createTag(prob.text, { boss, hp: hpTotal, stretch: prob.stretch }),
    hpDone: 0, hpTotal,
    locked: false, dying: 0, age: 0, sx: 0, sy: 0, offY: 0, free: !!forced?.free,
  };
  measureTag(e);
  S.enemies.push(e);
  emit('meet', { type });
  fx.emit(yokai.center(tmp), { count: boss ? 50 : 22, color: 0x7a3dff, color2: 0x1a0c33, bright: 1, speed: boss ? 4 : 2.5, life: 1, size: boss ? 0.9 : 0.5, gravity: 0.6, up: 0.3 });

  if (boss) {
    ui.banner(ui.t('trial'), 'boss', 2);
    sfx.boss();
    world.shake(0.25);
    showRank();
  }
  return e;
}

// the tag's size on screen, used to keep tags from overlapping
export function measureTag(e) {
  e.tw = e.tag.offsetWidth;
  e.th = e.tag.offsetHeight + 10;   // + rope above the plaque
}

export function removeEnemy(e) {
  const i = S.enemies.indexOf(e);
  if (i >= 0) S.enemies.splice(i, 1);     // first, so a failure below can't wedge the loop
  world.scene.remove(e.yokai.root);
  if (e.tag) ui.removeTag(e.tag);
  e.yokai.dispose();
}

export function clearEnemies() {
  for (const e of [...S.enemies]) removeEnemy(e);
  ui.clearTags();
  fx.clear();
}

// Send the next yokai when it's time (the director decides how often), and a
// rank-trial boss as soon as one is due.
export function updateSpawner(dt) {
  const bossAlive = S.enemies.some((e) => e.boss && !e.dying);
  const alive = S.enemies.filter((e) => !e.dying).length;
  if (alive === 0) S.spawnTimer = Math.min(S.spawnTimer, 0.8);
  S.spawnTimer -= dt;
  S.trialHold -= dt;
  if (S.pendingBoss && !bossAlive && S.trialHold <= 0) {
    S.pendingBoss = false;
    spawn(true);
    S.spawnTimer = director.spawnInterval() * 1.5;
  } else if (S.spawnTimer <= 0 && alive < director.maxAlive() - (bossAlive ? 1 : 0)) {
    spawn(false);
    S.spawnTimer = director.spawnInterval() * rand(0.85, 1.2);
  }
}

// Move every yokai and its tag. onReachHero(e) is called when one gets through.
export function updateEnemies(dt, onReachHero) {
  const moving = (S.mode === 'playing' || (S.mode === 'intro' && S.tut)) && !S.tut?.frozen;
  const shown = [];
  for (const e of [...S.enemies]) {
    e.yokai.update(dt, S.t);
    const root = e.yokai.root;
    if (e.dying) {
      // banished: spin, swell and shrink away
      e.dying += dt / 0.35;
      const k = Math.min(1, e.dying);
      root.scale.setScalar((1 + 0.4 * Math.sin(Math.PI * k)) * (1 - k * k));
      root.rotation.y += dt * 14;
      if (k >= 1) removeEnemy(e);
      continue;
    }
    e.age += dt;
    root.scale.setScalar(Math.max(0.01, easeOutBack(e.age / 0.45)));

    if (e.swarm) {
      // capture: a half-ring around the hero's sides and back (never between him
      // and the camera), drifting back and forth and facing him
      const a = Math.PI * 1.08 + e.swarmA * 0.84 / (2 * Math.PI) * Math.PI + Math.sin(S.t * 0.8 + e.swarmA * 3) * 0.12;
      const r = 2.8 + Math.sin(S.t * 1.7 + e.swarmA) * 0.25;
      const k = 1 - Math.exp(-dt * 2.2);
      root.position.x += (Math.cos(a) * r - root.position.x) * k;
      root.position.z += (Math.sin(a) * r * 0.8 - 0.4 - root.position.z) * k;
      root.rotation.y = Math.atan2(-root.position.x, -root.position.z);
      continue;
    }
    if (e.free) {
      e.z = root.position.z;             // placed by its owner (the daily challenge)
    } else {
      if (moving) {
        e.z += e.speed * dt;
        if (!e.locked && e.z >= HIT_Z) { onReachHero(e); continue; }
      }
      const near = (e.z - SPAWN_Z) / (HIT_Z - SPAWN_Z);   // 0 at spawn → 1 at the hero
      root.position.z = e.z;
      root.position.x = e.x0 + (LANES[e.lane] - e.x0) * smooth01(near * 1.7);
    }
    const near = (e.z - SPAWN_Z) / (HIT_Z - SPAWN_Z);
    if (!e.tag) continue;
    world.project(e.yokai.labelAnchor(tmp), scr);
    shown.push({ e, x: scr.x, y: scr.y, scale: 0.62 + near * 0.55, visible: scr.visible });
  }
  placeTags(shown, dt, moving);
}

// Keep equation tags readable: the nearest yokai keep their spot, farther tags
// that would overlap are nudged upward (eased so they don't jitter).
function placeTags(shown, dt, moving) {
  shown.sort((a, b) => b.e.z - a.e.z);
  const placed = [];
  for (const v of shown) {
    if (!v.e.tag) continue;           // the capture cleared the tags during this frame
    const w = v.e.tw * v.scale, h = v.e.th * v.scale;
    let y = v.y;
    for (let pass = 0; pass < 5; pass++) {
      let moved = false;
      for (const p of placed) {
        if (Math.abs(v.x - p.x) < (w + p.w) / 2 + 4 && y > p.y - p.h - 4 && y - h < p.y + 4) {
          y = p.y - p.h - 6;
          moved = true;
        }
      }
      if (!moved) break;
    }
    v.e.offY += (y - v.y - v.e.offY) * Math.min(1, dt * 12);
    placed.push({ x: v.x, y: v.y + v.e.offY, w, h });

    const e = v.e;
    e.sx = v.x; e.sy = v.y + e.offY;
    const timeLeft = (HIT_Z - e.z) / e.speed;
    ui.placeTag(e.tag, e.sx, e.sy, v.scale, v.visible ? Math.min(1, e.age / 0.6) : 0,
      moving && !e.locked && timeLeft < 2.3);
  }
}
