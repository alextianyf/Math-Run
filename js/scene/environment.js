// environment.js — the night shrine: sky & mountains, a scrolling stone path,
// torii with shimenawa ropes, festival lantern strings, stone lanterns, cedars and
// night sakura, falling petals, fireflies and ground mist. Props are instanced and
// slide toward +z, wrapping back to the far end.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, glow, place, lathe, taperedTube } from './toon.js';
import { glowTex, moonTex, petalTex, mistTex, cloudTex, plaqueTex, fogBankTex, foxfireTex } from './textures.js';

export const FOG_COLOR = 0x2a2056;
const NEAR = 30;                 // props wrap once they pass this z (behind the camera)
const GAP = 12;                  // torii spacing
const SPAN = GAP * 13;           // length of the recycled band
const PATH_W = 5.6;

const rand = (a, b) => a + Math.random() * (b - a);

/* ===================== helpers ===================== */

// Merge already-placed geometries into one (normalising index/uv so anything merges)
function merge(geos) {
  return mergeGeometries(geos.map((g) => {
    let out = g.index ? g.toNonIndexed() : g;
    if (!out.attributes.uv) out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2));
    return out;
  }));
}

function instanced(geo, mat, count) {
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.frustumCulled = false;
  return m;
}

// Instanced props sharing one transform list that scroll and wrap
class Scroller {
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

function canvasTexture(w, h, draw, repeat) {
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

/* ===================== sky ===================== */

function pagodaShape() {
  // five-storey pagoda silhouette, built up the left side then mirrored
  const left = [];
  let y = 0;
  for (let i = 0; i < 5; i++) {
    const body = 6.2 - i * 0.8, eave = body / 2 + 2.6 - i * 0.25;
    left.push([-body / 2, y], [-body / 2, y + 2.6], [-eave, y + 2.9], [-eave - 0.4, y + 3.5], [-body / 2 + 0.6, y + 4.1]);
    y += 4.1;
  }
  left.push([-0.25, y], [-0.25, y + 7]);
  const s = new THREE.Shape();
  s.moveTo(left[0][0], left[0][1]);
  for (const [x, yy] of left.slice(1)) s.lineTo(x, yy);
  for (const [x, yy] of [...left].reverse()) s.lineTo(-x, yy);
  return s;
}

function buildSky(scene) {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(420, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x03020c) },
        mid: { value: new THREE.Color(0x140f38) },
        horizon: { value: new THREE.Color(FOG_COLOR) },
      },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
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

  // stars
  const n = 600, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = Math.random() * Math.PI * 2, y = rand(0.1, 1), r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(th) * r * 400, y * 400, Math.sin(th) * r * 400], i * 3);
    const b = rand(0.3, 1);
    col.set([b, b, b * rand(0.85, 1)], i * 3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false })));

  // moon, halo, drifting clouds
  const moonPos = new THREE.Vector3(-70, 85, -320);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex(), color: glow(0xffffff, 1.6), fog: false, depthWrite: false }));
  moon.position.copy(moonPos);
  moon.scale.setScalar(50);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x8f86ff, fog: false, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.position.copy(moonPos);
  halo.scale.setScalar(240);
  scene.add(halo, moon);
  const clouds = [0, 1, 2, 3].map((i) => {
    const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex(), color: 0x9a90d8, fog: false, transparent: true, opacity: 0.55, depthWrite: false }));
    c.position.set(-140 + i * 70, 70 + i * 9, -300);
    c.scale.set(120, 45, 1);
    c.userData.speed = 1.2 + i * 0.4;
    scene.add(c);
    return c;
  });

  // layered mountains (far = lighter, like haze)
  const layers = [
    { z: -330, color: 0x3b3070, base: 18, amp: 55, seed: 1 },
    { z: -270, color: 0x2a2257, base: 8, amp: 38, seed: 2 },
    { z: -215, color: 0x1c173f, base: 0, amp: 22, seed: 3 },
    { z: 260, color: 0x2a2257, base: 8, amp: 40, seed: 4 },
  ];
  for (const L of layers) {
    const shape = new THREE.Shape();
    const W = 1100;
    shape.moveTo(-W / 2, -40);
    for (let i = 0; i <= 90; i++) {
      const x = -W / 2 + (i / 90) * W;
      shape.lineTo(x, L.base + L.amp * (0.5 + 0.35 * Math.sin(i * 0.37 + L.seed) + 0.25 * Math.sin(i * 1.13 + L.seed * 3)) + rand(-2, 2));
    }
    shape.lineTo(W / 2, -40);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: L.color, fog: false, side: THREE.DoubleSide }));
    m.position.z = L.z;
    scene.add(m);
  }

  // pagoda on the middle ridge, with lit windows and a lantern trail up the slope
  const pagoda = new THREE.Mesh(new THREE.ShapeGeometry(pagodaShape()), new THREE.MeshBasicMaterial({ color: 0x150f30, fog: false }));
  pagoda.position.set(62, 30, -262);
  pagoda.scale.setScalar(1.35);
  scene.add(pagoda);
  const lights = [];
  for (let i = 0; i < 5; i++) lights.push([62 + rand(-2, 2), 30 + 1.8 + i * 5.5, -261]);
  for (let i = 0; i < 26; i++) {
    const k = i / 25;
    lights.push([20 + k * 38 + Math.sin(k * 14) * 5, 6 + k * 24, -264]);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lights.flat()), 3));
  scene.add(new THREE.Points(lg, new THREE.PointsMaterial({
    map: glowTex(), color: glow(0xffa64a, 2), size: 7, sizeAttenuation: false, fog: false,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })));

  return {
    // what a change of night recolours (world.js themes)
    look: { sky: sky.material.uniforms, moon, halo, clouds },
    step(dt) {
      for (const c of clouds) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > 160) c.position.x = -180;
      }
    },
  };
}

