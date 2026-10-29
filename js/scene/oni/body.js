// body.js — the oni's body: the hero's VRM loaded a second time, stripped to its
// bare body and re-sculpted into a brute (see index.js for the whole story).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Oni units: the frame the procedural parts are built in (old oni scale, horn tips at
// y ≈ 4.15). The VRM is scaled so its head bone lands under the procedural head.
export const HEAD_SCALE = 0.75;
const HEAD_Y = 3.22;                        // procedural head origin: horn tips at 3.22 + 1.24 · 0.75 ≈ 4.15
export const HEAD_ABOVE_BONE = 0.26;                // ... above the VRM head bone

// Bulk per bone: how much each bone's own segment is stretched along the model's axes
// (x across, y up, z front-back; the model is in T-pose, so every segment is axis
// aligned). Children are re-placed at the stretched ends of their parents, so the
// skeleton grows with the flesh. Right-side bones use the left-side entries.
const BULK = {
  J_Bip_C_Hips: [1.7, 1.0, 1.6],
  J_Bip_C_Spine: [2.8, 1.1, 2.5],            // a thick waist and belly
  J_Bip_C_Chest: [3.3, 1.05, 2.5],
  J_Bip_C_UpperChest: [3.8, 1.0, 2.45],
  J_Bip_C_Neck: [3.4, 0.5, 3.0],               // a bull neck: trapezius mass under the head
  J_Bip_C_Head: [3.4, 0.6, 3.0],
  J_Bip_L_Shoulder: [3.5, 3.3, 2.9],           // long collarbones (broad shoulders), heavy traps
  J_Bip_L_UpperArm: [1.35, 3.5, 3.3],
  J_Bip_L_LowerArm: [1.3, 3.2, 3.0],
  J_Bip_L_Hand: [1.5, 2.6, 2.5],
  J_Bip_L_UpperLeg: [2.3, 1.0, 2.5],
  J_Bip_L_LowerLeg: [2.25, 1.0, 2.3],
  J_Bip_L_Foot: [2.0, 1.5, 1.6],
};

// the sculpted body, once the VRM has loaded (null until then, or if it failed)
export let template = null;
export const templateReady = new GLTFLoader().loadAsync('./models/hero.vrm')
  .then((gltf) => { template = buildTemplate(gltf.scene); return template; })
  .catch((err) => { console.error('[math-run] oni body failed to load', err); return null; });

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);

