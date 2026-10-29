// trees.js — cedars and night sakura beside the path.
import * as THREE from 'three';
import { toon, place, taperedTube } from '../toon.js';
import { NEAR, SPAN, merge, instanced, Scroller } from './shared.js';
import { rand } from '../../core/math.js';

export function buildTrees(scene) {
  // cedars (back rows)
  const trunk = merge([place(new THREE.CylinderGeometry(0.12, 0.2, 1.8, 7), [0, 0.9, 0])]);
  const needles = merge([
    place(new THREE.ConeGeometry(1.15, 1.9, 7), [0, 2.3, 0]),
    place(new THREE.ConeGeometry(0.88, 1.6, 7), [0, 3.25, 0]),
    place(new THREE.ConeGeometry(0.58, 1.3, 7), [0, 4.1, 0]),
  ]);
  const cedarCount = 70;
  const cedarTrunk = instanced(trunk, toon(0x3a2a26), cedarCount);
  const cedarTop = instanced(needles, toon(0x1d3d3a), cedarCount);
  scene.add(cedarTrunk, cedarTop);
  const cedars = new Scroller([cedarTrunk, cedarTop], Array.from({ length: cedarCount }, (_, i) => ({
    x: (i % 2 ? 1 : -1) * rand(8.5, 22), z: NEAR - Math.random() * SPAN, s: rand(0.9, 2), ry: Math.random() * Math.PI,
  })));

  // night sakura (front rows, framing the path)
  const sakTrunk = merge([
    taperedTube([[0, 0, 0], [0.15, 1.0, 0], [-0.1, 1.9, 0.1], [0.05, 2.5, 0]], 0.17, { tip: 0.45 }),
    taperedTube([[-0.05, 1.7, 0.05], [-0.6, 2.3, 0.2], [-1.0, 2.6, 0.1]], 0.08, { tip: 0.3 }),
    taperedTube([[0.05, 1.9, 0], [0.6, 2.4, -0.2], [0.95, 2.8, -0.1]], 0.08, { tip: 0.3 }),
  ]);
  const blossom = merge([
    [0, 2.9, 0, 1.05],
    [-0.9, 2.7, 0.2, 0.8],
    [0.9, 2.95, -0.2, 0.85],
    [0.2, 3.5, 0.1, 0.8],
    [-0.4, 3.3, -0.4, 0.7],
    [0.5, 2.6, 0.5, 0.7],
  ].map(([x, y, z, r]) => place(new THREE.IcosahedronGeometry(r, 1), [x, y, z])));
  const sakCount = 24;
  const sakTrunkMesh = instanced(sakTrunk, toon(0x3b2630), sakCount);
  const sakTopMesh = instanced(blossom, toon(0xf4a9c8, { emissive: 0x4a1030 }), sakCount);
  scene.add(sakTrunkMesh, sakTopMesh);
  const sakura = new Scroller([sakTrunkMesh, sakTopMesh], Array.from({ length: sakCount }, (_, i) => ({
    x: (i % 2 ? 1 : -1) * rand(5.6, 8),
    z: NEAR - (i / sakCount) * SPAN - rand(0, 4),
    s: rand(0.9, 1.25),
    ry: Math.random() * Math.PI * 2,
  })));
  return { step(dz) {
    cedars.step(dz);
    sakura.step(dz);
  } };
}
