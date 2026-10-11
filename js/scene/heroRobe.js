// heroRobe.js — dresses the VRM hero as an onmyōji. The model's school clothes are
// hidden and a kariginu is built around its body: white robe with huge hanging
// sleeves (lavender lining, red cords), split front/back skirts, violet sashinuki
// trousers gathered at the ankle, a sash with a red cord, the layered round collar,
// the Seimei crest on the back and black lacquered asagutsu over white tabi.
//
// Everything is fitted to the model's rest pose (T-pose, world units) at load time
// and skinned to its own skeleton, plus a few extra "jiggle" bones that Verlet
// chains drive so the sleeve pockets and skirts hang and swing with gravity, wind
// and the body's motion.
import * as THREE from 'three';
import { toon, bake, addOutline, loft } from './toon.js';
import { crestTex, sashinukiTex, robeFoldTex } from './textures.js';

const TAU = Math.PI * 2;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, k) => a + (b - a) * k;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const COLORS = { robe: 0xf4f1ea, lining: 0xb9aee6, inner: 0xb52b36, lavender: 0x9c8fd6, sash: 0xfbf9f4, cord: 0xd6343c, shoe: 0x17131d, tabi: 0xffffff };

/* ===================== skinning helpers ===================== */
// Weights along a monotonic scalar s: bones ordered from high s to low s, blended across each joint
function chainW(s, bones, joints, blends) {
  const t = joints.map((j, i) => smooth(j + blends[i], j - blends[i], s));
  const out = [];
  bones.forEach((b, i) => {
    const w = (i === 0 ? 1 : t[i - 1]) - (i < t.length ? t[i] : 0);
    if (w > 1e-3) out.push([b, w]);
  });
  return out;
}

// Add skinIndex/skinWeight to a geometry from a weights(x, y, z) → [[boneName, w]] function (world coords)
function skin(geo, weights, boneIndex) {
  const pos = geo.attributes.position, skI = [], skW = [];
  for (let i = 0; i < pos.count; i++) {
    const w = weights(pos.getX(i), pos.getY(i), pos.getZ(i)).sort((p, q) => q[1] - p[1]).slice(0, 4);
    const sum = w.reduce((s, [, v]) => s + v, 0) || 1;
    for (let k = 0; k < 4; k++) { skI.push(w[k] ? boneIndex.get(w[k][0]) : 0); skW.push(w[k] ? w[k][1] / sum : 0); }
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skI, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skW, 4));
  return geo;
}

function mergeGeos(list) {
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'skinIndex', 'skinWeight']) {
    const first = list[0].attributes[name];
    const total = list.reduce((s, g) => s + g.attributes[name].array.length, 0);
    const arr = new first.array.constructor(total);
    let off = 0;
    for (const g of list) { arr.set(g.attributes[name].array, off); off += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, first.itemSize));
  }
  const idx = [];
  let base = 0;
  for (const g of list) { for (const i of g.index.array) idx.push(i + base); base += g.attributes.position.count; }
  out.setIndex(idx);
  return out;
}

/* ===================== swept strands (cord tassels) ===================== */
class Sweep {
  constructor(n, width, thick, radial = 6) {
    this.n = n; this.radial = radial; this.width = width; this.thick = thick;
    this.pos = new Float32Array(n * (radial + 1) * 3);
    const idx = [];
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + 1, c = a + radial + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * (radial + 1) * 2), 2));
    this.geo.setIndex(idx);
    this.N = new THREE.Vector3(0, 0, 1);
    this._t = new THREE.Vector3(); this._o = new THREE.Vector3(); this._b = new THREE.Vector3(); this._n = new THREE.Vector3();
  }
  update(pts, ref) {
    const { n, radial } = this, T = this._t, O = this._o, Bv = this._b, N = this._n;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      T.subVectors(pts[Math.min(i + 1, n - 1)], pts[Math.max(i - 1, 0)]).normalize();
      O.subVectors(p, ref).normalize();
      N.copy(O).addScaledVector(T, -O.dot(T));
      if (N.lengthSq() < 1e-6) N.copy(this.N); else N.normalize();
      this.N.copy(N);
      Bv.crossVectors(T, N).normalize();
      const t = i / (n - 1), w = this.width(t), h = this.thick(t);
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * TAU, ca = Math.cos(a) * w, sa = Math.sin(a) * h, k = (i * (radial + 1) + j) * 3;
        this.pos[k] = p.x + Bv.x * ca + N.x * sa; this.pos[k + 1] = p.y + Bv.y * ca + N.y * sa; this.pos[k + 2] = p.z + Bv.z * ca + N.z * sa;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    return this.geo;
  }
}

