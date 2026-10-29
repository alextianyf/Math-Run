// capture.js — the cinematic when the last heart is lost: the parade circles the
// hero, a portal opens and the great oni rises out of it, grabs him and laughs.
import * as THREE from 'three';
import { createYokai } from '../scene/yokai.js';
import { takeOni, releaseOni } from '../scene/oni.js';
import { sfx, stopMusic } from '../ui/audio.js';
import { clearTags } from '../ui/tags.js';
import { S } from '../core/state.js';
import { world, hero, fx } from './stage.js';
import { removeEnemy } from './enemies.js';
import { pad } from './handwriting.js';
import { easeOut } from '../core/math.js';

const CAPTOR_SCALE = 1.45;
// timeline: seconds (real time) since the last heart was lost
const CAPTURE = { kneel: 0.3, camera: 0.45, portal: 1.0, risen: 2.3, reach: 3.2, grab: 3.9, attach: 4.05, lift: 4.35, laugh: 5.1, over: 5.6 };
const ORDER = Object.keys(CAPTURE);

const captor = { oni: null, step: 0, holding: false };
const portalPos = new THREE.Vector3(0, 0.06, -3);
const tmp = new THREE.Vector3();
// the hero in the fist: where the grip puts him, and where he was snatched from
const hold = { t: 1, pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fromPos: new THREE.Vector3(), fromQuat: new THREE.Quaternion() };
const twist = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);

export function beginCapture() {
  S.mode = 'caught';
  S.caughtT = 0;
  captor.step = 0;
  stopMusic();
  pad.clear();
  pad.setEnabled(false);
  clearTags();
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
  const types = ['onibi', 'chochin', 'kasa', 'hitotsume', 'kappa', 'kitsunebi'];
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
  // place the oni so that its closing fist lands right round the kneeling hero's waist
  oni.setMode('grab');
  oni.snap(S.t);
  oni.root.position.set(0, 0, -3);
  oni.root.updateMatrixWorld(true);
  const feet = oni.holdTransform(new THREE.Vector3(), new THREE.Quaternion());
  oni.root.position.x -= feet.x - hero.root.position.x;
  oni.root.position.z -= feet.z - hero.root.position.z;
  oni.setMode('idle');
  oni.snap(S.t);
}

// once grabbed, the hero follows the oni's fist but stays upright, legs kicking
function grabHero() {
  captor.holding = true;
  hero.setMode('grabbed');
  // snatched up off his knees into the closing fist over a quarter second
  hold.t = 0;
  hold.fromPos.copy(hero.root.position);
  hold.fromQuat.copy(hero.root.quaternion);
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
    // waist in the palm, fingers round his front, thumb round his back (see oni.js GRIP)
    captor.oni.holdTransform(hold.pos, hold.quat);
    hold.quat.multiply(twist.setFromAxisAngle(UP, Math.sin(S.t * 3.1) * 0.1));   // squirming
    hold.t = Math.min(1, hold.t + dt / 0.25);
    const k = easeOut(hold.t);
    hero.root.position.lerpVectors(hold.fromPos, hold.pos, k);
    hero.root.quaternion.slerpQuaternions(hold.fromQuat, hold.quat, k);
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
  hold.t = 1;
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
