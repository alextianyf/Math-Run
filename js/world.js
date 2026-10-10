// world.js — the 3D stage: a night shrine path that scrolls toward the camera,
// the 😎 runner, sky, lights and the camera rig. Everything is built from
// primitives + canvas textures, so no model files are needed.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glowTex, shadowTex, moonTex } from './textures.js';

export const LANES = [-1.9, 0, 1.9];

const FOG_COLOR = 0x2a2056;
const NEAR = 30;                  // decor wraps once it passes this z (behind the camera)
const TORII_GAP = 12;
const SPAN = TORII_GAP * 13;      // length of the recycled decor band
const PATH_W = 5.6;
const GROUND_TILE = 8;

const rand = (a, b) => a + Math.random() * (b - a);
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/* ===================== helpers ===================== */

// Rotate/translate a geometry in place and collect it for merging
function part(list, geo, x = 0, y = 0, z = 0, { rx = 0, ry = 0, rz = 0 } = {}) {
  if (rx) geo.rotateX(rx);
  if (ry) geo.rotateY(ry);
  if (rz) geo.rotateZ(rz);
  geo.translate(x, y, z);
  list.push(geo);
}

function instanced(geo, mat, count) {
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.frustumCulled = false; // instances live far from the geometry's own bounds
  return m;
}

// Instanced props that slide toward +z and wrap back to the far end
class Scroller {
  constructor(meshes, items) {
    this.meshes = meshes;
    this.items = items;
    this.hideZ = Infinity;   // instances past this z are collapsed (e.g. arches over the play camera)
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
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

function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  return t;
}

/* ===================== environment ===================== */

function buildSky(scene) {
  // Gradient dome (matches the fog colour at the horizon)
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(420, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x04030d) },
        mid: { value: new THREE.Color(0x15103a) },
        horizon: { value: new THREE.Color(FOG_COLOR) },
      },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 top; uniform vec3 mid; uniform vec3 horizon;
        varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 c = mix(mid, top, smoothstep(0.08, 0.7, h));
          c = mix(horizon, c, smoothstep(-0.02, 0.16, h));
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.renderOrder = -10;
  scene.add(sky);

  // Stars
  const n = 500, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = Math.random() * Math.PI * 2, y = rand(0.08, 1);
    const r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(th) * r * 400, y * 400, Math.sin(th) * r * 400], i * 3);
    const b = rand(0.35, 1);
    col.set([b, b, b * rand(0.85, 1)], i * 3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({
    size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false,
  })));

  // Moon + halo
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex(), fog: false, depthWrite: false }));
  moon.position.set(-70, 85, -320);
  moon.scale.setScalar(52);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex(), color: 0x8f86ff, fog: false, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  halo.position.copy(moon.position);
  halo.scale.setScalar(230);
  scene.add(halo, moon);

  // Layered mountain silhouettes (far = lighter, like haze)
  const layers = [
    { z: -330, color: 0x3a2f6e, base: 18, amp: 55, seed: 1 },
    { z: -270, color: 0x2a2257, base: 8, amp: 38, seed: 2 },
    { z: -215, color: 0x1d1842, base: 0, amp: 24, seed: 3 },
    { z: 260, color: 0x2a2257, base: 8, amp: 40, seed: 4 },
  ];
  for (const L of layers) {
    const shape = new THREE.Shape();
    const W = 1100;
    shape.moveTo(-W / 2, -40);
    for (let i = 0; i <= 80; i++) {
      const x = -W / 2 + (i / 80) * W;
      const y = L.base + L.amp * (0.5 + 0.35 * Math.sin(i * 0.37 + L.seed) + 0.25 * Math.sin(i * 1.13 + L.seed * 3)) + rand(-3, 3);
      shape.lineTo(x, y);
    }
    shape.lineTo(W / 2, -40);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({ color: L.color, fog: false, side: THREE.DoubleSide }));
    m.position.set(0, 0, L.z);
    scene.add(m);
  }
}