/* ===================== ground ===================== */

function buildGround(scene) {
  const stone = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#1d1925'; g.fillRect(0, 0, w, h);
    const rows = 4, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = r % 2 ? -60 : 0;
      while (x < w) {
        const sw = rand(90, 150), l = rand(30, 42);
        g.fillStyle = `hsl(${rand(245, 262)}, 10%, ${l}%)`;
        g.fillRect(x + 3, r * rh + 3, sw - 6, rh - 6);
        g.fillStyle = `hsla(250, 20%, ${l + 12}%, 0.5)`;          // worn top edge
        g.fillRect(x + 3, r * rh + 3, sw - 6, 3);
        for (let i = 0; i < 60; i++) {
          g.fillStyle = Math.random() < 0.15 ? 'rgba(90,140,100,0.25)' : `rgba(0,0,0,${rand(0, 0.18)})`;
          g.fillRect(x + 3 + Math.random() * (sw - 6), r * rh + 3 + Math.random() * (rh - 6), 2, 2);
        }
        x += sw;
      }
    }
  }, [1, 320 / PATH_W]);

  const gravel = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#5d5872'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = `hsl(${rand(240, 265)}, 10%, ${rand(30, 62)}%)`;
      g.beginPath(); g.arc(Math.random() * w, Math.random() * h, rand(0.6, 1.8), 0, Math.PI * 2); g.fill();
    }
  }, [1, 320 / 1.5]);

  const moss = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#16231f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `hsla(${rand(120, 175)}, 30%, ${rand(8, 22)}%, 0.6)`;
      g.fillRect(Math.random() * w, Math.random() * h, rand(1, 4), rand(2, 6));
    }
  }, [240 / 8, 320 / 8]);

  const flat = (w, mat, x, y) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 320), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, -110);
    scene.add(m);
  };
  const mossMat = toon(0xffffff, { map: moss }), stoneMat = toon(0xffffff, { map: stone });
  flat(240, mossMat, 0, 0);
  flat(PATH_W, stoneMat, 0, 0.02);
  const gravelMat = toon(0xffffff, { map: gravel });
  flat(1.5, gravelMat, -(PATH_W / 2 + 0.75), 0.015);
  flat(1.5, gravelMat, PATH_W / 2 + 0.75, 0.015);

  const curbMat = toon(0x4a4458);
  for (const sx of [-1, 1]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 320), curbMat);
    curb.position.set(sx * (PATH_W / 2 + 0.08), 0.07, -110);
    scene.add(curb);
  }

  return {
    // what a change of night tints: the path, the gravel and curbs beside it, the ground
    look: { stone: stoneMat, gravel: gravelMat, curb: curbMat, grass: mossMat },
    step(dz) {
      stone.offset.y += dz / PATH_W;
      gravel.offset.y += dz / 1.5;
      moss.offset.y += dz / 8;
    },
  };
}

/* ===================== torii ===================== */

