// nekomata.js — 猫又 two-tailed cat dancing on its hind legs
import * as THREE from 'three';
import { toon, bake, joint, lathe, taperedTube } from '../toon.js';
import { once, white, ink, maw, glowSprite } from './shared.js';

export function buildNekomata(body) {
  const fur = once('fur', () => toon(0xf2dcb4));
  const fur2 = once('fur2', () => toon(0x8a5a3a));
  const cloth = once('tenugui', () => toon(0xd8322a));
  const gold = once('catEye', () => toon(0xf2c23a, { emissive: 0x4a3000 }));
  const torso = new THREE.Group();
  body.add(torso);
  torso.add(bake([
    // standing on its hind legs: a pear-shaped body, a round head with pointed ears
    { geo: lathe([[0.0, -0.5], [0.24, -0.46], [0.3, -0.2], [0.24, 0.05], [0.12, 0.14]], 16), mat: fur },
    { geo: new THREE.SphereGeometry(0.2, 14, 10), mat: fur2, p: [0, -0.2, -0.18], s: [1.1, 1.1, 0.5] },   // darker back
    { geo: new THREE.CapsuleGeometry(0.06, 0.1, 4, 8), mat: fur, p: [-0.14, -0.55, 0.02] },
    { geo: new THREE.CapsuleGeometry(0.06, 0.1, 4, 8), mat: fur, p: [0.14, -0.55, 0.02] },
    { geo: new THREE.SphereGeometry(0.08, 10, 8), mat: fur, p: [-0.14, -0.64, 0.06], s: [1.1, 0.5, 1.4] },
    { geo: new THREE.SphereGeometry(0.08, 10, 8), mat: fur, p: [0.14, -0.64, 0.06], s: [1.1, 0.5, 1.4] },
  ], { outline: 0.014 }));
  const head = joint(torso, 0, 0.32, 0.04);
  head.add(bake([
    { geo: new THREE.SphereGeometry(0.28, 20, 16), mat: fur, s: [1.1, 0.95, 1] },
    { geo: new THREE.ConeGeometry(0.09, 0.22, 8), mat: fur, p: [-0.19, 0.3, -0.02], r: [0, 0, 0.5] },
    { geo: new THREE.ConeGeometry(0.09, 0.22, 8), mat: fur, p: [0.19, 0.3, -0.02], r: [0, 0, -0.5] },
    { geo: new THREE.ConeGeometry(0.045, 0.12, 8), mat: once('earPink', () => toon(0xe88a9a)), p: [-0.19, 0.3, 0.03], r: [0, 0, 0.5] },
    { geo: new THREE.ConeGeometry(0.045, 0.12, 8), mat: once('earPink', () => toon(0xe88a9a)), p: [0.19, 0.3, 0.03], r: [0, 0, -0.5] },
    // the tenugui cloth tied over its head, the way a dancing cat wears one
    { geo: new THREE.SphereGeometry(0.3, 16, 12), mat: cloth, p: [0, 0.04, -0.02], s: [1.08, 0.8, 1.0], r: [0.2, 0, 0] },
    { geo: new THREE.BoxGeometry(0.16, 0.05, 0.28), mat: cloth, p: [0.22, 0.14, 0.12], r: [0.3, -0.6, -0.4] },
    // slit eyes, nose, whiskers, a smiling mouth
    { geo: new THREE.SphereGeometry(0.075, 12, 8), mat: gold, p: [-0.11, 0.02, 0.25], s: [1, 1.1, 0.5] },
    { geo: new THREE.SphereGeometry(0.075, 12, 8), mat: gold, p: [0.11, 0.02, 0.25], s: [1, 1.1, 0.5] },
    { geo: new THREE.SphereGeometry(0.03, 8, 6), mat: ink(), p: [-0.11, 0.02, 0.28], s: [0.4, 1.4, 0.4] },
    { geo: new THREE.SphereGeometry(0.03, 8, 6), mat: ink(), p: [0.11, 0.02, 0.28], s: [0.4, 1.4, 0.4] },
    { geo: new THREE.SphereGeometry(0.035, 8, 6), mat: once('earPink', () => toon(0xe88a9a)), p: [0, -0.08, 0.3], s: [1.3, 0.8, 0.8] },
    { geo: new THREE.SphereGeometry(0.06, 10, 8), mat: maw(), p: [0, -0.15, 0.27], s: [1.6, 0.35, 0.5] },
    { geo: new THREE.ConeGeometry(0.02, 0.06, 6), mat: white(), p: [-0.05, -0.15, 0.29], r: [Math.PI, 0, 0] },
    { geo: new THREE.ConeGeometry(0.02, 0.06, 6), mat: white(), p: [0.05, -0.15, 0.29], r: [Math.PI, 0, 0] },
    ...[-1, 1].flatMap((sx) => [0.06, 0, -0.06].map((dy) => ({ geo: new THREE.CylinderGeometry(0.006, 0.006, 0.3, 4), mat: white(), p: [sx * 0.3, -0.08 + dy, 0.2], r: [0, 0, Math.PI / 2 + dy * 3] }))),
  ], { outline: 0.012 }));
  // forepaws raised, as in the dance
  const paws = [-1, 1].map((sx) => {
    const a = joint(torso, sx * 0.22, -0.05, 0.1);
    a.add(bake([
      { geo: new THREE.CapsuleGeometry(0.05, 0.18, 4, 8), mat: fur, p: [sx * 0.08, 0.1, 0.04], r: [0, 0, -sx * 0.9] },
      { geo: new THREE.SphereGeometry(0.065, 8, 6), mat: fur2, p: [sx * 0.2, 0.2, 0.06] },
    ], { outline: 0.012 }));
    return a;
  });
  // the two tails
  const tails = [-1, 1].map((sx) => {
    const tj = joint(torso, sx * 0.1, -0.4, -0.22);
    tj.add(bake([
      { geo: taperedTube([[0, 0, 0], [sx * 0.15, 0.2, -0.25], [sx * 0.35, 0.55, -0.35], [sx * 0.3, 0.85, -0.25]], 0.06, { tip: 0.5 }), mat: fur },
      { geo: new THREE.SphereGeometry(0.05, 8, 6), mat: fur2, p: [sx * 0.3, 0.85, -0.25] },
    ], { outline: 0.012 }));
    return tj;
  });
  body.add(glowSprite(0xffd9a0, 1.6, 0.2));
  return (t, seed, self) => {
    const w = Math.sin(t * 4 + seed);
    self.hop = Math.abs(w) * 0.12;
    torso.rotation.z = w * 0.12;
    head.rotation.z = -w * 0.15;
    head.rotation.y = Math.sin(t * 1.3 + seed) * 0.3;
    paws[0].rotation.z = w * 0.35; paws[1].rotation.z = w * 0.35;
    tails[0].rotation.y = Math.sin(t * 3 + seed) * 0.5; tails[1].rotation.y = -Math.sin(t * 3 + 1 + seed) * 0.5;
  };
}
