// oni.js — the red oni (赤鬼) of the old pictures: a wild black mane, two thick horns,
// tusks, a tiger-skin loincloth and an iron club. Boss of the parade and the one who
// catches you. Faces +z (toward the hero). Fully jointed so it can walk, roar,
// stagger, reach down, close its fist around the hero, lift him up and laugh.
import * as THREE from 'three';
import { toon, glow, bake, joint, lathe, taperedTube, loft } from './toon.js';
import { tigerTex, glowTex } from './textures.js';

const smoothTo = (cur, target, k) => cur + (target - cur) * k;

// Building an oni takes ~60 ms (a visible stutter), so a finished one is kept and
// handed out again: the rank-trial boss and the capture scene both take it from here.
let spare = null;
export function takeOni() {
  const oni = spare ?? createOni();
  spare = null;
  return oni;
}
export function releaseOni(oni) {
  oni.root.removeFromParent();
  oni.root.position.set(0, 0, 0);
  oni.root.rotation.set(0, 0, 0);
  oni.root.scale.setScalar(1);
  oni.reset();
  if (spare) oni.dispose();
  else spare = oni;
}

function createOni() {
  const tiger = tigerTex();
  tiger.repeat.set(2, 1);
  const M = {
    skin: toon(0xd63c33, { emissive: 0x2a0404 }),
    dark: toon(0x9e2620),
    hair: toon(0x221820),
    horn: toon(0xe9dcb4),
    tiger: toon(0xffffff, { map: tiger }),
    gold: toon(0xe3ad3e, { emissive: 0x3a2000 }),
    iron: toon(0x2e2b38),
    stud: toon(0xa29eb4),
    mouth: toon(0x2a070b),
    teeth: toon(0xfff8ea),
    brow: toon(0x1a1014),
    eye: new THREE.MeshBasicMaterial({ color: glow(0xffd04a, 1.6) }),
    hornDark: toon(0x6e5a44),
    rope: toon(0xd9b561),
    cord: toon(0xb8202a),
    pupil: new THREE.MeshBasicMaterial({ color: 0x1a0608 }),
  };

  const root = new THREE.Group();
  const body = joint(root);
  const pelvis = joint(body, 0, 1.35, 0);
  const rows = (list) => list.map(([y, rx, rz, cz, e]) => ({ y, rx, rz, cz, e: 2, ef: e }));

  // ---------- tiger-skin loincloth ----------
  // a twisted straw rope for a belt, knotted at the front with its ends hanging
  const rope = (phase) => {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2, tw = a * 9 + phase;
      const r = 0.47 + 0.028 * Math.cos(tw);
      pts.push([Math.sin(a) * r, 0.12 + 0.028 * Math.sin(tw), Math.cos(a) * r * 0.87]);
    }
    return taperedTube(pts, 0.042, { tip: 1, segments: 120, radial: 6 });
  };
  // the pelt's hem is ragged: a ring of tufts hanging off the skirt
  const tufts = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.1, len = 0.13 + ((i * 5) % 3) * 0.04;
    tufts.push({ geo: new THREE.ConeGeometry(0.075, len, 5), mat: M.tiger, p: [Math.sin(a) * 0.57, -0.42 - len / 2 + 0.03, Math.cos(a) * 0.57 * 0.86], r: [Math.PI, 0, 0] });
  }
  pelvis.add(bake([
    { geo: lathe([[0.42, 0.14], [0.5, 0.0], [0.56, -0.22], [0.6, -0.42]], 22), mat: M.tiger, s: [1, 1, 0.86] },
    ...tufts,
    { geo: rope(0), mat: M.rope },
    { geo: rope(Math.PI), mat: M.rope },
    { geo: new THREE.SphereGeometry(0.09, 10, 8), mat: M.rope, p: [0.12, 0.1, 0.42], s: [1.2, 1, 0.8] },
    { geo: taperedTube([[0.12, 0.08, 0.44], [0.16, -0.12, 0.5], [0.12, -0.36, 0.52]], 0.04, { tip: 0.6 }), mat: M.rope },
    { geo: taperedTube([[0.12, 0.08, 0.44], [0.22, -0.08, 0.48], [0.26, -0.28, 0.5]], 0.04, { tip: 0.6 }), mat: M.rope },
    // the tiger's tail, still on the pelt, hanging at the hip
    { geo: taperedTube([[-0.5, 0.0, 0.1], [-0.62, -0.3, 0.12], [-0.6, -0.62, 0.2], [-0.52, -0.82, 0.3]], 0.055, { tip: 0.5 }), mat: M.tiger },
  ], { outline: 0.022 }));

  // ---------- torso: lofted V-shape — thick neck, wide traps and shoulders, barrel chest, belly ----------
  const chest = joint(pelvis, 0, 0.12, 0);
  chest.add(bake([
    { geo: loft(rows([
      [1.36, 0.27, 0.25, -0.03], [1.22, 0.5, 0.36, -0.02, 2.4], [1.04, 0.76, 0.44, 0.0, 2.6], [0.86, 0.74, 0.5, 0.04, 2.6],
      [0.64, 0.64, 0.47, 0.06, 2.5], [0.44, 0.57, 0.49, 0.08, 2.4], [0.24, 0.57, 0.51, 0.08, 2.3], [0.04, 0.52, 0.45, 0.04, 2.2],
      [-0.1, 0.44, 0.4, 0.0],
    ]), { segs: 28, front: 1 }), mat: M.skin },
    { geo: new THREE.SphereGeometry(0.3, 18, 14), mat: M.skin, p: [-0.3, 0.84, 0.4], s: [1.05, 0.62, 0.45] },   // pecs
    { geo: new THREE.SphereGeometry(0.3, 18, 14), mat: M.skin, p: [0.3, 0.84, 0.4], s: [1.05, 0.62, 0.45] },
    { geo: new THREE.SphereGeometry(0.16, 12, 10), mat: M.skin, p: [-0.46, 1.08, 0.08], s: [1.2, 0.8, 1] },     // traps
    { geo: new THREE.SphereGeometry(0.16, 12, 10), mat: M.skin, p: [0.46, 1.08, 0.08], s: [1.2, 0.8, 1] },
    { geo: new THREE.CylinderGeometry(0.22, 0.27, 0.34, 16), mat: M.skin, p: [0, 1.3, -0.02] },                // neck
    // a slab of abdominal muscle and the obliques
    ...[0.52, 0.36, 0.2].flatMap((y, i) => [-1, 1].map((sx) => ({ geo: new THREE.SphereGeometry(0.12, 12, 10), mat: M.skin, p: [sx * 0.125, y, 0.5 - i * 0.015], s: [1, 0.72 - i * 0.04, 0.42] }))),
    { geo: new THREE.SphereGeometry(0.2, 12, 10), mat: M.skin, p: [-0.42, 0.42, 0.28], s: [0.5, 1.2, 0.8] },
    { geo: new THREE.SphereGeometry(0.2, 12, 10), mat: M.skin, p: [0.42, 0.42, 0.28], s: [0.5, 1.2, 0.8] },
  ], { outline: 0.026 }));

  // ---------- head: heavy brow, deep-set eyes, broad nose, jutting jaw ----------
  const head = joint(chest, 0, 1.44, 0.04);
  // the mane: a thick mass of black curls over the back and top of the skull, spilling
  // down the neck to the shoulders, with a few heavier locks tossed up between the horns
  // the mane: a cap of hair over the skull, bristling with tapered locks that flare out
  // and up like black flame, the lower ones falling heavily over the neck and shoulders
  const mane = [{ geo: new THREE.SphereGeometry(0.5, 20, 14), mat: M.hair, p: [0, 0.32, -0.13], s: [1.04, 1.04, 1] }];
  const skull = new THREE.Vector3(0, 0.32, -0.13);
  const up = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3();
  const a0 = new THREE.Vector3(), a1 = new THREE.Vector3(), a2 = new THREE.Vector3();
  for (let i = 0; i < 44; i++) {
    const u = ((i * 7) % 11) / 10, v = ((i * 5) % 9) / 8;          // pseudo-random per lock
    const az = (i / 43 - 0.5) * 4.4;                                 // around the back (0 = straight back)
    const el = -0.7 + v * 1.9 - Math.abs(az) * 0.1;                  // from the nape up over the crown
    d.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    a0.copy(skull).addScaledVector(d, 0.42);
    const fall = el < 0.1 ? 0.3 + u * 0.2 : -0.12 - v * 0.1;        // low locks hang, high ones flick up
    a1.copy(a0).addScaledVector(d, 0.2 + u * 0.06).addScaledVector(up, -fall * 0.35);
    a2.copy(a0).addScaledVector(d, 0.34 + u * 0.12).addScaledVector(up, -fall);
    mane.push({ geo: taperedTube([a0.toArray(), a1.toArray(), a2.toArray()], 0.1 + v * 0.05, { tip: 0.06, segments: 8, radial: 7 }), mat: M.hair });
  }
  for (const [x, lean] of [[-0.16, -0.6], [0.0, 0], [0.15, 0.55]]) {
    mane.push({ geo: taperedTube([[x, 0.7, -0.06], [x * 1.8 + lean * 0.12, 1.02, -0.22], [x * 2.6 + lean * 0.32, 1.18, -0.5]], 0.11, { tip: 0.06, swell: 0.25 }), mat: M.hair });
  }
  // sideburns sweeping back past the ears
  for (const sx of [-1, 1]) {
    mane.push({ geo: taperedTube([[sx * 0.44, 0.34, 0.12], [sx * 0.52, 0.12, 0.1], [sx * 0.62, -0.08, -0.04]], 0.09, { tip: 0.1, segments: 8 }), mat: M.hair });
    mane.push({ geo: taperedTube([[sx * 0.46, 0.2, 0.16], [sx * 0.5, -0.02, 0.18], [sx * 0.56, -0.2, 0.08]], 0.075, { tip: 0.1, segments: 8 }), mat: M.hair });
  }
  // thick ridged horns, curving out and then forward, banded dark near the root
  const horn = (sx) => {
    const pts = [[sx * 0.2, 0.5, 0.08], [sx * 0.4, 0.78, 0.02], [sx * 0.5, 1.03, 0.1], [sx * 0.42, 1.24, 0.3]];
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const parts = [{ geo: taperedTube(pts, 0.17, { tip: 0.04, segments: 18, radial: 10 }), mat: M.horn }];
    const q = new THREE.Quaternion(), e = new THREE.Euler(), z = new THREE.Vector3(0, 0, 1);
    for (const t of [0.06, 0.17, 0.28, 0.39]) {
      const c = curve.getPointAt(t), tan = curve.getTangentAt(t);
      e.setFromQuaternion(q.setFromUnitVectors(z, tan));
      parts.push({ geo: new THREE.TorusGeometry(0.17 * (1 - 0.96 * t) * 0.98, 0.026 - t * 0.03, 6, 18), mat: M.hornDark, p: c.toArray(), r: [e.x, e.y, e.z] });
    }
    return parts;
  };
  const lip = (a, inset = 0) => [0.4 * Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.8), 0.18 + (0.33 - inset) * Math.pow(Math.cos(a), 0.8)];
  head.add(bake([
    { geo: loft(rows([
      [0.8, 0.06, 0.06, -0.05], [0.75, 0.26, 0.28, -0.05], [0.63, 0.41, 0.41, -0.04, 2.2], [0.47, 0.48, 0.46, 0.0, 2.4],
      [0.35, 0.5, 0.44, 0.03, 2.6], [0.22, 0.49, 0.42, 0.07, 2.6], [0.1, 0.48, 0.4, 0.11, 2.5], [-0.02, 0.45, 0.37, 0.15, 2.5],
      [-0.1, 0.41, 0.33, 0.18, 2.5], [-0.15, 0.35, 0.27, 0.2, 2.4],
    ]), { segs: 32, front: 1 }), mat: M.skin },
    // a heavy brow ridge knotted into a scowl, bushy eyebrows flaring up at the ends
    { geo: new THREE.SphereGeometry(0.27, 16, 12), mat: M.skin, p: [-0.21, 0.37, 0.4], s: [1, 0.46, 0.66] },
    { geo: new THREE.SphereGeometry(0.27, 16, 12), mat: M.skin, p: [0.21, 0.37, 0.4], s: [1, 0.46, 0.66] },
    { geo: taperedTube([[-0.05, 0.31, 0.55], [-0.22, 0.4, 0.53], [-0.4, 0.5, 0.42], [-0.5, 0.62, 0.3]], 0.065, { tip: 0.2, swell: 0.35 }), mat: M.hair },
    { geo: taperedTube([[0.05, 0.31, 0.55], [0.22, 0.4, 0.53], [0.4, 0.5, 0.42], [0.5, 0.62, 0.3]], 0.065, { tip: 0.2, swell: 0.35 }), mat: M.hair },
    // eye sockets (dark), cheekbones
    { geo: new THREE.SphereGeometry(0.17, 14, 10), mat: M.mouth, p: [-0.2, 0.21, 0.44], s: [1, 0.7, 0.3] },
    { geo: new THREE.SphereGeometry(0.17, 14, 10), mat: M.mouth, p: [0.2, 0.21, 0.44], s: [1, 0.7, 0.3] },
    { geo: new THREE.SphereGeometry(0.16, 12, 10), mat: M.skin, p: [-0.36, 0.08, 0.36], s: [1, 0.8, 0.8] },
    { geo: new THREE.SphereGeometry(0.16, 12, 10), mat: M.skin, p: [0.36, 0.08, 0.36], s: [1, 0.8, 0.8] },
    // broad flat nose with nostrils
    { geo: new THREE.SphereGeometry(0.15, 14, 10), mat: M.skin, p: [0, 0.03, 0.49], s: [1.5, 0.8, 0.9] },
    { geo: new THREE.SphereGeometry(0.05, 8, 6), mat: M.mouth, p: [-0.1, -0.07, 0.56], s: [1.2, 0.7, 0.7] },
    { geo: new THREE.SphereGeometry(0.05, 8, 6), mat: M.mouth, p: [0.1, -0.07, 0.56], s: [1.2, 0.7, 0.7] },
    // pointed ears with gold rings
    { geo: new THREE.ConeGeometry(0.1, 0.3, 8), mat: M.skin, p: [-0.5, 0.3, -0.02], r: [0, 0, 1.2] },
    { geo: new THREE.ConeGeometry(0.1, 0.3, 8), mat: M.skin, p: [0.5, 0.3, -0.02], r: [0, 0, -1.2] },
    { geo: new THREE.TorusGeometry(0.07, 0.02, 6, 14), mat: M.gold, p: [-0.5, 0.1, 0.0], r: [0, Math.PI / 2, 0] },
    { geo: new THREE.TorusGeometry(0.07, 0.02, 6, 14), mat: M.gold, p: [0.5, 0.1, 0.0], r: [0, Math.PI / 2, 0] },
    ...horn(-1), ...horn(1),
    // snarl lines beside the nose
    { geo: new THREE.CapsuleGeometry(0.022, 0.12, 4, 6), mat: M.skin, p: [-0.19, 0.0, 0.5], r: [0.2, 0, -0.5] },
    { geo: new THREE.CapsuleGeometry(0.022, 0.12, 4, 6), mat: M.skin, p: [0.19, 0.0, 0.5], r: [0.2, 0, 0.5] },
    // upper teeth along the lip, and the dark mouth cavity behind them
    ...[-0.95, -0.62, -0.32, 0, 0.32, 0.62, 0.95].map((a) => {
      const [x, z] = lip(a, 0.04);
      return { geo: new THREE.ConeGeometry(0.038, 0.11, 6), mat: M.teeth, p: [x, -0.17, z], r: [Math.PI, 0, 0] };
    }),
    { geo: new THREE.SphereGeometry(0.33, 16, 12), mat: M.mouth, p: [0, -0.1, 0.16], s: [1, 0.55, 0.95] },
    ...mane,
  ], { outline: 0.024 }));
  // glowing eyes under the brow (no outline, so they burn), each with a soft halo
  const eyeGlow = new THREE.SpriteMaterial({ map: glowTex(), color: 0xffa020, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), M.eye);
    eye.position.set(sx * 0.2, 0.22, 0.465); eye.scale.set(0.95, 0.55, 0.4); eye.rotation.z = sx * 0.22;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), M.pupil);
    pupil.position.set(sx * 0.19, 0.215, 0.51); pupil.scale.set(0.9, 2.2, 0.6);
    const halo = new THREE.Sprite(eyeGlow);
    halo.position.set(sx * 0.2, 0.22, 0.55); halo.scale.setScalar(0.42);
    head.add(eye, pupil, halo);
  }
  // lower jaw (opens to roar/laugh): heavy and jutting, with two tusks
  const jaw = joint(head, 0, -0.12, 0.06);
  jaw.add(bake([
    { geo: loft(rows([
      [0.0, 0.38, 0.35, 0.1, 2.6], [-0.1, 0.39, 0.36, 0.1, 2.8], [-0.21, 0.35, 0.33, 0.08, 2.4], [-0.29, 0.24, 0.23, 0.02], [-0.32, 0.05, 0.05, 0.0],
    ]), { segs: 28, front: 1 }), mat: M.skin },
    { geo: new THREE.CircleGeometry(0.36, 24), mat: M.mouth, p: [0, 0.005, 0.09], r: [-Math.PI / 2, 0, 0], s: [1, 0.95, 1] },
    // great curved tusks jutting up over the lip
    { geo: taperedTube([[-0.25, -0.04, 0.3], [-0.29, 0.14, 0.36], [-0.25, 0.32, 0.34], [-0.19, 0.42, 0.3]], 0.068, { tip: 0.12, segments: 10 }), mat: M.teeth },
    { geo: taperedTube([[0.25, -0.04, 0.3], [0.29, 0.14, 0.36], [0.25, 0.32, 0.34], [0.19, 0.42, 0.3]], 0.068, { tip: 0.12, segments: 10 }), mat: M.teeth },
    ...[-0.1, 0, 0.1].map((x) => ({ geo: new THREE.ConeGeometry(0.03, 0.08, 6), mat: M.teeth, p: [x, 0.03, 0.4] })),
  ], { outline: 0.02 }));

  // ---------- arms ----------
  const fingerSet = (hand, curlList) => {
    for (const [x, len] of [[-0.1, 0.11], [-0.035, 0.13], [0.035, 0.13], [0.1, 0.11]]) {
      const j1 = joint(hand, x, -0.25, 0.0);
      j1.add(bake([{ geo: new THREE.CapsuleGeometry(0.048, len, 4, 8), mat: M.skin, p: [0, -len / 2 - 0.02, 0] }], { outline: 0.012 }));
      const j2 = joint(j1, 0, -len - 0.05, 0);
      j2.add(bake([
        { geo: new THREE.CapsuleGeometry(0.042, len * 0.8, 4, 8), mat: M.skin, p: [0, -len * 0.4 - 0.02, 0] },
        { geo: new THREE.ConeGeometry(0.034, 0.1, 6), mat: M.horn, p: [0, -len * 0.8 - 0.07, 0.015], r: [Math.PI - 0.35, 0, 0] },
      ], { outline: 0.012 }));
      curlList.push([j1, j2]);
    }
  };
  const arm = (sx) => {
    const shoulder = joint(chest, sx * 0.7, 0.98, 0);
    shoulder.add(bake([
      { geo: new THREE.SphereGeometry(0.29, 16, 12), mat: M.skin, p: [0, 0.02, 0], s: [1.04, 0.95, 0.98] },
      { geo: new THREE.CapsuleGeometry(0.2, 0.4, 6, 12), mat: M.skin, p: [0, -0.32, 0] },
      { geo: new THREE.SphereGeometry(0.17, 14, 10), mat: M.skin, p: [0, -0.3, 0.08], s: [1, 1.45, 0.95] },      // biceps
      { geo: new THREE.SphereGeometry(0.15, 12, 10), mat: M.skin, p: [0, -0.32, -0.08], s: [1, 1.4, 0.9] },     // triceps
    ], { outline: 0.024 }));
    const elbow = joint(shoulder, 0, -0.64, 0);
    elbow.add(bake([
      { geo: new THREE.SphereGeometry(0.2, 14, 10), mat: M.skin, p: [0, -0.14, 0], s: [1.05, 1.2, 1.05] },
      { geo: new THREE.CapsuleGeometry(0.16, 0.32, 6, 12), mat: M.skin, p: [0, -0.3, 0] },
      { geo: new THREE.SphereGeometry(0.17, 12, 10), mat: M.skin, p: [0, -0.2, 0.02], s: [1.05, 1.3, 1] },       // forearm swell
      // an iron bracer bound in gold
      { geo: new THREE.CylinderGeometry(0.19, 0.175, 0.2, 14), mat: M.iron, p: [0, -0.43, 0] },
      { geo: new THREE.TorusGeometry(0.188, 0.025, 6, 18), mat: M.gold, p: [0, -0.335, 0], r: [Math.PI / 2, 0, 0] },
      { geo: new THREE.TorusGeometry(0.175, 0.025, 6, 18), mat: M.gold, p: [0, -0.525, 0], r: [Math.PI / 2, 0, 0] },
    ], { outline: 0.022 }));
    elbow.add(bake([0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i / 6) * Math.PI * 2;
      return { geo: new THREE.ConeGeometry(0.03, 0.07, 6), mat: M.stud, p: [Math.sin(a) * 0.2, -0.43, Math.cos(a) * 0.2], r: [Math.cos(a) * 1.57, 0, -Math.sin(a) * 1.57] };
    }), { outline: 0 }));
    const hand = joint(elbow, 0, -0.55, 0);
    hand.add(bake([
      { geo: new THREE.SphereGeometry(0.18, 16, 12), mat: M.skin, p: [0, -0.12, 0], s: [1.1, 1.15, 0.6] },
      ...[-0.1, -0.035, 0.035, 0.1].map((x) => ({ geo: new THREE.SphereGeometry(0.055, 8, 6), mat: M.skin, p: [x, -0.23, -0.02] })),
      { geo: new THREE.CapsuleGeometry(0.055, 0.1, 4, 8), mat: M.skin, p: [-sx * 0.17, -0.12, -0.06], r: [0.4, 0, -sx * 0.5] },
    ], { outline: 0.016 }));
    const curls = [];
    fingerSet(hand, curls);
    return { shoulder, elbow, hand, curls };
  };
  const armR = arm(-1);     // grabbing arm
  const armL = arm(1);      // club arm

  // kanabō (studded iron club) in the left fist, resting over the shoulder
  const club = joint(armL.hand, 0, -0.22, -0.02);
  club.rotation.x = 1.75;
  club.add(bake([
    { geo: lathe([[0.07, -0.36], [0.055, -0.3], [0.055, 0.35], [0.1, 0.5], [0.19, 1.42], [0.15, 1.54], [0.0, 1.57]], 8), mat: M.iron },
    { geo: new THREE.TorusGeometry(0.08, 0.025, 6, 12), mat: M.gold, p: [0, 0.4, 0], r: [Math.PI / 2, 0, 0] },
    { geo: new THREE.TorusGeometry(0.19, 0.03, 6, 16), mat: M.gold, p: [0, 1.38, 0], r: [Math.PI / 2, 0, 0] },
    { geo: new THREE.TorusGeometry(0.07, 0.02, 6, 12), mat: M.gold, p: [0, -0.44, 0] },
    // the grip, bound with red cord
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ geo: new THREE.TorusGeometry(0.062, 0.018, 5, 10), mat: M.cord, p: [0, -0.24 + i * 0.09, 0], r: [Math.PI / 2 + (i % 2 ? 0.25 : -0.25), 0, 0] })),
  ], { outline: 0.02 }));
  // rows of chunky studs (no outline — tiny outlined cones shimmer)
  const studs = [];
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 7; j++) {
      const a = (j / 7) * Math.PI * 2 + i * 0.45, y = 0.6 + i * 0.15, r = 0.105 + i * 0.016;
      studs.push({ geo: new THREE.ConeGeometry(0.045, 0.1, 6), mat: M.stud, p: [Math.cos(a) * r, y, Math.sin(a) * r], r: [Math.sin(a) * 1.57, 0, -Math.cos(a) * 1.57] });
    }
  }
  club.add(bake(studs, { outline: 0 }));

  // ---------- legs ----------
  const leg = (sx) => {
    const hip = joint(pelvis, sx * 0.28, -0.06, 0);
    hip.add(bake([{ geo: new THREE.CapsuleGeometry(0.28, 0.28, 6, 14), mat: M.skin, p: [0, -0.28, 0], s: [1, 1, 1.05] }], { outline: 0.024 }));
    const knee = joint(hip, 0, -0.6, 0);
    knee.add(bake([
      { geo: new THREE.SphereGeometry(0.2, 12, 10), mat: M.skin, p: [0, -0.02, 0.08], s: [1, 0.85, 0.9] },     // kneecap
      { geo: new THREE.CapsuleGeometry(0.23, 0.3, 6, 14), mat: M.skin, p: [0, -0.25, 0] },
      { geo: new THREE.SphereGeometry(0.23, 12, 10), mat: M.skin, p: [0, -0.2, -0.08], s: [1.02, 1.25, 1] },   // calf
      // iron anklets bound in gold
      { geo: new THREE.CylinderGeometry(0.215, 0.225, 0.14, 14), mat: M.iron, p: [0, -0.44, 0] },
      { geo: new THREE.TorusGeometry(0.218, 0.024, 6, 18), mat: M.gold, p: [0, -0.37, 0], r: [Math.PI / 2, 0, 0] },
      { geo: new THREE.TorusGeometry(0.228, 0.024, 6, 18), mat: M.gold, p: [0, -0.51, 0], r: [Math.PI / 2, 0, 0] },
      { geo: new THREE.SphereGeometry(0.24, 14, 10), mat: M.skin, p: [0, -0.6, 0.12], s: [1, 0.42, 1.45] },
      ...[-0.12, -0.04, 0.04, 0.12].map((x) => ({ geo: new THREE.SphereGeometry(0.06, 8, 6), mat: M.skin, p: [x, -0.62, 0.42] })),
      ...[-0.12, -0.04, 0.04, 0.12].map((x) => ({ geo: new THREE.ConeGeometry(0.03, 0.07, 6), mat: M.horn, p: [x, -0.63, 0.49], r: [Math.PI / 2, 0, 0] })),
    ], { outline: 0.024 }));
    return { hip, knee };
  };
  const legL = leg(1), legR = leg(-1);

  /* ===================== animation ===================== */
  const pose = {
    pelvisY: 1.35, lean: 0, sway: 0, twist: 0, headX: 0, headY: 0, jaw: 0.05,
    shRx: 0, shRz: -0.25, elR: -0.2, shLx: -0.5, shLz: 0.25, elL: -1.9,
    thighL: 0, thighR: 0, kneeL: 0, kneeR: 0, curlR: 0.3,
  };
  let mode = 'idle', staggerT = 0, flashT = 0, roarT = 0, walkPhase = 0;

  function target(t) {
    const tg = { ...pose };
    Object.assign(tg, {
      pelvisY: 1.35 + 0.02 * Math.sin(t * 2), lean: 0.05, sway: 0, twist: 0, headX: 0.05, headY: 0, jaw: 0.08,
      shRx: 0.05, shRz: -0.28, elR: -0.25, shLx: -0.5, shLz: 0.28, elL: -1.9,
      thighL: 0, thighR: 0, kneeL: 0, kneeR: 0, curlR: 0.4,
    });
    if (mode === 'walk') {
      const s = Math.sin(walkPhase), c = Math.cos(walkPhase);
      Object.assign(tg, {
        pelvisY: 1.33 - 0.07 * Math.abs(s), sway: 0.07 * s, twist: 0.1 * s, lean: 0.12,
        thighL: 0.42 * s, thighR: -0.42 * s,
        kneeL: -0.7 * Math.max(0, c), kneeR: -0.7 * Math.max(0, -c),
        shRx: -0.35 * s, headY: -0.1 * s, headX: 0.12,
      });
    } else if (mode === 'roar') {
      Object.assign(tg, { lean: -0.2, headX: -0.4, jaw: 0.65, shRx: -0.9, shRz: -1.1, elR: -0.5, shLx: -1.1, shLz: 0.6 });
    } else if (mode === 'reach' || mode === 'grab') {
      Object.assign(tg, {
        lean: 0.5, headX: 0.35, jaw: 0.18, shRx: -1.0, shRz: -0.02, elR: -0.3,
        thighL: -0.25, kneeL: 0.0, thighR: 0.35, kneeR: -0.55, pelvisY: 1.22,
        curlR: mode === 'grab' ? 1.45 : -0.2,
      });
    } else if (mode === 'lift' || mode === 'laugh') {
      const k = mode === 'laugh' ? Math.abs(Math.sin(t * 13)) : 0;
      Object.assign(tg, {
        lean: -0.08 - 0.05 * k, headX: -0.15 - 0.15 * k, jaw: 0.22 + (mode === 'laugh' ? 0.35 * k : 0),
        shRx: -1.5, shRz: 0.12, elR: -1.15, curlR: 1.45, pelvisY: 1.35 + 0.03 * k,
        headY: mode === 'laugh' ? 0.08 * Math.sin(t * 3) : 0,
      });
    }
    if (roarT > 0) {
      const w = Math.sin(Math.min(1, roarT) * Math.PI);
      tg.headX -= 0.45 * w; tg.jaw += 0.55 * w; tg.lean -= 0.15 * w; tg.shRz -= 0.5 * w;
    }
    if (staggerT > 0) { tg.lean -= 0.4 * staggerT; tg.headX -= 0.35 * staggerT; }
    return tg;
  }

  return {
    root, body, head, chest,
    handR: armR.hand,
    get mode() { return mode; },
    setMode(m) { mode = m; },
    roar() { roarT = 1; },
    flash() { flashT = 1; staggerT = 1; },
    // jump every joint straight to the current mode's pose (for skipping cinematics)
    snap(t = 0) { Object.assign(pose, target(t)); this.apply(); },
    // back to a calm idle, as if new
    reset() {
      mode = 'idle'; staggerT = flashT = roarT = walkPhase = 0;
      M.skin.emissive.setRGB(0.17, 0.016, 0.016);
      this.snap();
    },
    update(dt, t, walkSpeed = 0) {
      walkPhase += dt * (1.2 + walkSpeed * 0.25) * Math.PI;
      staggerT = Math.max(0, staggerT - dt * 2.5);
      roarT = Math.max(0, roarT - dt * 0.9);
      flashT = Math.max(0, flashT - dt * 4);
      const tg = target(t);
      const k = 1 - Math.exp(-dt * (mode === 'grab' ? 14 : 7));
      for (const key in tg) pose[key] = smoothTo(pose[key], tg[key], k);
      M.skin.emissive.setRGB(0.17 + flashT * 0.9, 0.016 + flashT * 0.8, 0.016 + flashT * 0.6);
      this.apply();
    },
    apply() {
      pelvis.position.y = pose.pelvisY;
      pelvis.rotation.set(0, pose.twist * 0.5, pose.sway);
      chest.rotation.set(pose.lean, pose.twist, -pose.sway * 0.6);
      head.rotation.set(pose.headX, pose.headY, 0);
      jaw.rotation.x = pose.jaw;
      armR.shoulder.rotation.set(pose.shRx, 0, pose.shRz);
      armR.elbow.rotation.x = pose.elR;
      armL.shoulder.rotation.set(pose.shLx, 0, pose.shLz);
      armL.elbow.rotation.x = pose.elL;
      legL.hip.rotation.x = pose.thighL; legR.hip.rotation.x = pose.thighR;
      legL.knee.rotation.x = pose.kneeL; legR.knee.rotation.x = pose.kneeR;
      for (const [j1, j2] of armR.curls) { j1.rotation.x = pose.curlR; j2.rotation.x = pose.curlR * 0.9; }
      for (const [j1, j2] of armL.curls) { j1.rotation.x = 1.5; j2.rotation.x = 1.4; }
    },
    dispose() {
      root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        for (const m of [].concat(o.material || [])) if (!m.isShaderMaterial) m.dispose();   // keep the shared outline shader
      });
    },
  };
}
