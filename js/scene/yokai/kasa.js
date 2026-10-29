// kasa.js — 唐傘お化け one-legged umbrella ghost, hops
import * as THREE from 'three';
import { toon, glow, bake, joint, taperedTube } from '../toon.js';
import { wagasaTex } from '../textures.js';
import { once, white, ink, tongue, darkWood, maw, glowSprite } from './shared.js';

export function buildKasa(body) {
  const canopyMat = once('wagasa', () => toon(0xffffff, { map: wagasaTex(), side: THREE.DoubleSide }));
  const top = new THREE.Group();
  body.add(top);
  top.add(bake([
    { geo: new THREE.ConeGeometry(0.85, 0.72, 16, 1, true), mat: canopyMat },
    { geo: new THREE.CylinderGeometry(0.03, 0.03, 0.22, 6), mat: darkWood(), p: [0, 0.44, 0] },
    { geo: new THREE.ConeGeometry(0.09, 0.1, 10), mat: darkWood(), p: [0, 0.38, 0] },
  ], { outline: 0.016 }));
  const face = joint(top, 0, -0.02, 0.43);
  face.rotation.x = -0.86;                       // follow the canopy's slope
  face.add(bake([
    { geo: new THREE.SphereGeometry(0.16, 18, 14), mat: white(), s: [1, 1, 0.45] },
    { geo: new THREE.SphereGeometry(0.085, 14, 10), mat: once('iris2', () => toon(0x2a1a6a)), p: [0, 0, 0.06], s: [1, 1, 0.45] },
    { geo: new THREE.SphereGeometry(0.045, 10, 8), mat: ink(), p: [0, 0, 0.085], s: [1, 1, 0.4] },
  ], { outline: 0.01 }));
  const tongueJ = joint(top, 0, -0.2, 0.6);
  tongueJ.add(bake([
    { geo: new THREE.SphereGeometry(0.11, 12, 8), mat: maw(), s: [1.2, 0.5, 0.4], r: [-0.86, 0, 0] },
    { geo: taperedTube([[0, 0, 0.02], [0.04, -0.14, 0.17], [0.0, -0.36, 0.2], [-0.05, -0.56, 0.1]], 0.065, { tip: 0.5 }), mat: tongue() },
  ], { outline: 0.01 }));
  const legJ = joint(body, 0, -0.36, 0);
  legJ.add(bake([
    { geo: new THREE.CapsuleGeometry(0.05, 0.42, 4, 8), mat: once('legSkin', () => toon(0xe9dcc8)), p: [0, -0.26, 0] },
    { geo: new THREE.BoxGeometry(0.22, 0.06, 0.34), mat: once('wood', () => toon(0x7a4e2c)), p: [0, -0.56, 0.02] },
    { geo: new THREE.BoxGeometry(0.2, 0.07, 0.04), mat: once('wood', () => toon(0x7a4e2c)), p: [0, -0.62, -0.08] },
    { geo: new THREE.BoxGeometry(0.2, 0.07, 0.04), mat: once('wood', () => toon(0x7a4e2c)), p: [0, -0.62, 0.12] },
  ], { outline: 0.012 }));
  body.add(glowSprite(glow(0xff4f8a, 1), 1.6, 0.35));
  return (t, seed, self) => {
    const hop = Math.abs(Math.sin(t * 3.2 + seed));
    self.hop = hop * 0.55;
    const squash = 1 - hop;
    top.scale.set(1 + squash * 0.08, 1 - squash * 0.1, 1 + squash * 0.08);
    top.rotation.z = Math.sin(t * 3.2 + seed) * 0.12;
    legJ.scale.y = 0.85 + hop * 0.15;
    tongueJ.rotation.z = Math.sin(t * 6 + seed) * 0.3;
  };
}
