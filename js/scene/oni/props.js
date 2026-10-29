// props.js — what the oni wears and carries, built in oni units: the tiger-skin
// loincloth, the studded kanabō, the iron cuffs. M: the oni's materials (index.js).
import * as THREE from 'three';
import { bake, lathe, taperedTube, loft } from '../toon.js';

// tiger-skin loincloth: a skirt lofted through cross-sections of the oni's own hips and
// thighs (measured on the sculpted body, in oni units, relative to the hips bone) so it
// wraps them snugly, with a twisted straw rope belt bedded into its top edge, a knot and
// hanging ends at the front, a ragged hem and the tiger's tail at the hip
export function buildPelt(M, rows) {
  const top = rows[0], hem = rows[rows.length - 1];
  const ring = (r, y, out, n, f) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push(f(a, Math.sin(a) * (r.rx + out), y, r.cz + Math.cos(a) * (r.rz + out)));
    }
    return pts;
  };
  const rope = (phase) => taperedTube(ring(top, top.y - 0.03, 0.0, 48, (a, x, y, z) => {
    const tw = a * 11 + phase, d = 0.022 * Math.cos(tw);
    return [x + Math.sin(a) * d, y + 0.022 * Math.sin(tw), z + Math.cos(a) * d];
  }), 0.036, { tip: 1, segments: 144, radial: 6 });
  const tufts = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2 + 0.1, len = 0.12 + ((i * 5) % 3) * 0.035;
    tufts.push({ geo: new THREE.ConeGeometry(0.065, len, 5), mat: M.tiger,
      p: [Math.sin(a) * (hem.rx - 0.02), hem.y - len / 2 + 0.03, hem.cz + Math.cos(a) * (hem.rz - 0.02)], r: [Math.PI, 0, 0] });
  }
  const fx = 0.12, fz = top.cz + top.rz + 0.01;          // the knot, on the front of the belt
  return bake([
    { geo: loft(rows.map((r) => ({ y: r.y, rx: r.rx, rz: r.rz, cz: r.cz, e: 2.3 })), { segs: 32, uRep: 2 }), mat: M.tiger },
    ...tufts,
    { geo: rope(0), mat: M.rope },
    { geo: rope(Math.PI), mat: M.rope },
    { geo: new THREE.SphereGeometry(0.075, 10, 8), mat: M.rope, p: [fx, top.y - 0.03, fz], s: [1.2, 1, 0.8] },
    { geo: taperedTube([[fx, top.y - 0.05, fz + 0.02], [fx + 0.04, top.y - 0.25, fz + 0.06], [fx, top.y - 0.48, fz + 0.07]], 0.035, { tip: 0.6 }), mat: M.rope },
    { geo: taperedTube([[fx, top.y - 0.05, fz + 0.02], [fx + 0.1, top.y - 0.2, fz + 0.05], [fx + 0.14, top.y - 0.4, fz + 0.06]], 0.035, { tip: 0.6 }), mat: M.rope },
    { geo: taperedTube([[-top.rx, top.y - 0.12, top.cz], [-hem.rx - 0.08, hem.y - 0.15, hem.cz + 0.02], [-hem.rx - 0.06, hem.y - 0.48, hem.cz + 0.1], [-hem.rx, hem.y - 0.68, hem.cz + 0.2]], 0.05, { tip: 0.5 }), mat: M.tiger },
  ], { outline: 0.02 });
}

// kanabō (studded iron club), gripped in the left fist and resting over the shoulder
export function buildClub(M) {
  const club = new THREE.Group();
  club.position.set(0, -0.2, 0.0);
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
  return club;
}

// iron cuffs bound in gold, sized to the limb they close around (oni units)
export function buildCuff(M, r, h, studs) {
  const g = new THREE.Group();
  g.add(bake([
    { geo: new THREE.CylinderGeometry(r, r * 0.97, h, 16), mat: M.iron },
    { geo: new THREE.TorusGeometry(r, 0.022, 6, 20), mat: M.gold, p: [0, h / 2, 0], r: [Math.PI / 2, 0, 0] },
    { geo: new THREE.TorusGeometry(r * 0.97, 0.022, 6, 20), mat: M.gold, p: [0, -h / 2, 0], r: [Math.PI / 2, 0, 0] },
  ], { outline: 0.02 }));
  if (studs) {
    g.add(bake([0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i / 6) * Math.PI * 2;
      return { geo: new THREE.ConeGeometry(0.026, 0.06, 6), mat: M.stud, p: [Math.sin(a) * r, 0, Math.cos(a) * r], r: [Math.cos(a) * 1.57, 0, -Math.sin(a) * 1.57] };
    }), { outline: 0 }));
  }
  return g;
}