function buildGround(scene) {
  const stone = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#211d29'; g.fillRect(0, 0, w, h);            // mortar
    const rows = 4, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = r % 2 ? -60 : 0;
      while (x < w) {
        const sw = rand(90, 150);
        g.fillStyle = `hsl(${rand(245, 265)}, 9%, ${rand(30, 42)}%)`;
        g.fillRect(x + 3, r * rh + 3, sw - 6, rh - 6);
        for (let i = 0; i < 60; i++) {                            // speckle & moss
          g.fillStyle = Math.random() < 0.15 ? 'rgba(90,130,90,0.25)' : `rgba(0,0,0,${rand(0, 0.18)})`;
          g.fillRect(x + 3 + Math.random() * (sw - 6), r * rh + 3 + Math.random() * (rh - 6), 2, 2);
        }
        x += sw;
      }
    }
  }, [1, 320 / PATH_W]);

  const moss = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#17241f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `hsla(${rand(120, 170)}, 30%, ${rand(8, 22)}%, 0.6)`;
      g.fillRect(Math.random() * w, Math.random() * h, rand(1, 4), rand(2, 6));
    }
  }, [240 / GROUND_TILE, 320 / GROUND_TILE]);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 320),
    new THREE.MeshStandardMaterial({ map: moss, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -110;
  scene.add(ground);

  const path = new THREE.Mesh(new THREE.PlaneGeometry(PATH_W, 320),
    new THREE.MeshStandardMaterial({ map: stone, roughness: 0.85 }));
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.02, -110);
  scene.add(path);

  // Curbs along both edges
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x3a3546, roughness: 0.9 });
  for (const sx of [-1, 1]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 320), curbMat);
    curb.position.set(sx * (PATH_W / 2 + 0.08), 0.07, -110);
    scene.add(curb);
  }

  return {
    step(dz) {
      stone.offset.y += dz / PATH_W;
      moss.offset.y += dz / GROUND_TILE;
    },
  };
}

function buildTorii(scene) {
  const red = [], black = [];
  for (const sx of [-1, 1]) {
    part(red, new THREE.CylinderGeometry(0.17, 0.21, 4.3, 14), sx * 2.75, 2.15, 0);
    part(black, new THREE.CylinderGeometry(0.26, 0.28, 0.36, 14), sx * 2.75, 0.18, 0);
    part(black, new THREE.BoxGeometry(0.75, 0.3, 0.46), sx * 3.78, 4.47, 0, { rz: sx * 0.2 });
  }
  part(red, new THREE.BoxGeometry(6.7, 0.24, 0.24), 0, 3.5, 0);     // nuki
  part(red, new THREE.BoxGeometry(7.0, 0.22, 0.36), 0, 4.12, 0);    // shimaki
  part(red, new THREE.BoxGeometry(0.3, 0.5, 0.18), 0, 3.82, 0);     // gakuzuka
  part(black, new THREE.BoxGeometry(7.1, 0.3, 0.46), 0, 4.38, 0);   // kasagi

  const count = SPAN / TORII_GAP;
  const redMesh = instanced(mergeGeometries(red),
    new THREE.MeshStandardMaterial({ color: 0xd4372a, roughness: 0.55, emissive: 0x4a0a06 }), count);
  const blackMesh = instanced(mergeGeometries(black),
    new THREE.MeshStandardMaterial({ color: 0x17131c, roughness: 0.7 }), count);
  scene.add(redMesh, blackMesh);

  const items = Array.from({ length: count }, (_, i) => ({ x: 0, z: NEAR - 6 - i * TORII_GAP }));
  return new Scroller([redMesh, blackMesh], items);
}

