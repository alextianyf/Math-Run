// nopperabo.js — のっぺらぼう faceless man with a lantern, wiping the face he doesn't have
import * as THREE from 'three';
import { toon, glow, bake, joint, lathe } from '../toon.js';
import { lanternPaperTex } from '../textures.js';
import { once, white, ink, darkWood, glowSprite } from './shared.js';

export function buildNopperabo(body, seed) {
  const robe = once('nopRobe', () => toon(0x4a6282));
  const haori = once('nopHaori', () => toon(0x262b40, { side: THREE.DoubleSide }));
  const face = once('nopFace', () => toon(0xf3e2cc, { emissive: 0x241a10 }));
  const hair = once('hairBlack', () => toon(0x17121d));
  const obiMat = once('nopObi', () => toon(0x8a5a32));
  const lanternTex = lanternPaperTex();
  const paper = once('nopLantern', () => toon(0xffffff, { map: lanternTex, emissive: new THREE.Color(0xff7a2a), emissiveMap: lanternTex, emissiveIntensity: 1 }));

  const torso = new THREE.Group();
  body.add(torso);
  // a merchant's kimono, a dark haori open at the front, white tabi on zōri
  const haoriGeo = new THREE.LatheGeometry(
    [[0.3, -0.36], [0.29, -0.05], [0.28, 0.18], [0.21, 0.35], [0.12, 0.42]].map(([r, y]) => new THREE.Vector2(r, y)),
    18,
    0.45,
    Math.PI * 2 - 0.9
  );
  torso.add(bake([
    { geo: lathe([[0.3, -0.74], [0.27, -0.4], [0.25, -0.05], [0.26, 0.18], [0.2, 0.34], [0.1, 0.4]], 18), mat: robe },
    { geo: haoriGeo, mat: haori },
    { geo: new THREE.CylinderGeometry(0.258, 0.258, 0.09, 16), mat: obiMat, p: [0, -0.12, 0] },
    { geo: new THREE.BoxGeometry(0.045, 0.24, 0.02), mat: white(), p: [-0.05, 0.26, 0.21], r: [-0.35, 0, -0.45] },
    { geo: new THREE.BoxGeometry(0.045, 0.24, 0.02), mat: white(), p: [0.05, 0.26, 0.21], r: [-0.35, 0, 0.45] },
    { geo: new THREE.CylinderGeometry(0.06, 0.07, 0.16, 10), mat: face, p: [0, 0.46, 0] },
    ...[-0.1, 0.1].flatMap((x) => [
      { geo: new THREE.SphereGeometry(0.07, 10, 8), mat: white(), p: [x, -0.76, 0.06], s: [0.9, 0.6, 1.4] },
      { geo: new THREE.BoxGeometry(0.12, 0.025, 0.24), mat: once('wood', () => toon(0x7a4e2c)), p: [x, -0.81, 0.06] },
    ]),
    // left arm forward, holding the pole the lantern hangs from
    { geo: new THREE.CapsuleGeometry(0.075, 0.24, 4, 8), mat: haori, p: [-0.27, 0.16, 0.08], r: [-0.5, 0, -0.15] },
    {
      geo: new THREE.CapsuleGeometry(0.1, 0.12, 4, 8),
      mat: haori,
      p: [-0.3, 0.0, 0.2],
      s: [0.7, 1, 1],
      r: [-1.1, 0, 0],
    },
    { geo: new THREE.SphereGeometry(0.055, 10, 8), mat: face, p: [-0.31, 0.04, 0.34] },
    { geo: new THREE.CylinderGeometry(0.014, 0.014, 0.62, 5), mat: once('bamboo', () => toon(0xb59a52)), p: [-0.38, 0.17, 0.5], r: [1.1, 0, 0.35] },
  ], { outline: 0.014 }));

  // the lantern sways from the tip of the pole
  const lanternJ = joint(torso, -0.48, 0.32, 0.64);
  lanternJ.add(bake([
    { geo: new THREE.CylinderGeometry(0.004, 0.004, 0.12, 4), mat: ink(), p: [0, -0.06, 0] },
    { geo: lathe([[0.07, -0.33], [0.11, -0.3], [0.125, -0.22], [0.11, -0.14], [0.07, -0.12]], 14), mat: paper },
    { geo: new THREE.CylinderGeometry(0.075, 0.075, 0.025, 12), mat: darkWood(), p: [0, -0.115, 0] },
    { geo: new THREE.CylinderGeometry(0.075, 0.075, 0.025, 12), mat: darkWood(), p: [0, -0.335, 0] },
  ], { outline: 0.01 }));
  const lanternGlow = glowSprite(0xffa04a, 0.9, 0.55);
  lanternGlow.position.y = -0.22;
  lanternJ.add(lanternGlow);

  // the head: a smooth egg with nothing on it at all, under a samurai's topknot
  const head = joint(torso, 0, 0.68, 0.0);
  head.add(bake([
    { geo: new THREE.SphereGeometry(0.2, 24, 18), mat: face, s: [0.88, 1.1, 0.95] },
    {
      geo: new THREE.SphereGeometry(0.205, 20, 12, Math.PI - 0.5, Math.PI + 1.0, 0.62, 1.5),
      mat: hair,
      s: [0.9, 1.1, 0.98],
    },
    { geo: new THREE.CapsuleGeometry(0.03, 0.15, 4, 8), mat: hair, p: [0, 0.23, -0.02], r: [Math.PI / 2 - 0.25, 0, 0] },
    { geo: new THREE.SphereGeometry(0.04, 8, 6), mat: hair, p: [0, 0.2, -0.1] },
    { geo: new THREE.SphereGeometry(0.04, 8, 6), mat: face, p: [-0.175, 0.0, 0.0], s: [0.45, 0.85, 0.6] },
    { geo: new THREE.SphereGeometry(0.04, 8, 6), mat: face, p: [0.175, 0.0, 0.0], s: [0.45, 0.85, 0.6] },
  ], { outline: 0.014 }));
  // the right hand comes up and wipes across where the face should be
  const arm = joint(torso, 0.25, 0.3, 0.02);
  arm.add(bake([
    { geo: new THREE.CapsuleGeometry(0.075, 0.2, 4, 8), mat: haori, p: [0, -0.14, 0] },
    { geo: new THREE.CapsuleGeometry(0.1, 0.1, 4, 8), mat: haori, p: [0, -0.3, -0.02], s: [0.7, 1, 1] },
    { geo: new THREE.SphereGeometry(0.05, 10, 8), mat: face, p: [0, -0.42, 0], s: [1, 1.2, 0.6] },
  ], { outline: 0.012 }));
  const sheen = glowSprite(glow(0xfff2dc, 1), 0.5, 0.0);
  sheen.position.set(0, 0.7, 0.3);
  torso.add(sheen);
  body.add(glowSprite(0xbfd0ff, 1.7, 0.18));
  return (t, s, self) => {
    const w = Math.sin(t * 1.4 + seed);
    torso.rotation.z = w * 0.05;
    head.rotation.z = Math.sin(t * 0.6 + seed) * 0.22;           // an unhurried, eerie tilt
    head.rotation.y = Math.sin(t * 0.45 + seed) * 0.25;
    lanternJ.rotation.z = Math.sin(t * 2.2 + seed) * 0.35;
    lanternJ.rotation.x = Math.sin(t * 1.7 + seed) * 0.15;
    // every few seconds the hand passes over the blank face
    const c = ((t + seed) % 4.2) / 4.2;
    const k = c < 0.45 ? Math.sin((c / 0.45) * Math.PI) : 0;
    arm.rotation.set(-0.25 - 2.35 * Math.min(1, k * 1.6), 0, 0.15 + 0.35 * Math.sin(c * 30) * k);
    sheen.material.opacity = 0.25 * k;
    self.hop = 0;
  };
}