function buildTemplate(scene) {
  // keep the bare body, drop face, eyes, hair and clothes
  const meshes = [], drop = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (o.isSkinnedMesh && /Body_00_SKIN/.test([].concat(o.material)[0].name)) meshes.push(o);
    else drop.push(o);
  });
  for (const o of drop) { o.removeFromParent(); o.geometry.dispose(); }
  scene.updateMatrixWorld(true);

  // per-bone stretch, and the bones' old and new rest positions (model space)
  const bones = [];
  scene.traverse((o) => { if (o.isBone) bones.push(o); });       // parents before children
  const S = new Map(), oldP = new Map(), newP = new Map();
  for (const b of bones) {
    const s = BULK[b.name.replace('_R_', '_L_')];
    S.set(b, s ? new THREE.Vector3(...s) : b.parent?.isBone ? S.get(b.parent) : new THREE.Vector3(1, 1, 1));
    oldP.set(b, b.getWorldPosition(new THREE.Vector3()));
  }
  for (const b of bones) {
    const p = b.parent?.isBone ? b.parent : null;
    newP.set(b, p ? oldP.get(b).clone().sub(oldP.get(p)).multiply(S.get(p)).add(newP.get(p)) : oldP.get(b).clone());
  }

  // Each skin relates bind space to the scene by C = boneWorld · boneInverse (the same
  // for every bone at rest). Move every vertex with its bones in scene space:
  //   v' = Σ w · (newStart + S ⊙ (v − oldStart))
  const C = new Map(), Cinv = new Map();
  for (const mesh of meshes) {
    const sk = mesh.skeleton, c = sk.bones[0].matrixWorld.clone().multiply(sk.boneInverses[0]);
    C.set(mesh, c); Cinv.set(mesh, c.clone().invert());
  }
  const done = new Set();          // the body's primitives share one vertex buffer: move it once
  for (const mesh of meshes) {
    const g = mesh.geometry, pos = g.attributes.position, nor = g.attributes.normal;
    g.userData.oniTemplate = true;
    if (done.has(pos.array)) continue;
    done.add(pos.array);
    const skI = g.attributes.skinIndex, skW = g.attributes.skinWeight, sk = mesh.skeleton.bones;
    const toWorld = C.get(mesh).clone().multiply(mesh.bindMatrix);
    const toLocal = mesh.bindMatrixInverse.clone().multiply(Cinv.get(mesh));
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(toWorld);
      _a.set(0, 0, 0); _b.set(0, 0, 0);
      if (nor) _n.fromBufferAttribute(nor, i);
      let wsum = 0;
      for (let k = 0; k < 4; k++) {
        const w = skW.getComponent(i, k);
        if (!w) continue;
        const bone = sk[skI.getComponent(i, k)], s = S.get(bone) ?? ONE;
        _a.addScaledVector(_v.clone().sub(oldP.get(bone)).multiply(s).add(newP.get(bone)), w);
        if (nor) _b.addScaledVector(_n.clone().divide(s), w);
        wsum += w;
      }
      _a.divideScalar(wsum || 1);
      _a.applyMatrix4(toLocal);
      pos.setXYZ(i, _a.x, _a.y, _a.z);
      if (nor) { _b.normalize(); nor.setXYZ(i, _b.x, _b.y, _b.z); }
    }
    pos.needsUpdate = true;
    if (nor) nor.needsUpdate = true;
    g.computeBoundingBox(); g.computeBoundingSphere();
    g.userData.oniTemplate = true;
  }
  // re-place the bones and re-bind each skin to them (keeping its C)
  for (const b of bones) {
    b.position.copy(b.parent.worldToLocal(newP.get(b).clone()));
    b.updateMatrixWorld(true);
  }
  for (const mesh of meshes) {
    const sk = mesh.skeleton;
    sk.boneInverses = sk.bones.map((bone) => bone.matrixWorld.clone().invert().multiply(C.get(mesh)));
  }
  for (const m of meshes) m.material = new THREE.MeshBasicMaterial();   // replaced per oni

  // measurements the props are fitted to (model units, relative to the bones)
  const byName = (n) => bones.find((b) => b.name === n);
  const P = (n) => newP.get(byName(n));
  const verts = [], seen = new Set();
  for (const mesh of meshes) {
    const g = mesh.geometry, pos = g.attributes.position, toWorld = C.get(mesh).clone().multiply(mesh.bindMatrix);
    const skI = g.attributes.skinIndex, skW = g.attributes.skinWeight, sk = mesh.skeleton.bones;
    const ids = g.index ? g.index.array : Array.from({ length: pos.count }, (_, i) => i);
    for (const i of ids) {
      if (seen.has(i)) continue;
      seen.add(i);
      const v = _v.fromBufferAttribute(pos, i).applyMatrix4(toWorld).clone();
      let best = 0;
      for (let q = 1; q < 4; q++) if (skW.getComponent(i, q) > skW.getComponent(i, best)) best = q;
      v.bone = sk[skI.getComponent(i, best)].name;           // the bone that moves it most
      verts.push(v);
    }
  }
  const minY = Math.min(...verts.map((v) => v.y));          // the soles
  // radius of the limb around the segment a→b at fraction t
  const radius = (a, b, t) => {
    const A = P(a), B = P(b), d = B.clone().sub(A), len = d.length();
    d.divideScalar(len);
    let r = 0;
    const part = a.replace('J_Bip_', '');
    for (const v of verts) {
      if (!v.bone.includes(part)) continue;
      const rel = v.clone().sub(A), ax = rel.dot(d) / len;
      if (Math.abs(ax - t) > 0.06) continue;
      const rad = rel.addScaledVector(d, -rel.dot(d)).length();
      r = Math.max(r, rad);
    }
    return r;
  };
  // half-width and depth of the trunk at height y
  const slice = (y, dy = 0.02, legs = false) => {
    let rx = 0, z0 = Infinity, z1 = -Infinity;
    for (const v of verts) {
      if (Math.abs(v.y - y) >= dy || !(v.bone.includes('_C_') || (legs && v.bone.includes('UpperLeg')))) continue;
      rx = Math.max(rx, Math.abs(v.x)); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z);
    }
    return { rx, z0, z1 };
  };
  const hipsY = P('J_Bip_C_Hips').y;
  const k = (HEAD_Y - HEAD_ABOVE_BONE) / (P('J_Bip_C_Head').y - minY);    // model → oni units
  return {
    scene, k, minY,
    P: Object.fromEntries(bones.map((b) => [b.name, newP.get(b)])),
    pelt: [0.075, 0.04, 0.0, -0.04, -0.08, -0.12, -0.16, -0.2].map((dy) => ({ dy, ...slice(hipsY + dy, 0.025, true) })),
    forearm: radius('J_Bip_L_LowerArm', 'J_Bip_L_Hand', 0.82),
    shin: radius('J_Bip_L_LowerLeg', 'J_Bip_L_Foot', 0.82),
  };
}
