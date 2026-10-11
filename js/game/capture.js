// capture.js — the cinematic when the last heart is lost: the parade circles the
// hero, a portal opens and the great oni rises out of it, grabs him and laughs.
import * as THREE from 'three';
import { createYokai } from '../scene/yokai.js';
import { takeOni, releaseOni } from '../scene/oni.js';
import { sfx, stopMusic } from '../ui/audio.js';
import * as ui from '../ui/ui.js';
import { S } from './state.js';
import { world, hero, fx } from './stage.js';
import { removeEnemy } from './enemies.js';
import { pad } from './handwriting.js';
import { easeOut } from './helpers.js';

const CAPTOR_SCALE = 1.45;
// timeline: seconds (real time) since the last heart was lost
const CAPTURE = { kneel: 0.3, camera: 0.45, portal: 1.0, risen: 2.3, reach: 3.2, grab: 3.9, attach: 4.05, lift: 4.35, laugh: 5.1, over: 5.6 };
const ORDER = Object.keys(CAPTURE);

const captor = { oni: null, step: 0, holding: false };
const portalPos = new THREE.Vector3(0, 0.06, -3);
const palm = new THREE.Vector3();
const tmp = new THREE.Vector3();

export function beginCapture() {
  S.mode = 'caught';
  S.caughtT = 0;
  captor.step = 0;
  stopMusic();
  pad.clear();
  pad.setEnabled(false);
  ui.clearTags();
  document.body.classList.add('cinematic');

  // the parade gathers: survivors circle the hero, bosses vanish into smoke,
  // and a few more yokai materialise so the circle is always full
  for (const e of [...S.enemies]) {
    if (e.boss || e.dying) {
      fx.emit(e.yokai.center(tmp), { count: 40, color: 0x7a3dff, color2: 0x1a0c33, bright: 1, speed: 3, life: 1, size: 0.8, gravity: 0.5 });
      removeEnemy(e);
      continue;
    }
    e.tag = null;
    e.swarm = true;
  }
  const types = ['onibi', 'chochin', 'kasa', 'onibi', 'chochin', 'onibi'];
  while (S.enemies.length < 6) {
    const yokai = createYokai(types[S.enemies.length]);
    const a = Math.random() * Math.PI * 2;
    yokai.root.position.set(Math.cos(a) * 6, 0, Math.sin(a) * 6 - 1);
    yokai.root.scale.setScalar(0.01);
    world.scene.add(yokai.root);
    S.enemies.push({ yokai, swarm: true, locked: true, dying: 0, age: 0, z: 0, tag: null });
  }
  S.enemies.forEach((e, i) => { e.swarmA = (i / S.enemies.length) * Math.PI * 2; });
}

function spawnCaptor() {
  const oni = takeOni();
  captor.oni = oni;
  oni.root.scale.setScalar(CAPTOR_SCALE);
  world.scene.add(oni.root);
  // place the oni so that its grabbing hand lands right on the kneeling hero
  oni.setMode('grab');
  oni.snap(S.t);
  oni.root.position.set(0, 0, -3);
  oni.root.updateMatrixWorld(true);
  const hand = oni.handR.localToWorld(new THREE.Vector3(0, -0.2, 0));
  oni.root.position.x -= hand.x;
  oni.root.position.z -= hand.z - 0.05;
  oni.setMode('idle');
  oni.snap(S.t);
}

// once grabbed, the hero follows the oni's fist but stays upright, legs kicking
function grabHero() {
  captor.holding = true;
  hero.setMode('grabbed');
}

// Plays the timeline; returns true once it's time for the game-over card.
export function updateCapture(dt) {
  const T = S.caughtT += dt;
  const at = (key) => captor.step < ORDER.indexOf(key) + 1 && T >= CAPTURE[key];
  let over = false;
  if (at('kneel')) { captor.step++; hero.setMode('kneel'); }
  if (at('camera')) { captor.step++; world.setCameraMode('caught'); }
  if (at('portal')) {
    captor.step++;
    spawnCaptor();
    portalPos.set(captor.oni.root.position.x, 0.06, captor.oni.root.position.z);
    fx.magicCircle(portalPos, { color: 0x9a4dff, scale: 7, dur: 4.2, ground: true, spin: 1.2, bright: 2.4 });
    world.shake(0.35);
    sfx.portal();
  }
  if (at('risen')) { captor.step++; captor.oni.roar(); world.shake(0.7); sfx.roar(); }
  if (at('reach')) { captor.step++; captor.oni.setMode('reach'); }
  if (at('grab')) { captor.step++; captor.oni.setMode('grab'); }
  if (at('attach')) { captor.step++; grabHero(); world.shake(0.3); sfx.grab(); }
  if (at('lift')) { captor.step++; captor.oni.setMode('lift'); world.setCameraMode('held'); }
  if (at('laugh')) { captor.step++; captor.oni.setMode('laugh'); sfx.laugh(); }
  if (at('over')) { captor.step++; over = true; }

  // the oni rising out of the portal in a column of smoke
  if (captor.oni) {
    const k = easeOut((T - CAPTURE.portal) / (CAPTURE.risen - CAPTURE.portal));
    captor.oni.root.position.y = -7 * (1 - k);
    if (k < 1) fx.emit(portalPos, { count: 4, color: 0x8a4dff, color2: 0x200c40, bright: 1.2, speed: 1.6, life: 1.2, size: 0.9, gravity: 1.6, up: 0.6, spread: 12 });
  }
  return over;
}

// every frame, in any mode: the oni's own animation, and the hero held in its fist
export function animateCaptor(dt) {
  if (!captor.oni) return;
  captor.oni.update(dt, S.t);
  if (captor.holding) {
    captor.oni.handR.localToWorld(palm.set(0, -0.16, 0));
    hero.root.position.set(palm.x, palm.y - 1.08, palm.z + 0.12);
    hero.root.rotation.set(0, 0, Math.sin(S.t * 3.1) * 0.12);
  }
}

// a tap or key during the cinematic jumps straight to the oni holding the hero;
// returns true when it did (time for the game-over card)
export function skipCapture() {
  if (S.mode !== 'caught' || S.caughtT < 0.4) return false;
  if (!captor.oni) spawnCaptor();
  captor.oni.root.position.y = 0;
  hero.setMode('kneel');
  captor.oni.setMode('grab');
  captor.oni.snap(S.t);
  grabHero();
  captor.oni.setMode('laugh');
  captor.oni.snap(S.t);
  world.setCameraMode('held', true);
  S.caughtT = CAPTURE.over;
  captor.step = ORDER.length;
  return true;
}

export function endCapture() {
  captor.holding = false;
  if (captor.oni) {
    releaseOni(captor.oni);
    captor.oni = null;
  }
  hero.reset();
  document.body.classList.remove('cinematic');
}
