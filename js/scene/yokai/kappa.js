// kappa.js — 河童 river imp with a water dish, waddles
import * as THREE from 'three';
import { toon, glow, bake, joint, lathe } from '../toon.js';
import { once, eyeParts, glowSprite } from './shared.js';

export function buildKappa(body) {
  const green = once('kappa', () => toon(0x5aa65a));
  const shell = once('shell', () => toon(0x6e4b2a));
  const torso = new THREE.Group();
  body.add(torso);
  torso.add(bake([
    { geo: lathe([[0.0, -0.55], [0.26, -0.5], [0.36, -0.25], [0.33, 0.0], [0.2, 0.12], [0, 0.16]], 18), mat: green },
    { geo: new THREE.SphereGeometry(0.3, 16, 12), mat: once('belly', () => toon(0xdbe9a8)), p: [0, -0.24, 0.2], s: [0.8, 0.95, 0.4] },
    // the shell on its back, scored with a couple of ridges
    { geo: new THREE.SphereGeometry(0.42, 14, 10), mat: shell, p: [0, -0.2, -0.24], s: [0.95, 1.0, 0.4] },
    { geo: new THREE.TorusGeometry(0.3, 0.025, 6, 16), mat: shell, p: [0, -0.2, -0.36] },
    { geo: new THREE.TorusGeometry(0.16, 0.025, 6, 12), mat: shell, p: [0, -0.2, -0.4] },
    // legs and webbed feet
    { geo: new THREE.CapsuleGeometry(0.07, 0.14, 4, 8), mat: green, p: [-0.17, -0.6, 0] },
    { geo: new THREE.CapsuleGeometry(0.07, 0.14, 4, 8), mat: green, p: [0.17, -0.6, 0] },
    { geo: new THREE.SphereGeometry(0.1, 10, 8), mat: green, p: [-0.17, -0.72, 0.06], s: [1.1, 0.4, 1.4] },
    { geo: new THREE.SphereGeometry(0.1, 10, 8), mat: green, p: [0.17, -0.72, 0.06], s: [1.1, 0.4, 1.4] },
  ], { outline: 0.014 }));
  const head = joint(torso, 0, 0.28, 0.02);
  const irisDark = once('irisDark', () => toon(0x1a1a2a));
  head.add(bake([
    { geo: new THREE.SphereGeometry(0.28, 20, 16), mat: green },
    // the ring of hair and the dish of water on top
    { geo: new THREE.TorusGeometry(0.21, 0.07, 8, 18), mat: once('kappaHair', () => toon(0x1f4a2e)), p: [0, 0.2, 0], r: [Math.PI / 2, 0, 0] },
    { geo: new THREE.CylinderGeometry(0.17, 0.15, 0.04, 16), mat: once('dish', () => new THREE.MeshBasicMaterial({ color: glow(0x8fd8ff, 1.3) })), p: [0, 0.25, 0] },
    // beak
    { geo: new THREE.ConeGeometry(0.1, 0.22, 10), mat: once('beak', () => toon(0xf0c050)), p: [0, -0.02, 0.33], r: [Math.PI / 2, 0, 0] },
    ...eyeParts(-0.12, 0.08, 0.2, 0.075, irisDark),
    ...eyeParts(0.12, 0.08, 0.2, 0.075, irisDark),
  ], { outline: 0.014 }));
  const arms = [-1, 1].map((sx) => {
    const a = joint(torso, sx * 0.3, -0.12, 0.08);
    a.add(bake([
      { geo: new THREE.CapsuleGeometry(0.05, 0.22, 4, 8), mat: green, p: [sx * 0.08, -0.12, 0.04], r: [0, 0, -sx * 0.5] },
      { geo: new THREE.SphereGeometry(0.07, 8, 6), mat: green, p: [sx * 0.14, -0.26, 0.08], s: [1.2, 0.5, 1.2] },
    ], { outline: 0.012 }));
    return a;
  });
  body.add(glowSprite(0x7ae07a, 1.6, 0.18));
  return (t, seed, self) => {
    const w = Math.sin(t * 5 + seed);
    self.hop = Math.abs(w) * 0.08;
    torso.rotation.z = w * 0.07;
    head.rotation.z = -w * 0.08;
    head.rotation.y = Math.sin(t * 1.1 + seed) * 0.3;
    arms[0].rotation.x = w * 0.5; arms[1].rotation.x = -w * 0.5;
  };
}
