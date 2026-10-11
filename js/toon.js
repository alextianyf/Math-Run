// toon.js — the shared cel-shaded look: 3-band toon materials, inverted-hull
// outlines, and small geometry helpers for building characters from primitives.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

let ramp = null;
export function toonRamp() {
  if (!ramp) {
    ramp = new THREE.DataTexture(new Uint8Array([110, 185, 255]), 3, 1, THREE.RedFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
    ramp.needsUpdate = true;
  }
  return ramp;
}

export function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonRamp(), ...opts });
}

// A colour brighter than 1.0 so it crosses the bloom threshold
export const glow = (hex, k = 2.5) => new THREE.Color(hex).multiplyScalar(k);

/* ---------- outlines (inverted hull, fog-aware) ---------- */
const outlineCache = new Map();
export function outlineMaterial(thickness = 0.018, color = 0x0c0818) {
  const key = `${thickness}:${color}`;
  if (outlineCache.has(key)) return outlineCache.get(key);
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      thickness: { value: thickness },
      color: { value: new THREE.Color(color) },
    }]),
    // skinning chunks are no-ops unless the object is a SkinnedMesh
    vertexShader: /* glsl */`
      #include <common>
      #include <skinning_pars_vertex>
      #include <fog_pars_vertex>
      uniform float thickness;
      void main() {
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        transformed += normalize(objectNormal) * thickness;
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 color;
      void main() {
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    side: THREE.BackSide,
    fog: true,
  });
  outlineCache.set(key, m);
  return m;
}

export function addOutline(mesh, thickness = 0.018) {
  const o = mesh.isSkinnedMesh
    ? new THREE.SkinnedMesh(mesh.geometry, outlineMaterial(thickness))
    : new THREE.Mesh(mesh.geometry, outlineMaterial(thickness));
  if (mesh.isSkinnedMesh) { o.bind(mesh.skeleton, mesh.bindMatrix); o.frustumCulled = false; }
  if (mesh.frustumCulled === false) o.frustumCulled = false;
  o.raycast = () => {};
  mesh.add(o);
  return o;
}

/* ---------- geometry helpers ---------- */
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3();

// Apply position / rotation / scale to a geometry in place
export function place(geo, p = [0, 0, 0], r = [0, 0, 0], s = 1) {
  _e.set(r[0], r[1], r[2]);
  _q.setFromEuler(_e);
  _p.set(p[0], p[1], p[2]);
  if (Array.isArray(s)) _s.set(s[0], s[1], s[2]); else _s.setScalar(s);
  geo.applyMatrix4(_m.compose(_p, _q, _s));
  return geo;
}

// Merge transformed primitives into ONE mesh (one material group per material).
// parts: [{ geo, mat, p, r, s }]
export function bake(parts, { outline = 0.018 } = {}) {
  const mats = [], byMat = new Map();
  for (const pt of parts) {
    let g = place(pt.geo, pt.p, pt.r, pt.s ?? 1);
    if (g.index) g = g.toNonIndexed();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!byMat.has(pt.mat)) { byMat.set(pt.mat, []); mats.push(pt.mat); }
    byMat.get(pt.mat).push(g);
  }
  const merged = mergeGeometries(mats.map((m) => mergeGeometries(byMat.get(m))), true);
  const mesh = new THREE.Mesh(merged, mats.length === 1 ? mats[0] : mats);
  if (outline) addOutline(mesh, outline);
  return mesh;
}

// Tube along a smooth curve that tapers toward the tip (horns, hair, tongues)
export function taperedTube(points, radius, { segments = 14, radial = 8, tip = 0.08, swell = 0 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, segments, radius, radial, false);
  const pos = g.attributes.position;
  const v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, c);
    const k = (1 - (1 - tip) * t) * (1 + swell * Math.sin(Math.PI * t));
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(k).add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

// Lathe from [radius, y] pairs. LatheGeometry needs the profile ordered bottom → top
// (otherwise normals point inward: dark shading and no outline), so normalise it.
export const lathe = (pts, segs = 20) => {
  const ordered = pts[0][1] > pts[pts.length - 1][1] ? [...pts].reverse() : pts;
  return new THREE.LatheGeometry(ordered.map(([r, y]) => new THREE.Vector2(r, y)), segs);
};

// Loft a surface through horizontal cross-sections, top → bottom.
//   rows: [{ y, rx, rz, cx, cz, e, ef }]  rx/rz half-widths, cx/cz centre offset,
//         e = superellipse exponent (2 = ellipse, higher = boxier), ef = exponent for the
//         front half (z sign = `front`) so a face can be flatter than the skull behind it
//   opts: segs, a0/a1 (open arc), seam (angle offset), uRep, front (±1),
//         uv(x,y,z) → [u,v] planar mapping, groups(a) → material index per column,
//         weights(x,y,z) → [[boneName,w]] + boneIndex for a skinned surface
const TAU = Math.PI * 2;
const sgnPow = (c, k) => Math.sign(c) * Math.pow(Math.abs(c), k);
export function loft(rows, { segs = 24, a0 = 0, a1 = TAU, seam = 0, uRep = 1, front = -1, uv = null, groups = null, weights = null, boneIndex = null } = {}) {
  const closed = a1 - a0 >= TAU - 1e-6;
  const cols = segs + 1;
  const pos = [], uvs = [], skI = [], skW = [], colMat = [];
  for (let i = 0; i < cols; i++) {
    const a = a0 + (a1 - a0) * (i / segs) + seam;
    colMat.push(groups ? groups(a) : 0);
  }
  rows.forEach((r, j) => {
    for (let i = 0; i < cols; i++) {
      const a = a0 + (a1 - a0) * (i / segs) + seam;
      const sa = Math.sin(a), ca = Math.cos(a);
      const isFront = ca * front > 0;
      const e = (isFront && r.ef) || r.e || 2;
      const k = 2 / e;
      const x = (r.cx || 0) + sgnPow(sa, k) * r.rx, z = (r.cz || 0) + sgnPow(ca, k) * r.rz;
      pos.push(x, r.y, z);
      if (uv) uvs.push(...uv(x, r.y, z)); else uvs.push((i / segs) * uRep, 1 - j / (rows.length - 1));
      if (weights) {
        const w = weights(x, r.y, z).sort((p, q) => q[1] - p[1]).slice(0, 4);
        const sum = w.reduce((s, [, v]) => s + v, 0) || 1;
        for (let q = 0; q < 4; q++) { skI.push(w[q] ? boneIndex.get(w[q][0]) : 0); skW.push(w[q] ? w[q][1] / sum : 0); }
      }
    }
  });
  const byMat = new Map();
  for (let j = 0; j < rows.length - 1; j++) {
    for (let i = 0; i < segs; i++) {
      const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
      const m = colMat[i];
      if (!byMat.has(m)) byMat.set(m, []);
      byMat.get(m).push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (weights) {
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skI, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skW, 4));
  }
  const idx = [];
  let start = 0;
  for (const m of [...byMat.keys()].sort()) {
    const list = byMat.get(m);
    idx.push(...list);
    g.addGroup(start, list.length, m);
    start += list.length;
  }
  g.setIndex(idx);
  g.computeVertexNormals();
  if (closed) {                                   // weld normals across the seam
    const n = g.attributes.normal, v = new THREE.Vector3(), u = new THREE.Vector3();
    for (let j = 0; j < rows.length; j++) {
      const a = j * cols, b = a + segs;
      v.fromBufferAttribute(n, a).add(u.fromBufferAttribute(n, b)).normalize();
      n.setXYZ(a, v.x, v.y, v.z); n.setXYZ(b, v.x, v.y, v.z);
    }
  }
  return g;
}

// Named pivot (joint) helper
export function joint(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}
