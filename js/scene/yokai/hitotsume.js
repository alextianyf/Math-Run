// hitotsume.js — 一つ目小僧 one-eyed little monk in a straw hat, hops
import * as THREE from 'three';
import { toon, bake, joint, lathe, taperedTube } from '../toon.js';
import { once, tongue, darkWood, skin, maw, eyeParts, glowSprite } from './shared.js';

export function buildHitotsume(body) {
  const robe = once('robe', () => toon(0x34477f));
  const straw = once('straw', () => toon(0xd9b561));
  const hop = new THREE.Group();            // everything above the feet rises with the hop
  body.add(hop);
  hop.add(bake([
    // straw hat
    { geo: new THREE.ConeGeometry(0.46, 0.17, 14, 1, true), mat: straw, p: [0, 0.4, 0] },
    { geo: new THREE.CylinderGeometry(0.04, 0.05, 0.06, 8), mat: darkWood(), p: [0, 0.49, 0] },
    // bald head and the robe below it, tied with a red sash
    { geo: new THREE.SphereGeometry(0.3, 20, 16), mat: skin(), p: [0, 0.1, 0] },
    { geo: lathe([[0.14, -0.14], [0.27, -0.4], [0.32, -0.66], [0.28, -0.7]], 16), mat: robe },
    { geo: new THREE.BoxGeometry(0.58, 0.06, 0.5), mat: once('sash', () => toon(0xd8322a)), p: [0, -0.4, 0] },
    { geo: new THREE.CapsuleGeometry(0.05, 0.18, 4, 8), mat: robe, p: [-0.3, -0.3, 0.05], r: [0, 0, 1.2] },
    { geo: new THREE.CapsuleGeometry(0.05, 0.18, 4, 8), mat: robe, p: [0.3, -0.3, 0.05], r: [0, 0, -1.2] },
    // a wide grin
    { geo: new THREE.SphereGeometry(0.11, 14, 8), mat: maw(), p: [0, -0.06, 0.26], s: [1.3, 0.4, 0.4] },
  ], { outline: 0.014 }));
  // the one eye (its own joint, so it can blink) and a tongue
  const eye = joint(hop, 0, 0.12, 0.24);
  eye.add(bake(eyeParts(0, 0, 0, 0.13, once('irisBrown', () => toon(0x4a2a12)), 1.15), { outline: 0.01 }));
  const tongueJ = joint(hop, 0, -0.08, 0.3);
  tongueJ.add(bake([{ geo: taperedTube([[0, 0, 0], [0.01, -0.1, 0.08], [0.03, -0.24, 0.06], [0.0, -0.36, 0.0]], 0.045, { tip: 0.5 }), mat: tongue() }], { outline: 0.01 }));
  body.add(bake([
    { geo: new THREE.SphereGeometry(0.09, 10, 8), mat: skin(), p: [-0.13, -0.74, 0.05], s: [1, 0.5, 1.3] },
    { geo: new THREE.SphereGeometry(0.09, 10, 8), mat: skin(), p: [0.13, -0.74, 0.05], s: [1, 0.5, 1.3] },
  ], { outline: 0.012 }));
  body.add(glowSprite(0xffd27a, 1.6, 0.22));
  return (t, seed, self) => {
    const k = Math.abs(Math.sin(t * 2.6 + seed));
    self.hop = k * 0.3;
    hop.position.y = k * 0.04;
    hop.rotation.z = Math.sin(t * 2.6 + seed) * 0.08;
    hop.rotation.y = Math.sin(t * 0.8 + seed) * 0.25;
    eye.scale.y = (t + seed) % 3.1 < 0.14 ? 0.1 : 1;         // a blink now and then
    tongueJ.rotation.z = Math.sin(t * 4 + seed) * 0.3;
  };
}
