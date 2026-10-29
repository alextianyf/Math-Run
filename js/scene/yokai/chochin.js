// chochin.js — 提灯お化け glowing paper-lantern ghost
import * as THREE from 'three';
import { toon, bake, joint, lathe, taperedTube } from '../toon.js';
import { lanternPaperTex } from '../textures.js';
import { once, white, ink, tongue, darkWood, maw, glowSprite } from './shared.js';

export function buildChochin(body) {
  const paperTex = lanternPaperTex();
  const paper = once('lanternMat', () => toon(0xffffff, {
    map: paperTex,
    emissive: new THREE.Color(0xff7a2a),
    emissiveMap: paperTex,
    emissiveIntensity: 0.85,
    side: THREE.DoubleSide,
  }));
  const lantern = new THREE.Group();
  body.add(lantern);
  lantern.add(bake([
    {
      geo: lathe(
        [[0.17, -0.5], [0.33, -0.42], [0.42, -0.2], [0.445, 0.02], [0.415, 0.24], [0.32, 0.42], [0.17, 0.5]],
        24
      ),
      mat: paper,
    },
  ], { outline: 0.016 }));
  lantern.add(bake([
    { geo: lathe([[0.2, 0.47], [0.225, 0.51], [0.2, 0.56], [0.06, 0.58]], 18), mat: darkWood() },
    { geo: lathe([[0.06, -0.58], [0.2, -0.56], [0.225, -0.51], [0.2, -0.47]], 18), mat: darkWood() },
    { geo: new THREE.TorusGeometry(0.07, 0.016, 6, 14), mat: darkWood(), p: [0, 0.66, 0] },
    // one huge eye, slit pupil
    { geo: new THREE.SphereGeometry(0.16, 18, 14), mat: white(), p: [0.07, 0.13, 0.4], s: [1, 1.05, 0.5] },
    { geo: new THREE.SphereGeometry(0.085, 14, 10), mat: once('iris', () => toon(0x8a1414)), p: [0.08, 0.12, 0.465], s: [1, 1, 0.45] },
    { geo: new THREE.SphereGeometry(0.05, 10, 8), mat: ink(), p: [0.08, 0.12, 0.495], s: [0.35, 1.3, 0.4] },
    // torn-paper grin with fangs
    { geo: new THREE.SphereGeometry(0.2, 16, 8), mat: maw(), p: [0, -0.17, 0.4], s: [1.15, 0.32, 0.25] },
    { geo: new THREE.ConeGeometry(0.03, 0.08, 6), mat: white(), p: [-0.1, -0.14, 0.44], r: [Math.PI, 0, 0] },
    { geo: new THREE.ConeGeometry(0.03, 0.08, 6), mat: white(), p: [0.12, -0.14, 0.44], r: [Math.PI, 0, 0] },
  ], { outline: 0.012 }));
  const tongueJ = joint(lantern, 0.05, -0.19, 0.44);
  tongueJ.add(
    bake(
      [
        {
          geo: taperedTube(
            [[0, 0, 0], [0.02, -0.12, 0.1], [0.06, -0.3, 0.09], [0.03, -0.48, -0.02]],
            0.06,
            { tip: 0.5 }
          ),
          mat: tongue(),
        },
      ],
      { outline: 0.01 }
    )
  );
  body.add(glowSprite(0xff8a3a, 2.2, 0.4));
  return (t, seed) => {
    lantern.rotation.z = Math.sin(t * 1.8 + seed) * 0.16;
    lantern.rotation.y = Math.sin(t * 0.9 + seed) * 0.2;
    tongueJ.rotation.z = Math.sin(t * 5 + seed) * 0.35;
    tongueJ.rotation.x = Math.sin(t * 3.3 + seed) * 0.15;
  };
}
