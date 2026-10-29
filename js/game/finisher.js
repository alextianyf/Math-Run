// finisher.js — the trial oni's last answer: slow motion, a zoom punch, a circle under
// it, a pillar of light, lightning all round, and every other yokai on screen swept away.
import * as THREE from 'three';
import { sfx } from '../ui/audio.js';
import { banner } from '../ui/popups.js';
import { S, targets } from '../core/state.js';
import { world, hero, fx } from './stage.js';
import { emit } from '../core/events.js';
import { later } from '../core/schedule.js';
import { $, restartAnimation } from '../core/dom.js';
import { t } from '../core/i18n.js';

function groundRings(ground) {
  for (let i = 0; i < 3; i++) {
    const color = i === 1 ? 0xff5a3a : 0xffb040;
    later(i * 0.12, () => fx.ring(ground, { color, scale: 4 + i * 2, dur: 0.6 }));
  }
}

function lightningRing(p) {
  for (let i = 0; i < 8; i++) {
    later(0.05 + i * 0.07, () => {
      const a = (i / 8) * Math.PI * 2;
      const hit = new THREE.Vector3(p.x + Math.cos(a) * 2.4, 0.2, p.z + Math.sin(a) * 2.4);
      const from = new THREE.Vector3(hit.x * 0.6, 14, hit.z - 3);
      const color = i % 2 ? 0xffb040 : 0x9fd0ff;
      fx.bolt(from, hit, { width: 0.18, dur: 0.4, color, sparks: 8 });
      if (i % 3 === 0) sfx.thunder();
    });
  }
}

// oni: the enemy just beaten; then: called once the show is over
export function finisher(oni, then) {
  const p = oni.yokai.center(new THREE.Vector3());
  const ground = new THREE.Vector3(p.x, 0.06, p.z);
  S.slowmo = 1.5;
  world.punch(1.3);
  world.shake(0.9);
  hero.cast();
  sfx.finisher();
  restartAnimation($('vignette'), 'flash');
  const html = `<span class="fin-kanji">${t('finisher')}</span><span class="fin-sub">${t('finisherSub')}</span>`;
  banner('', 'finisher', 2, { html, ms: 1700 });

  S.spawnTimer = Math.max(S.spawnTimer, 2.5);      // nothing new walks in during the finisher
  fx.magicCircle(ground, { color: 0xff4a2a, scale: 11, dur: 2.2, ground: true, spin: 3, bright: 1.8 });
  fx.magicCircle(ground.clone().setY(0.08), { color: 0xffb040, scale: 7, dur: 2, ground: true, spin: -4, bright: 1.6 });
  fx.pillar(p, { color: 0xff7a2a, radius: 1.3, height: 18, dur: 1.4 });
  later(0.35, () => fx.seal(p, '滅', 2));
  groundRings(ground);
  fx.emit(p, {
    count: 120,
    color: 0xffc85a,
    color2: 0xff4a2a,
    bright: 1.7,
    speed: 12,
    life: 1.4,
    size: 0.35,
    gravity: -3,
  });
  fx.emit(p, {
    count: 60,
    color: 0x8fe8ff,
    color2: 0xb47dff,
    bright: 1.6,
    speed: 3,
    life: 2,
    size: 0.28,
    gravity: 2.5,
    up: 0.6,
    dragK: 2,
  });
  lightningRing(p);
  // the shockwave sweeps the rest of the path (combat.js banishes each one)
  for (const enemy of targets()) {
    if (enemy !== oni) later(0.3 + Math.random() * 0.3, () => emit('sweep', { enemy }));
  }
  later(1.1, then);
}