function buildLanterns(scene) {
  const stone = [], light = [];
  part(stone, new THREE.BoxGeometry(0.56, 0.16, 0.56), 0, 0.08, 0);
  part(stone, new THREE.CylinderGeometry(0.09, 0.12, 0.8, 8), 0, 0.56, 0);
  part(stone, new THREE.BoxGeometry(0.6, 0.1, 0.6), 0, 1.01, 0);
  part(stone, new THREE.ConeGeometry(0.52, 0.34, 4), 0, 1.55, 0, { ry: Math.PI / 4 });
  part(stone, new THREE.SphereGeometry(0.08, 8, 6), 0, 1.76, 0);
  part(light, new THREE.BoxGeometry(0.36, 0.34, 0.36), 0, 1.23, 0);

  const count = (SPAN / TORII_GAP) * 2;
  const stoneMesh = instanced(mergeGeometries(stone),
    new THREE.MeshStandardMaterial({ color: 0x77708a, roughness: 0.95 }), count);
  const lightMesh = instanced(mergeGeometries(light),
    new THREE.MeshBasicMaterial({ color: 0xffc46b }), count);
  scene.add(stoneMesh, lightMesh);

  const items = [];
  for (let i = 0; i < count / 2; i++) {
    for (const sx of [-1, 1]) items.push({ x: sx * 3.8, z: NEAR - i * TORII_GAP });
  }
  const scroller = new Scroller([stoneMesh, lightMesh], items);

  // One additive glow sprite per lantern, as a single Points draw call
  const pos = new Float32Array(count * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const glow = new THREE.Points(g, new THREE.PointsMaterial({
    map: glowTex(), color: 0xff9a3c, size: 2.2, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  glow.frustumCulled = false;
  scene.add(glow);

  return {
    step(dz) {
      scroller.step(dz);
      items.forEach((it, i) => pos.set([it.x, 1.23, it.z], i * 3));
      g.attributes.position.needsUpdate = true;
    },
  };
}

function buildTrees(scene) {
  const trunk = [], leaves = [];
  part(trunk, new THREE.CylinderGeometry(0.12, 0.2, 1.8, 7), 0, 0.9, 0);
  part(leaves, new THREE.ConeGeometry(1.15, 1.9, 7), 0, 2.3, 0);
  part(leaves, new THREE.ConeGeometry(0.88, 1.6, 7), 0, 3.25, 0);
  part(leaves, new THREE.ConeGeometry(0.58, 1.3, 7), 0, 4.1, 0);

  const count = 84;
  const trunkMesh = instanced(mergeGeometries(trunk),
    new THREE.MeshStandardMaterial({ color: 0x3a2a26, roughness: 1 }), count);
  const leafMesh = instanced(mergeGeometries(leaves),
    new THREE.MeshStandardMaterial({ color: 0x1f3f3a, roughness: 0.9, flatShading: true }), count);
  scene.add(trunkMesh, leafMesh);

  const items = Array.from({ length: count }, (_, i) => ({
    x: (i % 2 ? 1 : -1) * rand(5.4, 19),
    z: NEAR - Math.random() * SPAN,
    s: rand(0.8, 1.9),
    ry: Math.random() * Math.PI,
  }));
  return new Scroller([trunkMesh, leafMesh], items);
}

// Floating point clouds (fireflies, spider lilies) that scroll + wrap
function buildParticles(scene, { count, area, size, color, additive, drift }) {
  const base = new Float32Array(count * 3), pos = new Float32Array(count * 3), phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    base.set(area(i), i * 3);
    phase[i] = Math.random() * Math.PI * 2;
  }
  pos.set(base);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({
    map: glowTex(), color, size, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  }));
  pts.frustumCulled = false;
  scene.add(pts);
  return {
    step(dz, t) {
      for (let i = 0; i < count; i++) {
        let z = base[i * 3 + 2] + dz;
        if (z > NEAR) z -= SPAN;
        base[i * 3 + 2] = z;
        const p = phase[i];
        pos[i * 3] = base[i * 3] + (drift ? Math.sin(t * 0.7 + p) * 0.4 : 0);
        pos[i * 3 + 1] = base[i * 3 + 1] + (drift ? Math.sin(t * 1.1 + p * 2) * 0.25 : 0);
        pos[i * 3 + 2] = z;
      }
      g.attributes.position.needsUpdate = true;
    },
  };
}

/* ===================== the runner (😎) ===================== */

function createRunner() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const M = {
    skin: new THREE.MeshStandardMaterial({ color: 0xffc935, roughness: 0.45, emissive: 0x2a1a00 }),
    robe: new THREE.MeshStandardMaterial({ color: 0xeee8da, roughness: 0.8 }),
    hakama: new THREE.MeshStandardMaterial({ color: 0x4f2c82, roughness: 0.8 }),
    shades: new THREE.MeshStandardMaterial({ color: 0x0b0b10, roughness: 0.15, metalness: 0.6 }),
    red: new THREE.MeshStandardMaterial({ color: 0xd8322a, roughness: 0.6, emissive: 0x2a0303 }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x5a300c, roughness: 0.6 }),
  };
  const add = (geo, mat, parent, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // Torso + sash
  const torso = add(new THREE.CapsuleGeometry(0.27, 0.38, 6, 12), M.robe, body, 0, 1.28, 0);
  torso.scale.set(1, 1, 0.8);
  const sash = add(new THREE.TorusGeometry(0.255, 0.05, 8, 24), M.red, body, 0, 1.06, 0);
  sash.rotation.x = Math.PI / 2;

  // Head: the 😎 face looks toward -z (the running direction)
  const head = new THREE.Group();
  head.position.set(0, 1.9, 0);
  body.add(head);
  add(new THREE.SphereGeometry(0.3, 28, 20), M.skin, head);
  for (const sx of [-1, 1]) {
    const lens = add(new THREE.BoxGeometry(0.2, 0.12, 0.06), M.shades, head, sx * 0.115, 0.05, -0.265);
    lens.rotation.y = -sx * 0.42;
  }
  add(new THREE.BoxGeometry(0.08, 0.03, 0.04), M.shades, head, 0, 0.08, -0.29);
  const strap = add(new THREE.TorusGeometry(0.297, 0.016, 6, 40), M.shades, head, 0, 0.06, 0);
  strap.rotation.x = Math.PI / 2;
  const smile = add(new THREE.TorusGeometry(0.1, 0.022, 6, 16, Math.PI), M.mouth, head, 0.03, -0.12, -0.27);
  smile.rotation.z = Math.PI + 0.25;

  // Limbs pivot at shoulders / hips
  const limb = (x, y) => { const g = new THREE.Group(); g.position.set(x, y, 0); body.add(g); return g; };
  const armL = limb(-0.37, 1.55), armR = limb(0.37, 1.55);
  for (const arm of [armL, armR]) {
    add(new THREE.CapsuleGeometry(0.085, 0.34, 4, 8), M.robe, arm, 0, -0.25, 0);
  }
  const handL = add(new THREE.SphereGeometry(0.085, 12, 10), M.skin, armL, 0, -0.52, 0);
  const handR = add(new THREE.SphereGeometry(0.085, 12, 10), M.skin, armR, 0, -0.52, 0);
  const legL = limb(-0.14, 0.98), legR = limb(0.14, 0.98);
  for (const leg of [legL, legR]) {
    add(new THREE.CylinderGeometry(0.1, 0.16, 0.62, 10), M.hakama, leg, 0, -0.31, 0);
    add(new THREE.BoxGeometry(0.13, 0.08, 0.26), M.shades, leg, 0, -0.64, -0.04);
  }

  // Scarf: a ribbon streaming behind (+z), vertices animated every frame
  const SCARF_ROWS = 12;
  const scarfPos = new Float32Array((SCARF_ROWS + 1) * 2 * 3);
  const scarfGeo = new THREE.BufferGeometry();
  scarfGeo.setAttribute('position', new THREE.BufferAttribute(scarfPos, 3));
  const scarfIdx = [];
  for (let i = 0; i < SCARF_ROWS; i++) {
    const a = i * 2;
    scarfIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  scarfGeo.setIndex(scarfIdx);
  const scarfMesh = new THREE.Mesh(scarfGeo, new THREE.MeshStandardMaterial({
    color: 0xd8322a, roughness: 0.7, emissive: 0x3a0505, side: THREE.DoubleSide,
  }));
  scarfMesh.frustumCulled = false;
  body.add(scarfMesh);
  add(new THREE.TorusGeometry(0.2, 0.06, 8, 20), M.red, body, 0, 1.64, 0).rotation.x = Math.PI / 2;

  // Contact shadow
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2),
    new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.04;
  root.add(shadow);

  let phase = 0, castT = 0, hurtT = 0, fallT = -1;

  return {
    root,
    handR,
    cast() { castT = 1; },
    hurt() { hurtT = 1; },
    fall() { if (fallT < 0) fallT = 0; },
    reset() { fallT = -1; hurtT = 0; castT = 0; body.rotation.set(0, 0, 0); body.position.set(0, 0, 0); },
    update(dt, speed, t) {
      const falling = fallT >= 0;
      if (!falling) phase += dt * (1.3 + speed * 0.085) * Math.PI * 2;
      const s = Math.sin(phase);
      const stride = Math.min(1, 0.35 + speed * 0.07);

      legL.rotation.x = s * 0.85 * stride;
      legR.rotation.x = -s * 0.85 * stride;
      armL.rotation.x = -s * 0.75 * stride;
      const swingR = s * 0.75 * stride;
      castT = Math.max(0, castT - dt * 3.2);
      const c = castT > 0 ? Math.sin(Math.min(1, castT * 1.4) * Math.PI / 2) : 0;
      armR.rotation.x = swingR + (1.9 - swingR) * c;
      armR.rotation.z = 0.25 * c;

      if (falling) {
        fallT = Math.min(1, fallT + dt * 1.8);
        const e = 1 - Math.pow(1 - fallT, 3);
        body.rotation.x = -0.14 - 1.3 * e;
        body.position.y = 0.12 * e;
      } else {
        body.position.y = Math.abs(Math.cos(phase)) * 0.09 * stride;
        body.rotation.x = -0.05 - 0.1 * stride;
      }

      hurtT = Math.max(0, hurtT - dt * 2.2);
      body.rotation.z = Math.sin(hurtT * 28) * 0.2 * hurtT;
      M.skin.emissive.setRGB(0.16 + hurtT * 0.8, 0.1 * (1 - hurtT), 0);

      head.rotation.y = Math.sin(t * 0.9) * 0.08;
      const flutter = 0.3 + Math.min(1, speed / 9);
      for (let i = 0; i <= SCARF_ROWS; i++) {
        const k = i / SCARF_ROWS;
        const x = Math.sin(t * 6.1 - i * 0.55) * 0.12 * k * flutter;
        const y = 1.62 - k * (0.55 - 0.3 * flutter) + Math.sin(t * 11 - i * 0.7) * 0.07 * k * flutter;
        const z = 0.18 + k * (0.35 + 0.75 * flutter);
        const half = 0.075 * (1 - k * 0.35);
        scarfPos.set([x - half, y, z, x + half, y, z], i * 6);
      }
      scarfGeo.attributes.position.needsUpdate = true;
      scarfGeo.computeVertexNormals();
    },
  };
}

/* ===================== world ===================== */

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.Fog(FOG_COLOR, 22, 92);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);

  scene.add(new THREE.HemisphereLight(0x8a86ff, 0x22142e, 1.5));
  const moonLight = new THREE.DirectionalLight(0xc4ccff, 1.6);
  moonLight.position.set(-30, 40, -60);
  scene.add(moonLight);
  const warm = new THREE.PointLight(0xffb36b, 16, 16, 2);
  warm.position.set(0.8, 2.8, 2.4);
  scene.add(warm);

  buildSky(scene);
  const torii = buildTorii(scene);
  const steppers = [buildGround(scene), torii, buildLanterns(scene), buildTrees(scene)];
  const fireflies = buildParticles(scene, {
    count: 150, size: 0.32, color: 0xd9ff8f, additive: true, drift: true,
    area: (i) => [(i % 2 ? 1 : -1) * rand(1, 14), rand(0.4, 4.6), NEAR - Math.random() * SPAN],
  });
  const lilies = buildParticles(scene, {
    count: 320, size: 0.3, color: 0xff2a3a, additive: false, drift: false,
    area: (i) => [(i % 2 ? 1 : -1) * (Math.random() < 0.7 ? rand(3.05, 3.55) : rand(4.2, 7)), rand(0.12, 0.3), NEAR - Math.random() * SPAN],
  });

  const runner = createRunner();
  scene.add(runner.root);

  /* ---------- camera rig ---------- */
  let presets = null;
  const rig = {
    mode: 'title', k: 1, dur: 1.4,
    fromPos: new THREE.Vector3(), fromLook: new THREE.Vector3(),
    pos: new THREE.Vector3(), look: new THREE.Vector3(),
    shake: 0,
  };
  function computePresets(aspect) {
    const portrait = aspect < 1;
    presets = {
      play: {
        pos: new THREE.Vector3(0, portrait ? 3.6 : 3.1, portrait ? 6.8 : 5.8),
        look: new THREE.Vector3(0, portrait ? 1.0 : 1.2, -10),
      },
      // camera faces +z here, so screen-left is world +x: look right of the runner
      // to push him to the right half, away from the title card
      title: {
        pos: new THREE.Vector3(portrait ? 0.35 : 1.5, portrait ? 1.5 : 1.75, portrait ? -5.2 : -4.3),
        look: new THREE.Vector3(portrait ? 0.05 : 1.45, portrait ? 0.45 : 1.4, 0),
      },
    };
  }
  function setCameraMode(mode, instant = false) {
    // behind the runner, an arch passing overhead would fill the top of the screen
    torii.hideZ = mode === 'play' ? 1.0 : Infinity;
    rig.fromPos.copy(rig.pos);
    rig.fromLook.copy(rig.look);
    rig.mode = mode;
    rig.k = instant ? 1 : 0;
    if (instant) { rig.pos.copy(presets[mode].pos); rig.look.copy(presets[mode].look); }
  }
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  function updateCamera(dt, t) {
    const target = presets[rig.mode];
    rig.k = Math.min(1, rig.k + dt / rig.dur);
    const e = easeInOut(rig.k);
    camPos.lerpVectors(rig.fromPos, target.pos, e);
    camLook.lerpVectors(rig.fromLook, target.look, e);
    if (rig.k < 1) camPos.y += Math.sin(Math.PI * e) * 1.1;   // swoop over the runner
    else { rig.pos.copy(target.pos); rig.look.copy(target.look); }
    if (rig.k < 1) { rig.pos.copy(camPos); rig.look.copy(camLook); }
    camPos.x += Math.sin(t * 0.6) * 0.06;
    camPos.y += Math.sin(t * 0.9) * 0.04;
    if (rig.shake > 0.001) {
      camPos.x += (Math.random() - 0.5) * rig.shake;
      camPos.y += (Math.random() - 0.5) * rig.shake;
      rig.shake *= Math.exp(-dt * 7);
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  /* ---------- public API ---------- */
  let width = 1, height = 1;
  const tmp = new THREE.Vector3();

  return {
    scene, camera, renderer, runner,
    get pxScale() { return height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)); },
    resize(w, h) {
      width = Math.max(1, w); height = Math.max(1, h);
      renderer.setSize(width, height, false);
      const aspect = width / height;
      camera.aspect = aspect;
      camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(0.44 / aspect)), 50, 72);
      camera.updateProjectionMatrix();
      const first = !presets;
      computePresets(aspect);
      if (first) setCameraMode('title', true);
    },
    setCameraMode,
    shake(amount) {
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) rig.shake = Math.max(rig.shake, amount);
    },
    update(dt, speed, t) {
      const dz = speed * dt;
      for (const s of steppers) s.step(dz);
      fireflies.step(dz, t);
      lilies.step(dz, t);
      runner.update(dt, speed, t);
      updateCamera(dt, t);
    },
    render() { renderer.render(scene, camera); },
    handPosition(out) { return runner.handR.getWorldPosition(out); },
    // World → CSS pixel coordinates inside the canvas
    project(v, out) {
      tmp.copy(v).project(camera);
      out.x = (tmp.x * 0.5 + 0.5) * width;
      out.y = (-tmp.y * 0.5 + 0.5) * height;
      out.visible = tmp.z < 1;
      return out;
    },
  };
}