function buildTorii(scene) {
  const red = [], black = [], rope = [], paper = [];
  for (const sx of [-1, 1]) {
    red.push(place(new THREE.CylinderGeometry(0.17, 0.21, 4.3, 16), [sx * 2.75, 2.15, 0]));
    black.push(place(new THREE.CylinderGeometry(0.26, 0.28, 0.36, 16), [sx * 2.75, 0.18, 0]));
  }
  red.push(place(new THREE.BoxGeometry(6.7, 0.24, 0.24), [0, 3.5, 0]));      // nuki
  red.push(place(new THREE.BoxGeometry(7.0, 0.22, 0.36), [0, 4.1, 0]));      // shimaki
  red.push(place(new THREE.BoxGeometry(0.22, 0.5, 0.16), [0, 3.8, 0]));      // gakuzuka strut
  black.push(place(new THREE.BoxGeometry(0.5, 0.7, 0.1), [0, 3.82, 0.1]));    // plaque board
  // kasagi: the curved top beam with up-swept ends
  const k = new THREE.Shape();
  k.moveTo(-3.9, 0.36);
  k.quadraticCurveTo(0, -0.1, 3.9, 0.36);
  k.lineTo(3.95, 0.66);
  k.quadraticCurveTo(0, 0.22, -3.95, 0.66);
  k.closePath();
  const kasagi = new THREE.ExtrudeGeometry(k, { depth: 0.46, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1, curveSegments: 16 });
  black.push(place(kasagi, [0, 4.0, -0.23]));
  // shimenawa (sacred rope) with shide paper streamers
  rope.push(taperedTube([[-2.6, 3.28, 0.2], [-1.3, 3.0, 0.24], [0, 2.92, 0.25], [1.3, 3.0, 0.24], [2.6, 3.28, 0.2]], 0.075, { tip: 1, radial: 8, segments: 24 }));
  for (const x of [-1.6, -0.55, 0.55, 1.6]) {
    rope.push(place(new THREE.CylinderGeometry(0.035, 0.06, 0.32, 6), [x, 2.78, 0.25]));
    const z = new THREE.Shape();
    z.moveTo(0, 0); z.lineTo(0.13, 0); z.lineTo(0.13, -0.11); z.lineTo(0.05, -0.11); z.lineTo(0.05, -0.22);
    z.lineTo(0.13, -0.22); z.lineTo(0.13, -0.38); z.lineTo(0.0, -0.38); z.lineTo(0.0, -0.27); z.lineTo(0.08, -0.27);
    z.lineTo(0.08, -0.16); z.lineTo(0, -0.16); z.closePath();
    paper.push(place(new THREE.ShapeGeometry(z), [x + 0.2, 3.0, 0.27]));
  }

  const count = SPAN / GAP;
  const meshes = [
    instanced(merge(red), toon(0xd8382b, { emissive: 0x3a0806 }), count),
    instanced(merge(black), toon(0x1a1520), count),
    instanced(merge(rope), toon(0xc9a45a), count),
    instanced(merge(paper), toon(0xf7f3ea, { side: THREE.DoubleSide }), count),
    instanced(place(new THREE.PlaneGeometry(0.36, 0.54), [0, 3.82, 0.16]), new THREE.MeshBasicMaterial({ map: plaqueTex() }), count),
  ];
  scene.add(...meshes);
  const items = Array.from({ length: count }, (_, i) => ({ x: 0, z: NEAR - 6 - i * GAP }));
  return new Scroller(meshes, items);
}

/* ===================== festival lantern strings ===================== */