/* ===================== Verlet chains ===================== */
const DOWN = new THREE.Vector3(0, -1, 0);
class Chain {
  constructor({ bone, offset, dir, segs, len, stiff = 0.05, tipStiff = stiff, damping = 0.96, drag = 1.2, radius = 0.03, gravity = 1, colliders = [], drive = null }) {
    Object.assign(this, { bone, offset: offset.clone(), dir: dir.clone().normalize(), segs, len, stiff, tipStiff, damping, drag, radius, gravity, colliders, drive });
    this.pts = Array.from({ length: segs + 1 }, () => new THREE.Vector3());
    this.prev = Array.from({ length: segs + 1 }, () => new THREE.Vector3());
    this.restDir = new THREE.Vector3();
    this._q = new THREE.Quaternion();
  }
  anchor() {
    this.bone.localToWorld(this.pts[0].copy(this.offset));
    this.prev[0].copy(this.pts[0]);
    this.bone.getWorldQuaternion(this._q);
    this.restDir.copy(this.dir).applyQuaternion(this._q);
  }
  settle() {
    this.anchor();
    for (let i = 1; i <= this.segs; i++) { this.pts[i].copy(this.pts[i - 1]).addScaledVector(this.restDir, this.len); this.prev[i].copy(this.pts[i]); }
  }
  step(dt, wind, cols) {
    this.anchor();
    const g = 9.8 * this.gravity, { pts, prev, damping, drag, len, segs } = this;
    for (let i = 1; i <= segs; i++) {
      const p = pts[i], q = prev[i];
      const vx = (p.x - q.x) * damping, vy = (p.y - q.y) * damping, vz = (p.z - q.z) * damping;
      q.copy(p);
      p.x += vx + (wind.x * dt - vx) * drag * dt;
      p.y += vy + (wind.y * dt - vy) * drag * dt - g * dt * dt;
      p.z += vz + (wind.z * dt - vz) * drag * dt;
    }
    for (let it = 0; it < 4; it++) {
      for (let i = 1; i <= segs; i++) {
        const p = pts[i], a = pts[i - 1], k = lerp(this.stiff, this.tipStiff, i / segs);
        p.x += (a.x + this.restDir.x * len - p.x) * k;
        p.y += (a.y + this.restDir.y * len - p.y) * k;
        p.z += (a.z + this.restDir.z * len - p.z) * k;
        const dx = p.x - a.x, dy = p.y - a.y, dz = p.z - a.z, l = Math.hypot(dx, dy, dz) || 1e-6;
        p.set(a.x + (dx / l) * len, a.y + (dy / l) * len, a.z + (dz / l) * len);
        for (const ci of this.colliders) collide(p, this.radius, cols[ci]);
      }
    }
  }
  applyToBones() {
    if (!this.drive) return;
    const d = new THREE.Vector3(), q = this._q;
    this.drive.forEach((b, i) => {
      b.parent.getWorldQuaternion(q);
      d.subVectors(this.pts[i + 1], this.pts[i]).normalize().applyQuaternion(q.invert());
      b.quaternion.setFromUnitVectors(DOWN, d);
      b.updateMatrixWorld(true);
    });
  }
}
const _seg = new THREE.Vector3(), _rel = new THREE.Vector3();
function collide(p, r, c) {
  let qx, qy, qz;
  if (c.b) {
    _seg.subVectors(c.b, c.a);
    const t = clamp01(_rel.subVectors(p, c.a).dot(_seg) / Math.max(1e-6, _seg.lengthSq()));
    qx = c.a.x + _seg.x * t; qy = c.a.y + _seg.y * t; qz = c.a.z + _seg.z * t;
  } else { qx = c.a.x; qy = c.a.y; qz = c.a.z; }
  const dx = p.x - qx, dy = p.y - qy, dz = p.z - qz, d = Math.hypot(dx, dy, dz), min = c.r + r;
  if (d < min && d > 1e-6) p.set(qx + (dx / d) * min, qy + (dy / d) * min, qz + (dz / d) * min);
}

