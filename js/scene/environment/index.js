// environment/ — the night shrine: sky & mountains, a scrolling stone path,
// torii with shimenawa ropes, festival lantern strings, stone lanterns, cedars and
// night sakura, falling petals, fireflies and ground mist. Props are instanced and
// slide toward +z, wrapping back to the far end.
import { glow } from '../toon.js';
import { petalTex } from '../textures.js';
import { NEAR, SPAN } from './shared.js';
import { rand } from '../../core/math.js';
import { buildSky } from './sky.js';
import { buildGround } from './ground.js';
import { buildTorii } from './torii.js';
import { buildLanternStrings, buildStoneLanterns } from './lanterns.js';
import { buildTrees } from './trees.js';
import { buildParticles, buildMist, buildFogBanks, buildFoxfire } from './particles.js';

export { FOG_COLOR } from './shared.js';

export function createEnvironment(scene) {
  const sky = buildSky(scene);
  const torii = buildTorii(scene);
  const mist = buildMist(scene);
  const banks = buildFogBanks(scene);
  const foxfire = buildFoxfire(scene);
  const ground = buildGround(scene);
  const parts = [
    ground,
    torii,
    buildLanternStrings(scene),
    buildStoneLanterns(scene),
    buildTrees(scene),
    mist,
    banks,
    foxfire,
  ];
  const particles = [
    buildParticles(scene, {
      count: 140, size: 0.3, color: glow(0xd9ff8f, 1.6), additive: true, drift: 0.4,
      area: (i) => [(i % 2 ? 1 : -1) * rand(1, 14), rand(0.4, 4.6), NEAR - Math.random() * SPAN],
    }),
    buildParticles(scene, {
      count: 300, size: 0.28, color: 0xff2a3a, additive: false,
      area: (i) => [
        (i % 2 ? 1 : -1) * (Math.random() < 0.7 ? rand(4.4, 5.0) : rand(5.2, 8)),
        rand(0.12, 0.3),
        NEAR - Math.random() * SPAN,
      ],
    }),
    buildParticles(scene, {
      count: 260, size: 0.16, color: 0xffd0e2, additive: false, map: petalTex(), fall: 0.45, drift: 0.5,
      area: () => [rand(-9, 9), rand(0.2, 5), NEAR - Math.random() * SPAN],
    }),
  ];
  return {
    // what a change of night recolours: sky, moon, clouds, ground mist, fog banks, foxfire, fireflies and the ground underfoot
    look: { ...sky.look, mist: mist.materials, fireflies: particles[0].material, banks, foxfire, ground: ground.look },
    // arches overhead would fill the play camera's view right after passing the runner
    set hideToriiBeyond(z) { torii.hideZ = z; },
    step(dz, t, dt) {
      sky.step(dt);
      for (const p of parts) p.step(dz, t);
      for (const p of particles) p.step(dz, t, dt);
    },
  };
}