function buildLanternStrings(scene) {
  const SAG = 0.55, TOP = 3.9, PER = 4;
  const ropeY = (t) => TOP - SAG * 4 * t * (1 - t);

  const post = merge([
    place(new THREE.CylinderGeometry(0.06, 0.075, 4.05, 8), [0, 2.02, 0]),
    place(new THREE.BoxGeometry(0.2, 0.08, 0.2), [0, 4.06, 0]),
  ]);
  const ropePts = [];
  for (let i = 0; i <= 8; i++) ropePts.push([0, ropeY(i / 8), -GAP * (i / 8)]);
  const rope = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ropePts.map((p) => new THREE.Vector3(...p))), 24, 0.014, 5);

  // paper lantern with ribs, as a single unlit glowing body + dark caps
  const ribs = canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(80,20,10,0.35)';
    for (let y = 6; y < h; y += 10) g.fillRect(0, y, w, 2);
  });
  const body = lathe([[0.07, -0.17], [0.125, -0.12], [0.145, 0], [0.125, 0.12], [0.07, 0.17]], 14);
  const caps = merge([
    place(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 12), [0, 0.185, 0]),
    place(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 12), [0, -0.185, 0]),
    place(new THREE.CylinderGeometry(0.005, 0.005, 0.14, 4), [0, 0.27, 0]),
  ]);

  const spans = SPAN / GAP;
  const postMesh = instanced(post, toon(0x2a1d1a), spans * 2);
  const ropeMesh = instanced(rope, toon(0x2a1d1a), spans * 2);
  const bodyMesh = instanced(body, new THREE.MeshBasicMaterial({ map: ribs, color: glow(0xffffff, 1.6) }), spans * 2 * PER);
  const capMesh = instanced(caps, toon(0x17121a), spans * 2 * PER);
  scene.add(postMesh, ropeMesh, bodyMesh, capMesh);

  const red = new THREE.Color(0xff4a22), warm = new THREE.Color(0xffd9a0);
  const spanItems = [], lanternItems = [];
  for (let i = 0; i < spans; i++) {
    for (const sx of [-1, 1]) {
      const z0 = NEAR - i * GAP;
      spanItems.push({ x: sx * 3.45, z: z0 });
      for (let j = 1; j <= PER; j++) {
        const t = j / (PER + 1);
        lanternItems.push({ x: sx * 3.45, y: ropeY(t) - 0.34, z: z0 - GAP * t });
        bodyMesh.setColorAt(lanternItems.length - 1, (i * 7 + j) % 5 === 0 ? warm : red);
      }
    }
  }
  bodyMesh.instanceColor.needsUpdate = true;
  const spanScroll = new Scroller([postMesh, ropeMesh], spanItems);
  const lanternScroll = new Scroller([bodyMesh, capMesh], lanternItems);
  return {
    step(dz, t) {
      spanScroll.step(dz);
      // a gentle swing: rotate each lantern a little around y (cheap, reads as motion)
      lanternItems.forEach((it, i) => { it.ry = Math.sin(t * 1.3 + i) * 0.4; });
      lanternScroll.step(dz);
    },
  };
}

/* ===================== stone lanterns ===================== */

function buildStoneLanterns(scene) {
  const stone = merge([
    place(lathe([[0.36, 0], [0.34, 0.12], [0.2, 0.18], [0.12, 0.22]], 6), [0, 0, 0]),
    place(new THREE.CylinderGeometry(0.1, 0.12, 0.75, 8), [0, 0.58, 0]),
    place(new THREE.CylinderGeometry(0.34, 0.26, 0.12, 6), [0, 1.0, 0]),
    place(lathe([[0.5, 0], [0.42, 0.08], [0.18, 0.28], [0.06, 0.34], [0, 0.36]], 6), [0, 1.43, 0]),
    place(new THREE.SphereGeometry(0.08, 8, 6), [0, 1.84, 0]),
  ]);
  const fire = place(new THREE.CylinderGeometry(0.2, 0.2, 0.36, 6), [0, 1.24, 0]);
  const count = 13;
  const stoneMesh = instanced(stone, toon(0x8a8398), count);
  const fireMesh = instanced(fire, new THREE.MeshBasicMaterial({ color: glow(0xffb45a, 2.2) }), count);
  scene.add(stoneMesh, fireMesh);
  const items = Array.from({ length: count }, (_, i) => ({ x: (i % 2 ? 1 : -1) * 4.4, z: NEAR - 3 - i * GAP, ry: Math.PI / 6 }));
  return new Scroller([stoneMesh, fireMesh], items);
}

/* ===================== trees ===================== */

function buildTrees(scene) {
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
    [0, 2.9, 0, 1.05], [-0.9, 2.7, 0.2, 0.8], [0.9, 2.95, -0.2, 0.85], [0.2, 3.5, 0.1, 0.8], [-0.4, 3.3, -0.4, 0.7], [0.5, 2.6, 0.5, 0.7],
  ].map(([x, y, z, r]) => place(new THREE.IcosahedronGeometry(r, 1), [x, y, z])));
  const sakCount = 24;
  const sakTrunkMesh = instanced(sakTrunk, toon(0x3b2630), sakCount);
  const sakTopMesh = instanced(blossom, toon(0xf4a9c8, { emissive: 0x4a1030 }), sakCount);
  scene.add(sakTrunkMesh, sakTopMesh);
  const sakura = new Scroller([sakTrunkMesh, sakTopMesh], Array.from({ length: sakCount }, (_, i) => ({
    x: (i % 2 ? 1 : -1) * rand(5.6, 8), z: NEAR - (i / sakCount) * SPAN - rand(0, 4), s: rand(0.9, 1.25), ry: Math.random() * Math.PI * 2,
  })));
  return { step(dz) { cedars.step(dz); sakura.step(dz); } };
}

