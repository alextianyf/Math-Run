// shared.js — the scrolling band's numbers and the helpers every part uses.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const FOG_COLOR = 0x2a2056;
export const NEAR = 30;                 // props wrap once they pass this z (behind the camera)
export const GAP = 12;                  // torii spacing
export const SPAN = GAP * 13;           // length of the recycled band
export const PATH_W = 5.6;

// Merge already-placed geometries into one (normalising index/uv so anything merges)
export function merge(geos) {
  return mergeGeometries(geos.map((g) => {
    const out = g.index ? g.toNonIndexed() : g;
    if (!out.attributes.uv) out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2));
    return out;
  }));
}

export function instanced(geo, mat, count) {
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.frustumCulled = false;
  return m;
}

// Instanced props sharing one transform list that scroll and wrap
export class Scroller {
  constructor(meshes, items) {
    this.meshes = meshes;
    this.items = items;
    this.hideZ = Infinity;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler();
    this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
    this.apply();
  }
  step(dz) {
    for (const it of this.items) {
      it.z += dz;
      if (it.z > NEAR) it.z -= SPAN;
    }
    this.apply();
  }
  apply() {
    this.items.forEach((it, i) => {
      this._e.set(0, it.ry || 0, 0);
      this._q.setFromEuler(this._e);
      this._p.set(it.x, it.y || 0, it.z);
      this._s.setScalar(it.z > this.hideZ ? 0 : it.s || 1);
      this._m.compose(this._p, this._q, this._s);
      for (const mesh of this.meshes) mesh.setMatrixAt(i, this._m);
    });
    for (const mesh of this.meshes) mesh.instanceMatrix.needsUpdate = true;
  }
}

export function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (repeat) t.repeat.set(...repeat);
  return t;
}