/* ===================== the outfit ===================== */
export function dressHero(vrm, root, modelScale, dynamic) {
  root.updateMatrixWorld(true);
  const raw = (n) => vrm.humanoid.getRawBoneNode(n);
  const wp = (n) => raw(n).getWorldPosition(new THREE.Vector3());
  const P = {};
  for (const n of ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperArm', 'rightLowerArm', 'rightHand',
    'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'rightUpperLeg', 'rightLowerLeg', 'rightFoot']) P[n] = wp(n);
  const armY = P.rightUpperArm.y;                     // the arms lie along ±x at this height in the rest pose

  // hide the school uniform (the body skin, face and hair stay)
  vrm.scene.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) if (/Tops|Accessory|Bottoms|Shoes/.test(m.name)) m.visible = false;
  });

  /* ---------- bones: the model's own, plus jiggle bones for sleeves and skirts ---------- */
  const B = {
    hips: raw('hips'), spine: raw('spine'), chest: raw('chest'), upperChest: raw('upperChest'), neck: raw('neck'),
    uaL: raw('leftUpperArm'), laL: raw('leftLowerArm'), hdL: raw('leftHand'), uaR: raw('rightUpperArm'), laR: raw('rightLowerArm'), hdR: raw('rightHand'),
    ulL: raw('leftUpperLeg'), llL: raw('leftLowerLeg'), ftL: raw('leftFoot'), ulR: raw('rightUpperLeg'), llR: raw('rightLowerLeg'), ftR: raw('rightFoot'),
  };
  const mkBone = (name, parent, world) => {
    const b = new THREE.Bone();
    b.name = name;
    parent.add(b);
    b.position.copy(parent.worldToLocal(world.clone()));
    b.updateMatrixWorld(true);
    B[name] = b;
  };
  for (const [s, sx] of [['L', -1], ['R', 1]]) {
    mkBone('sleeveA' + s, B['la' + s], V(sx * 0.43, armY, 0));
    mkBone('sleeveB' + s, B['sleeveA' + s], V(sx * 0.43, armY - 0.15, 0));
  }
  mkBone('backA', B.hips, V(0, 1.0, 0.1)); mkBone('backB', B.backA, V(0, 0.85, 0.1)); mkBone('backC', B.backB, V(0, 0.7, 0.1));
  mkBone('frontA', B.hips, V(0, 1.0, -0.1)); mkBone('frontB', B.frontA, V(0, 0.8, -0.1));
  const boneNames = Object.keys(B);
  const boneIndex = new Map(boneNames.map((n, i) => [n, i]));
  const skeleton = new THREE.Skeleton(boneNames.map((n) => B[n]));

  /* ---------- materials ---------- */
  const sashinuki = sashinukiTex();
  sashinuki.repeat.set(2, 1.6);
  const M = {
    cloth: toon(0xffffff, { map: robeFoldTex() }),
    lining: toon(COLORS.lining, { side: THREE.BackSide }),
    inner: toon(COLORS.inner),
    lavender: toon(COLORS.lavender),
    robe: toon(COLORS.robe),
    pants: toon(0xffffff, { map: sashinuki }),
    sash: toon(COLORS.sash),
    cord: toon(COLORS.cord),
    shoe: toon(COLORS.shoe),
    tabi: toon(COLORS.tabi),
    crest: toon(0xffffff, { map: crestTex(), transparent: true, alphaTest: 0.4 }),
  };
  const materials = Object.values(M);

  const skinnedMesh = (geo, mat, outline) => {
    const m = new THREE.SkinnedMesh(geo, mat);
    m.frustumCulled = false;
    root.add(m);
    m.bind(skeleton);
    if (outline) addOutline(m, outline);
    return m;
  };
  const clothMesh = (geo, outline = 0.007) => { skinnedMesh(geo, M.cloth, outline); skinnedMesh(geo, M.lining, 0); };
  const torsoW = (x, y) => chainW(y, ['neck', 'upperChest', 'chest', 'spine', 'hips'], [1.345, 1.225, 1.157, 1.06], [0.03, 0.04, 0.04, 0.04]);

  /* ---------- robe torso (fitted to the body's measured outline) ---------- */
  skinnedMesh(skin(loft([
    { y: 1.405, rx: 0.062, rz: 0.058, cz: 0.0 }, { y: 1.375, rx: 0.125, rz: 0.085, cz: -0.005 }, { y: 1.335, rx: 0.168, rz: 0.098, cz: -0.012, e: 2.2 },
    { y: 1.285, rx: 0.152, rz: 0.102, cz: -0.018, e: 2.2 }, { y: 1.2, rx: 0.136, rz: 0.102, cz: -0.024, e: 2.2 }, { y: 1.12, rx: 0.13, rz: 0.1, cz: -0.022, e: 2.2 },
    { y: 1.05, rx: 0.138, rz: 0.106, cz: -0.013, e: 2.2 }, { y: 0.995, rx: 0.148, rz: 0.112, cz: -0.007, e: 2.2 },
  ], { segs: 26, seam: Math.PI / 2 }), torsoW, boneIndex), M.cloth, 0.008);

  /* ---------- sleeves: a flat panel along the arm whose pocket hangs below it ---------- */
  // rows: [distance along the arm, half-height, half-depth, centre drop below the arm axis, boxiness]
  const sleeveRows = [
    [0.15, 0.074, 0.072, 0.0, 2.2], [0.2, 0.1, 0.08, -0.03, 2.4], [0.3, 0.165, 0.088, -0.09, 2.8], [0.4, 0.19, 0.088, -0.12, 3],
    [0.48, 0.18, 0.082, -0.11, 2.8], [0.53, 0.12, 0.068, -0.06, 2.4], [0.565, 0.078, 0.058, -0.02, 2],
  ];
  const sleeveGeo = (sx, grow = 0, rows = sleeveRows) => {
    // lofted along -y in a local frame, then stood up along the arm: Rz(±90°) maps local y → world ∓x, local x → world y
    const g = loft(rows.map(([ax, ry, rz, cy, e]) => ({ y: -ax, rx: ry + grow, rz: rz + grow, cx: sx * cy, e })), { segs: 20 });
    g.applyMatrix4(new THREE.Matrix4().makeTranslation(0, armY, 0).multiply(new THREE.Matrix4().makeRotationZ(sx * Math.PI / 2)));
    return g;
  };
  const sleeveW = (s, sx) => (x, y) => {
    const j = smooth(armY - 0.045, armY - 0.14, y);                 // pocket below the arm → jiggle bones
    return [
      ...chainW(-sx * x, ['ua' + s, 'la' + s, 'hd' + s], [-Math.abs(P[s === 'L' ? 'leftLowerArm' : 'rightLowerArm'].x), -0.545], [0.05, 0.015]).map(([b, w]) => [b, w * (1 - j)]),
      ...chainW(y, ['sleeveA' + s, 'sleeveB' + s], [armY - 0.075], [0.07]).map(([b, w]) => [b, w * j]),
    ].filter(([, w]) => w > 1e-3);
  };
  clothMesh(mergeGeos([['L', -1], ['R', 1]].map(([s, sx]) => skin(sleeveGeo(sx), sleeveW(s, sx), boneIndex))));
  // red cord trim around each sleeve mouth
  skinnedMesh(mergeGeos([['L', -1], ['R', 1]].map(([s, sx]) => {
    const cuff = sleeveRows[sleeveRows.length - 1];
    return skin(sleeveGeo(sx, 0.004, [[cuff[0] - 0.014, ...cuff.slice(1)], cuff]), sleeveW(s, sx), boneIndex);
  })), M.cord, 0);

  /* ---------- split skirts, front and back ---------- */
  clothMesh(skin(loft([
    { y: 1.0, rx: 0.155, rz: 0.118 }, { y: 0.92, rx: 0.16, rz: 0.124 }, { y: 0.82, rx: 0.168, rz: 0.132 }, { y: 0.72, rx: 0.176, rz: 0.14 }, { y: 0.62, rx: 0.182, rz: 0.146 }, { y: 0.55, rx: 0.184, rz: 0.148 },
  ].map((r) => ({ ...r, e: 2.6 })), { segs: 14, a0: -1.02, a1: 1.02 }),
  (x, y) => chainW(y, ['hips', 'backA', 'backB', 'backC'], [0.965, 0.86, 0.72], [0.03, 0.06, 0.06]), boneIndex));
  clothMesh(skin(loft([
    { y: 1.0, rx: 0.152, rz: 0.115, cz: -0.012 }, { y: 0.9, rx: 0.158, rz: 0.12, cz: -0.012 }, { y: 0.78, rx: 0.166, rz: 0.128, cz: -0.01 }, { y: 0.66, rx: 0.174, rz: 0.134, cz: -0.008 }, { y: 0.56, rx: 0.18, rz: 0.138, cz: -0.006 },
  ].map((r) => ({ ...r, e: 2.6 })), { segs: 12, a0: Math.PI - 0.78, a1: Math.PI + 0.78 }),
  (x, y) => chainW(y, ['hips', 'frontA', 'frontB'], [0.965, 0.8], [0.03, 0.06]), boneIndex));

  /* ---------- sashinuki trousers ---------- */
  const legCx = (y) => lerp(0.041, 0.07, clamp01((y - 0.15) / 0.8));
  const legRows = (sx) => [
    [0.985, 0.102], [0.9, 0.108], [0.78, 0.104], [0.64, 0.1], [0.5, 0.1], [0.36, 0.104], [0.26, 0.106], [0.19, 0.1], [0.145, 0.082], [0.115, 0.055], [0.095, 0.044], [0.08, 0.042],
  ].map(([y, r]) => ({ y, rx: r, rz: r * 0.92, cx: sx * legCx(y), e: 2.2 }));
  const legW = (s) => (x, y) => chainW(y, ['hips', 'ul' + s, 'll' + s, 'ft' + s], [0.93, P.leftLowerLeg.y, P.leftFoot.y], [0.04, 0.06, 0.02]);
  skinnedMesh(mergeGeos([
    skin(loft([{ y: 1.03, rx: 0.15, rz: 0.116, cz: -0.007 }, { y: 0.96, rx: 0.156, rz: 0.12, cz: -0.006 }, { y: 0.9, rx: 0.162, rz: 0.125, cz: -0.004 }].map((r) => ({ ...r, e: 2.3 })), { segs: 24, uRep: 3 }), () => [['hips', 1]], boneIndex),
    ...[['L', -1], ['R', 1]].map(([s, sx]) => skin(loft(legRows(sx), { segs: 16, seam: -sx * Math.PI / 2, uRep: 2 }), legW(s), boneIndex)),
  ]), M.pants, 0.009);

  /* ---------- rigid pieces on bones (authored in world units, parented to the model's bones) ---------- */
  const attach = (bone, mesh, world) => {
    bone.add(mesh);
    mesh.position.copy(bone.worldToLocal(world.clone()));
    mesh.scale.setScalar(1 / modelScale);
    return mesh;
  };
  // sash (ate-obi) with the red cord, knotted at the front right
  attach(B.hips, bake([
    { geo: new THREE.CylinderGeometry(1, 1, 0.07, 28), mat: M.sash, s: [0.153, 1, 0.118] },
    { geo: new THREE.TorusGeometry(1, 0.075, 6, 32), mat: M.cord, p: [0, -0.02, 0], r: [Math.PI / 2, 0, 0], s: [0.156, 0.12, 0.16] },
    { geo: new THREE.SphereGeometry(0.018, 10, 8), mat: M.cord, p: [0.07, -0.02, -0.122] },
  ], { outline: 0.006 }), V(0, 1.035, -0.007));
  // layered round collar: crimson, lavender, then the white kariginu collar with a toggle
  attach(B.upperChest, bake([
    { geo: new THREE.TorusGeometry(0.052, 0.015, 8, 24), mat: M.inner, p: [0, 0.016, 0.004], r: [Math.PI / 2 - 0.15, 0, 0], s: [1, 0.86, 1] },
    { geo: new THREE.TorusGeometry(0.064, 0.016, 8, 24), mat: M.lavender, p: [0, 0.006, 0.002], r: [Math.PI / 2 - 0.15, 0, 0], s: [1, 0.86, 1] },
    { geo: new THREE.TorusGeometry(0.079, 0.024, 10, 28), mat: M.robe, p: [0, -0.006, 0], r: [Math.PI / 2 - 0.12, 0, 0], s: [1, 0.86, 1] },
    { geo: new THREE.SphereGeometry(0.014, 8, 6), mat: M.inner, p: [0.075, -0.012, -0.045] },
  ], { outline: 0.006 }), V(0, 1.405, -0.002));
  const crest = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), M.crest);
  attach(B.upperChest, crest, V(0, 1.2, 0.097));
  // asagutsu (black lacquered shoes) over white tabi
  for (const [s, sx] of [['L', -1], ['R', 1]]) {
    const foot = P[s === 'L' ? 'leftFoot' : 'rightFoot'];
    attach(B['ft' + s], bake([
      { geo: new THREE.SphereGeometry(0.06, 16, 12), mat: M.shoe, p: [0, -0.062, -0.07], s: [1.0, 0.75, 1.9] },
      { geo: new THREE.CylinderGeometry(0.042, 0.05, 0.06, 12), mat: M.tabi, p: [0, -0.015, -0.01] },
    ], { outline: 0.006 }), V(foot.x, foot.y, foot.z));
  }

  /* ---------- simulated chains: sleeve pockets, skirts, sash tassels ---------- */
  const cols = [];          // 0 head, 1 torso, 2/3 thigh L/R, 4/5 shin L/R
  for (let i = 0; i < 6; i++) cols.push({ a: new THREE.Vector3(), b: i ? new THREE.Vector3() : null, r: [0.13, 0.15, 0.085, 0.085, 0.07, 0.07][i] });
  const chains = [], strands = [];
  const driver = (bone, drive, segs, len, extra) => {
    const ch = new Chain({ bone, offset: drive[0].position.clone(), dir: V(0, -1, 0.05), segs, len, drive, ...extra });
    chains.push(ch);
    return ch;
  };
  driver(B.laL, [B.sleeveAL, B.sleeveBL], 2, 0.15, { stiff: 0.03, drag: 1.6, radius: 0.08, colliders: [1, 2] });
  driver(B.laR, [B.sleeveAR, B.sleeveBR], 2, 0.15, { stiff: 0.03, drag: 1.6, radius: 0.08, colliders: [1, 3] });
  driver(B.hips, [B.backA, B.backB, B.backC], 3, 0.15, { stiff: 0.12, tipStiff: 0.04, drag: 1.3, radius: 0.07, colliders: [2, 3, 4, 5], dir: V(0, -1, 0.1) });
  driver(B.hips, [B.frontA, B.frontB], 2, 0.2, { stiff: 0.15, drag: 1.2, radius: 0.06, colliders: [2, 3, 4, 5], dir: V(0, -1, -0.08) });
  const hipsRef = new THREE.Vector3();
  for (const sd of [0, 1]) {
    const ch = new Chain({ bone: B.hips, offset: B.hips.worldToLocal(V(0.07 + sd * 0.012, 1.015, -0.125)), dir: V(0.1, -1, -0.1), segs: 3, len: 0.045, stiff: 0.05, tipStiff: 0.0, drag: 1.8, radius: 0.01, colliders: [2, 3] });
    const sw = new Sweep(4, (t) => (t > 0.75 ? 0.016 : 0.006), (t) => (t > 0.75 ? 0.016 : 0.006), 6);
    const mesh = new THREE.Mesh(sw.geo, M.cord);
    mesh.frustumCulled = false;
    dynamic.add(mesh);
    addOutline(mesh, 0.003);
    chains.push(ch);
    strands.push({ ch, sw });
  }

  const tmp = new THREE.Vector3(), lastHips = new THREE.Vector3(), wind = new THREE.Vector3();
  let settled = false;
  function updateColliders() {
    raw('head').localToWorld(cols[0].a.set(0, 0.1, 0));
    B.hips.getWorldPosition(cols[1].a);
    B.upperChest.getWorldPosition(cols[1].b);
    for (const [i, s] of [[2, 'L'], [3, 'R']]) {
      B['ul' + s].getWorldPosition(cols[i].a);
      B['ll' + s].getWorldPosition(cols[i].b);
      B['ll' + s].getWorldPosition(cols[i + 2].a);
      B['ft' + s].getWorldPosition(cols[i + 2].b);
    }
    B.hips.getWorldPosition(hipsRef);
  }
  function settle() {
    updateColliders();
    for (const ch of chains) ch.settle();
    for (let i = 0; i < 40; i++) for (const ch of chains) { ch.step(1 / 60, wind, cols); ch.applyToBones(); }
    settled = true;
  }

  return {
    materials,
    // call after the body is posed and its matrices are current
    update(dt, speed, t) {
      updateColliders();
      B.hips.getWorldPosition(tmp);
      if (!settled || tmp.distanceTo(lastHips) > 0.6) settle();
      lastHips.copy(tmp);
      const gust = 0.5 * Math.sin(t * 1.3) + 0.3 * Math.sin(t * 3.7);
      wind.set(0.35 * Math.sin(t * 0.7), 0.15 * Math.sin(t * 2.1), speed * 0.9 + 0.8 + gust);
      const h = Math.min(dt, 1 / 30) / 2;
      for (let s = 0; s < 2; s++) for (const ch of chains) ch.step(h, wind, cols);
      for (const ch of chains) ch.applyToBones();
      for (const st of strands) st.sw.update(st.ch.pts, hipsRef);
    },
  };
}