/* ===================== particles: fireflies, lilies, petals ===================== */

function buildParticles(scene, { count, area, size, color, additive, map = glowTex(), fall = 0, drift = 0 }) {
  const base = new Float32Array(count * 3), pos = new Float32Array(count * 3), phase = new Float32Array(count);
  for (let i = 0; i < count; i++) { base.set(area(i), i * 3); phase[i] = Math.random() * Math.PI * 2; }
  pos.set(base);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({
    map, color, size, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  }));
  pts.frustumCulled = false;
  scene.add(pts);
  return {
    material: pts.material,
    step(dz, t, dt) {
      for (let i = 0; i < count; i++) {
        let z = base[i * 3 + 2] + dz;
        if (z > NEAR) z -= SPAN;
        base[i * 3 + 2] = z;
        if (fall) {
          base[i * 3 + 1] -= fall * dt;
          if (base[i * 3 + 1] < 0.05) base[i * 3 + 1] = rand(3, 5);
        }
        const p = phase[i];
        pos[i * 3] = base[i * 3] + Math.sin(t * 0.7 + p) * drift;
        pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 1.1 + p * 2) * drift * 0.6;
        pos[i * 3 + 2] = z + Math.cos(t * 0.9 + p) * drift * 0.5;
      }
      g.attributes.position.needsUpdate = true;
    },
  };
}

