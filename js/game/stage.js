// stage.js — the long-lived pieces every game module shares: the 3D world (with
// the hero in it), the spell effects and the difficulty director.
import * as THREE from 'three';
import { createWorld } from '../scene/world.js';
import { createFx } from '../scene/fx.js';
import { createYokai, YOKAI_TYPES } from '../scene/yokai/index.js';
import { takeOni, releaseOni } from '../scene/oni/index.js';
import { createDirector } from '../difficulty/adaptive.js';
import { $ } from '../core/dom.js';

export const world = createWorld($('scene'));
export const hero = world.hero;
export const fx = createFx(world.scene, world.camera);
export const director = createDirector();

// The GPU compiles a shader and uploads a model the first time it is drawn, and
// that frame stalls (the first yokai, the first cast, the first trial boss…). So
// while the page is still loading, everything is drawn once: the whole scene — even
// what the title camera can't see — plus one of every yokai, the oni and each spell
// effect, shrunk to an invisible speck. Those extras are then kept hidden: as long
// as they exist, their shaders stay compiled and their textures uploaded.
export function prewarm() {
  const warm = new THREE.Group();
  for (const type of YOKAI_TYPES) if (type !== 'oni') warm.add(createYokai(type).root);
  const oni = takeOni();
  warm.add(oni.root, ...fx.warmObjects());
  warm.scale.setScalar(1e-4);
  world.scene.add(warm);

  const culled = [];                     // draw every object, wherever the camera looks
  world.scene.traverse((o) => { if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; } });
  world.render();
  for (const o of culled) o.frustumCulled = true;

  warm.visible = false;
  releaseOni(oni);                       // back to the spare slot, ready for the first trial
}