function buildMist(scene) {
  const tex = mistTex();
  const layers = [[0.25, 0.42, 1], [0.8, 0.26, 1.6]].map(([y, opacity, k]) => {
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(3 * k, 7 * k);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(70, 150), new THREE.MeshBasicMaterial({
      map: t, color: 0x9d93e6, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, y, -55);
    scene.add(m);
    return { t, k, m };
  });
  return {
    materials: layers.map((L) => L.m.material),
    step(dz, t) {
      for (const L of layers) {
        L.t.offset.y += (dz * 7 * L.k) / 150;           // one texture tile = 150 / (7k) world units
        L.t.offset.x = Math.sin(t * 0.05 * L.k) * 0.3;
      }
    },
  };
}

// banks of fog rolling along and across the path, only on the misty night: big
// soft billboards that drift and slowly turn, fading out as they reach the camera
// so it never sits inside one. Hidden (not drawn at all) on every other night.
function buildFogBanks(scene) {
  const tex = [0, 1, 2].map((n) => fogBankTex(n));
  const group = new THREE.Group();
  group.visible = false;
  const banks = [];
  for (let i = 0; i < 28; i++) {
    const onPath = i % 3 === 0;                          // a third drift across the path itself
    const material = new THREE.SpriteMaterial({ map: tex[i % 3], transparent: true, depthWrite: false, opacity: 0 });
    const s = new THREE.Sprite(material);
    const w = onPath ? rand(7, 11) : rand(9, 16);
    s.scale.set(w, w * rand(0.55, 0.75), 1);
    group.add(s);
    banks.push({
      s, w, x: onPath ? rand(-3, 3) : (i % 2 ? 1 : -1) * rand(3.5, 13), y: onPath ? rand(0.3, 1.2) : rand(0.6, 2.6),
      z: NEAR - (i / 28) * SPAN + rand(-2, 2), p: Math.random() * Math.PI * 2, spin: rand(-0.04, 0.04),
    });
  }
  scene.add(group);
  let amount = 0;
  return {
    group,
    // 0..1 from the night's theme; the colour follows the mist
    set amount(v) { amount = v; group.visible = v > 0.01; },
    color: new THREE.Color(),
    step(dz, t) {
      if (!group.visible) { for (const b of banks) { b.z += dz; if (b.z > NEAR) b.z -= SPAN; } return; }
      for (const b of banks) {
        b.z += dz;
        if (b.z > NEAR) b.z -= SPAN;
        b.s.position.set(b.x + Math.sin(t * 0.07 + b.p) * 2.2, b.y + Math.sin(t * 0.13 + b.p * 2) * 0.25, b.z);
        b.s.material.rotation = b.p + t * b.spin;
        // fade in out of the distance, out again before it reaches the camera (z ≈ 6)
        const near = THREE.MathUtils.smoothstep(b.z, -1, 4), far = THREE.MathUtils.smoothstep(b.z, -95, -70);
        b.s.material.opacity = amount * far * (1 - near);
        b.s.material.color.copy(this.color);
      }
    },
  };
}

// foxfire (kitsunebi) on the fox's night: blue-green flames hovering along both
// sides of the path, bobbing, wandering and flickering, each with a soft glow round
// it. Hidden (not drawn at all) on every other night.
function buildFoxfire(scene) {
  const group = new THREE.Group();
  group.visible = false;
  const flameMap = foxfireTex(), glowMap = glowTex();
  const wisps = [];
  for (let i = 0; i < 28; i++) {
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameMap, color: glow(0x6ff6ff, 2.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color: 0x22c8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    const size = rand(0.8, 1.15);
    group.add(halo, flame);
    wisps.push({
      flame, halo, size, x: (i % 2 ? 1 : -1) * rand(3.2, 5.6), y: rand(1, 2.4),
      z: NEAR - (i / 28) * SPAN + rand(-3, 3), p: Math.random() * Math.PI * 2,
    });
  }
  scene.add(group);
  let amount = 0;
  const hide = (w, dz) => { w.z += dz; if (w.z > NEAR) w.z -= SPAN; };
  return {
    // 0..1 from the night's theme
    set amount(v) { amount = v; group.visible = v > 0.01; },
    step(dz, t) {
      if (!group.visible) { for (const w of wisps) hide(w, dz); return; }
      for (const w of wisps) {
        hide(w, dz);
        const flick = 1 + Math.sin(t * 11 + w.p) * 0.08 + Math.sin(t * 17 + w.p * 3) * 0.06;
        const x = w.x + Math.sin(t * 0.5 + w.p) * 0.6, y = w.y + Math.sin(t * 1.3 + w.p * 2) * 0.25;
        w.flame.position.set(x, y, w.z);
        w.halo.position.set(x, y - w.size * 0.2, w.z);
        w.flame.scale.set(w.size * flick, w.size * 2 * (2 - flick), 1);
        w.halo.scale.setScalar(w.size * 4.2);
        // fade in out of the distance, out again before it reaches the camera
        const k = amount * THREE.MathUtils.smoothstep(w.z, -110, -80) * (1 - THREE.MathUtils.smoothstep(w.z, 0, 5));
        w.flame.material.opacity = k * (0.85 + Math.sin(t * 7 + w.p) * 0.15);
        w.halo.material.opacity = k * 0.4;
      }
    },
  };
}

/* ===================== assemble ===================== */

export function createEnvironment(scene) {
  const sky = buildSky(scene);
  const torii = buildTorii(scene);
  const mist = buildMist(scene);
  const banks = buildFogBanks(scene), foxfire = buildFoxfire(scene), ground = buildGround(scene);
  const parts = [ground, torii, buildLanternStrings(scene), buildStoneLanterns(scene), buildTrees(scene), mist, banks, foxfire];
  const particles = [
    buildParticles(scene, {
      count: 140, size: 0.3, color: glow(0xd9ff8f, 1.6), additive: true, drift: 0.4,
      area: (i) => [(i % 2 ? 1 : -1) * rand(1, 14), rand(0.4, 4.6), NEAR - Math.random() * SPAN],
    }),
    buildParticles(scene, {
      count: 300, size: 0.28, color: 0xff2a3a, additive: false,
      area: (i) => [(i % 2 ? 1 : -1) * (Math.random() < 0.7 ? rand(4.4, 5.0) : rand(5.2, 8)), rand(0.12, 0.3), NEAR - Math.random() * SPAN],
    }),
    buildParticles(scene, {
      count: 260, size: 0.16, color: 0xffd0e2, additive: false, map: petalTex(), fall: 0.45, drift: 0.5,
      area: () => [rand(-9, 9), rand(0.2, 5), NEAR - Math.random() * SPAN],
    }),
  ];
  return {
    // what a change of night recolours: sky, moon, clouds, ground mist, fog banks, foxfire, fireflies and the ground underfoot
    look: { ...sky.look, mist: mist.materials, fireflies: particles[0].material, banks, foxfire, ground: ground.look },
    // arches overhead would fill the play camera's view right after passing the runner
    set hideToriiBeyond(z) { torii.hideZ = z; },
    step(dz, t, dt) {
      sky.step(dt);
      for (const p of parts) p.step(dz, t);
      for (const p of particles) p.step(dz, t, dt);
    },
  };
}
