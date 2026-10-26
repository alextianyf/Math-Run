// environment.js — the night shrine: sky & mountains, a scrolling stone path,
// torii with shimenawa ropes, festival lantern strings, stone lanterns, cedars and
// night sakura, falling petals, fireflies and ground mist. Props are instanced and
// slide toward +z, wrapping back to the far end.
//
// Two places share the sky and the trees (see THEMES): the festival night of the
// endless run, and the daily challenge's graveyard under a blood moon — no path, no
// torii, no festival lanterns; the hero stands on a stone altar in a field of graves,
// sotoba boards and Jizō statues, candles on the graves, maples and dead trees around,
// hitodama drifting in the air, spider lilies, and a thick red mist. The yokai climb
// out of the graves.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, glow, place, lathe, taperedTube } from './toon.js';
import { glowTex, moonTex, petalTex, mistTex, cloudTex, plaqueTex, magicCircleTex } from './textures.js';

export const FOG_COLOR = 0x2a2056;

export const THEMES = {
  night: {
    fog: 0x2a2056, fogRange: [24, 95], sky: [0x03020c, 0x140f38],
    moon: { color: 0xffffff, bright: 1.6, size: 50, y: 85 }, halo: [0x8f86ff, 0.5, 240], clouds: 0x9a90d8,
    ridges: [0x3b3070, 0x2a2257, 0x1c173f, 0x2a2257],
    torii: true, graveyard: false, ground: [0xffffff],
    foliage: [0xf4a9c8, 0x4a1030],
    lanternStrings: true, lanterns: [0xff4a22, 0xffd9a0], hitodama: false, stoneFire: 0xffb45a,
    fireflies: 0xd9ff8f, lilies: [0xff2a3a, 1, 0.28], petals: 0xffd0e2, mist: [0x9d93e6, 1],
  },
  bloodMoon: {
    fog: 0x33122e, fogRange: [15, 62], sky: [0x07020a, 0x2c0a30],
    moon: { color: 0xff6a48, bright: 2.0, size: 110, y: 58 }, halo: [0xd8402a, 0.7, 360], clouds: 0x6a2846,
    ridges: [0x4e2046, 0x381632, 0x240a20, 0x381632],
    torii: false, graveyard: true, ground: [0x6a4a62],
    foliage: [0xd8482a, 0x3a0a04],
    lanternStrings: false, lanterns: [0x4ad0ff, 0xd0f4ff], hitodama: true, stoneFire: 0x7fd4ff,
    fireflies: 0x9fd8ff, lilies: [0xff2a3a, 1.7, 0.5], petals: 0xe85a3a, mist: [0xa05a8a, 1.6],
  },
};
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

// a shide (zigzag paper streamer) hanging from a sacred rope
function shideGeo() {
  const z = new THREE.Shape();
  z.moveTo(0, 0); z.lineTo(0.13, 0); z.lineTo(0.13, -0.11); z.lineTo(0.05, -0.11); z.lineTo(0.05, -0.22);
  z.lineTo(0.13, -0.22); z.lineTo(0.13, -0.38); z.lineTo(0.0, -0.38); z.lineTo(0.0, -0.27); z.lineTo(0.08, -0.27);
  z.lineTo(0.08, -0.16); z.lineTo(0, -0.16); z.closePath();
  return new THREE.ShapeGeometry(z);
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
  const skyMat = new THREE.ShaderMaterial({
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
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), skyMat);
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
  const ridges = [];
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
    ridges.push(m);
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
    step(dt) {
      for (const c of clouds) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > 160) c.position.x = -180;
      }
    },
    theme(th) {
      skyMat.uniforms.top.value.set(th.sky[0]);
      skyMat.uniforms.mid.value.set(th.sky[1]);
      skyMat.uniforms.horizon.value.set(th.fog);
      moon.material.color.copy(glow(th.moon.color, th.moon.bright));
      moon.scale.setScalar(th.moon.size);
      moon.position.y = halo.position.y = th.moon.y;
      halo.material.color.set(th.halo[0]);
      halo.material.opacity = th.halo[1];
      halo.scale.setScalar(th.halo[2]);
      for (const c of clouds) c.material.color.set(th.clouds);
      ridges.forEach((m, i) => m.material.color.set(th.ridges[i]));
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
    return m;
  };
  const mossMat = toon(0xffffff, { map: moss }), stoneMat = toon(0xffffff, { map: stone });
  flat(240, mossMat, 0, 0);
  const gravelMat = toon(0xffffff, { map: gravel });
  const path = [flat(PATH_W, stoneMat, 0, 0.02), flat(1.5, gravelMat, -(PATH_W / 2 + 0.75), 0.015), flat(1.5, gravelMat, PATH_W / 2 + 0.75, 0.015)];

  const curbMat = toon(0x4a4458);
  for (const sx of [-1, 1]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 320), curbMat);
    curb.position.set(sx * (PATH_W / 2 + 0.08), 0.07, -110);
    scene.add(curb);
    path.push(curb);
  }
  // the graveyard has no path: a round stone altar where the hero stands, a seal glowing
  // faintly on it, and a kekkai — stakes strung with sacred rope — guarding his sides
  const altar = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.85, 0.1, 28), toon(0x4a3f52));
  slab.position.y = 0.05;
  const seal = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 3.1), new THREE.MeshBasicMaterial({
    map: magicCircleTex(), color: glow(0xff9a40, 0.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  seal.rotation.x = -Math.PI / 2;
  seal.position.y = 0.115;
  const stakes = [], ropes = [], papers = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      stakes.push(place(new THREE.CylinderGeometry(0.05, 0.065, 1.15, 8), [sx * 2.05, 0.57, sz * 1.7]));
      stakes.push(place(new THREE.ConeGeometry(0.07, 0.1, 8), [sx * 2.05, 1.19, sz * 1.7]));
    }
    ropes.push(taperedTube([[sx * 2.05, 1.08, 1.7], [sx * 2.05, 0.92, 0], [sx * 2.05, 1.08, -1.7]], 0.035, { tip: 1, radial: 6, segments: 16 }));
    for (const z of [-0.85, 0, 0.85]) papers.push(place(shideGeo(), [sx * 2.05 - 0.06, 0.98 - Math.abs(z) * 0.05, z], [0, Math.PI / 2, 0]));
  }
  altar.add(slab, seal,
    new THREE.Mesh(merge(stakes), toon(0x2a1d1a)),
    new THREE.Mesh(merge(ropes), toon(0xc9a45a)),
    new THREE.Mesh(merge(papers), toon(0xf7f3ea, { side: THREE.DoubleSide })));
  altar.visible = false;
  scene.add(altar);

  return {
    step(dz, t) {
      stone.offset.y += dz / PATH_W;
      gravel.offset.y += dz / 1.5;
      moss.offset.y += dz / 8;
      if (altar.visible) seal.rotation.z = t * 0.12;
    },
    theme(th) {
      mossMat.color.set(th.ground[0]);
      for (const m of path) m.visible = !th.graveyard;
      altar.visible = th.graveyard;
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
    paper.push(place(shideGeo(), [x + 0.2, 3.0, 0.27]));
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
  const scroller = new Scroller(meshes, items);
  scroller.theme = (th) => { for (const m of meshes) m.visible = th.torii; };
  return scroller;
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

  const spanItems = [], lanternItems = [];
  for (let i = 0; i < spans; i++) {
    for (const sx of [-1, 1]) {
      const z0 = NEAR - i * GAP;
      spanItems.push({ x: sx * 3.45, z: z0 });
      for (let j = 1; j <= PER; j++) {
        const t = j / (PER + 1);
        lanternItems.push({ x: sx * 3.45, y: ropeY(t) - 0.34, z: z0 - GAP * t, odd: (i * 7 + j) % 5 === 0 });
      }
    }
  }
  // most lanterns one colour, every fifth or so the other
  const paint = ([main, odd]) => {
    const a = new THREE.Color(main), b = new THREE.Color(odd);
    lanternItems.forEach((it, i) => bodyMesh.setColorAt(i, it.odd ? b : a));
    bodyMesh.instanceColor.needsUpdate = true;
  };
  paint(THEMES.night.lanterns);
  const spanScroll = new Scroller([postMesh, ropeMesh], spanItems);
  const lanternScroll = new Scroller([bodyMesh, capMesh], lanternItems);
  return {
    step(dz, t) {
      spanScroll.step(dz);
      // a gentle swing: rotate each lantern a little around y (cheap, reads as motion)
      lanternItems.forEach((it, i) => { it.ry = Math.sin(t * 1.3 + i) * 0.4; });
      lanternScroll.step(dz);
    },
    theme(th) {
      paint(th.lanterns);
      for (const m of [postMesh, ropeMesh, bodyMesh, capMesh]) m.visible = th.lanternStrings;
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
  // two layouts: rows along the path, or scattered among the graves
  const items = Array.from({ length: count }, (_, i) => {
    const side = i % 2 ? 1 : -1;
    const path = { x: side * 4.4, z: NEAR - 3 - i * GAP, ry: Math.PI / 6 };
    const grave = { x: side * rand(4.6, 11), z: rand(-64, 2) - (i < 2 ? 4 : 0), ry: rand(0, Math.PI) };
    return { ...path, path, grave };
  });
  const scroller = new Scroller([stoneMesh, fireMesh], items);
  scroller.theme = (th) => {
    fireMesh.material.color.copy(glow(th.stoneFire, 2.2));
    for (const it of items) Object.assign(it, th.graveyard ? it.grave : it.path);
    scroller.apply();
  };
  return scroller;
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
  const foliageMat = toon(0xf4a9c8, { emissive: 0x4a1030 });
  const sakTopMesh = instanced(blossom, foliageMat, sakCount);
  scene.add(sakTrunkMesh, sakTopMesh);
  const sakura = new Scroller([sakTrunkMesh, sakTopMesh], Array.from({ length: sakCount }, (_, i) => ({
    x: (i % 2 ? 1 : -1) * rand(5.6, 8), z: NEAR - (i / sakCount) * SPAN - rand(0, 4), s: rand(0.9, 1.25), ry: Math.random() * Math.PI * 2,
  })));

  // dead trees (the graveyard's back rows): a twisted trunk and a few bare branches
  const twig = (pts, r) => taperedTube(pts, r, { tip: 0.25, segments: 8, radial: 6 });
  const dead = merge([
    twig([[0, 0, 0], [0.12, 1.6, 0.05], [-0.1, 3.1, 0.1], [0.08, 4.4, 0]], 0.26),
    twig([[0.05, 2.2, 0], [0.9, 3.0, 0.3], [1.5, 3.9, 0.2]], 0.1),
    twig([[1.1, 3.2, 0.25], [1.3, 3.9, 0.6]], 0.05),
    twig([[-0.05, 2.8, 0.05], [-0.8, 3.6, -0.3], [-1.3, 4.5, -0.1]], 0.1),
    twig([[-0.9, 3.7, -0.25], [-1.4, 3.9, -0.6]], 0.05),
    twig([[0.05, 3.9, 0], [0.4, 4.9, -0.3], [0.5, 5.6, 0.1]], 0.08),
    twig([[0.0, 4.2, 0], [-0.4, 5.0, 0.3]], 0.05),
  ]);
  const deadCount = 60;
  const deadMesh = instanced(dead, toon(0x17101c), deadCount);
  deadMesh.visible = false;
  scene.add(deadMesh);
  const deadTrees = new Scroller([deadMesh], Array.from({ length: deadCount }, (_, i) => ({
    x: (i % 2 ? 1 : -1) * rand(8.5, 22), z: NEAR - Math.random() * SPAN, s: rand(0.8, 1.6), ry: Math.random() * Math.PI * 2,
  })));
  return {
    step(dz) { cedars.step(dz); sakura.step(dz); if (deadMesh.visible) deadTrees.step(dz); },
    theme(th) {
      foliageMat.color.set(th.foliage[0]);
      foliageMat.emissive.set(th.foliage[1]);
      cedarTrunk.visible = cedarTop.visible = !th.graveyard;
      deadMesh.visible = th.graveyard;
    },
  };
}

/* ===================== graveyard ===================== */

// Gravestones in three tiers, clusters of sotoba boards behind them, and Jizō statues
// in red bibs around the altar. Only the daily challenge shows them. The yokai climb
// out of the graves nearest the altar (SPAWN), the oni out of the great tomb (TOMB).
function buildGraveyard(scene) {
  const stone = toon(0x6e6878);
  const grave = merge([
    place(new THREE.BoxGeometry(1.0, 0.22, 1.0), [0, 0.11, 0]),
    place(new THREE.BoxGeometry(0.72, 0.2, 0.72), [0, 0.32, 0]),
    place(new THREE.BoxGeometry(0.34, 1.3, 0.34), [0, 1.05, 0]),
    place(new THREE.BoxGeometry(0.38, 0.08, 0.38), [0, 1.72, 0]),
    place(new THREE.CylinderGeometry(0.18, 0.2, 0.3, 6), [0, 1.9, 0]),
  ]);
  const board = (x, tilt) => [
    place(new THREE.BoxGeometry(0.13, 1.7, 0.025), [x, 0.85, 0], [0, 0, tilt]),
    place(new THREE.ConeGeometry(0.095, 0.16, 4), [x - Math.sin(tilt) * 1.7, 1.78, 0], [0, Math.PI / 4, tilt]),
  ];
  const sotoba = merge([...board(-0.2, 0.05), ...board(0, -0.02), ...board(0.2, 0.08)]);
  const jizoStone = merge([
    place(new THREE.CylinderGeometry(0.34, 0.38, 0.14, 8), [0, 0.07, 0]),
    place(lathe([[0.2, 0.14], [0.26, 0.5], [0.18, 0.95], [0.1, 1.02]], 12), [0, 0, 0]),
    place(new THREE.SphereGeometry(0.2, 14, 10), [0, 1.14, 0]),
    place(new THREE.SphereGeometry(0.1, 10, 8), [0, 0.6, 0.2], [0, 0, 0], [1.4, 0.8, 0.8]),
  ]);
  const bib = place(new THREE.BoxGeometry(0.34, 0.3, 0.06), [0, 0.86, 0.22], [0.15, 0, 0]);
  const holder = place(new THREE.CylinderGeometry(0.05, 0.075, 0.2, 8), [0, 0.1, 0]);
  const flame = place(new THREE.SphereGeometry(0.06, 8, 6), [0, 0.3, 0], [0, 0, 0], [1, 1.7, 1]);

  const graveCount = 90, jizoCount = 6;
  const graveMesh = instanced(grave, stone, graveCount);
  const sotobaMesh = instanced(sotoba, toon(0xc9b48a), graveCount);
  const jizoMesh = instanced(jizoStone, toon(0x8a8398), jizoCount);
  const bibMesh = instanced(bib, toon(0xd8322a), jizoCount);
  const meshes = [graveMesh, sotobaMesh, jizoMesh, bibMesh];

  const SPAWN = [[-4.6, -14.5], [-1.9, -18.5], [2.4, -16.5], [5.4, -14], [-3.6, -22.5], [4.4, -21.5], [0.8, -26]];
  const TOMB = [0, -24.5];
  const graves = SPAWN.map(([x, z]) => ({ x, z, z0: z, s: 1.15, ry: rand(-0.15, 0.15) }));
  graves.push({ x: TOMB[0], z: TOMB[1], z0: TOMB[1], s: 2.3, ry: 0 });
  // the rest scatter over the field, clear of the altar and of the yokai's way to it
  while (graves.length < graveCount) {
    const x = rand(-13, 13), z = rand(-120, 4);
    if (Math.abs(x) < 3 && z > -13) continue;
    if (graves.some((g) => Math.hypot(g.x - x, g.z0 - z) < 1.6 * g.s + 0.6)) continue;
    graves.push({ x, z, z0: z, s: rand(0.7, 1.3), ry: rand(-0.35, 0.35) });
  }
  const boards = graves.map((g) => ({ x: g.x + (g.x > 0 ? 0.1 : -0.1), z: g.z - 0.75 * g.s, z0: g.z0 - 0.75 * g.s, s: g.s, ry: g.ry }));
  const jizos = [[-3.4, -5.5], [3.4, -5.5], [-4.6, -10.5], [4.6, -10.5], [-3.2, -1], [3.2, -1]].map(([x, z]) => ({
    x, z, z0: z, s: 1, ry: Math.atan2(-x, -6 - z),           // turned toward the altar
  }));
  // a candle burning in front of every third grave or so
  const candles = graves.filter((g, i) => i % 7 < 3 && g.s < 2).map((g) => ({ x: g.x, z: g.z0 + 0.72 * g.s, z0: g.z0 + 0.72 * g.s, s: 1 }));
  const holderMesh = instanced(holder, toon(0x2a1d1a), candles.length);
  const flameMesh = instanced(flame, new THREE.MeshBasicMaterial({ color: glow(0xffb860, 2.4) }), candles.length);
  meshes.push(holderMesh, flameMesh);
  for (const m of meshes) { m.visible = false; scene.add(m); }
  const flames = new Scroller([flameMesh], candles.map((c) => ({ ...c })));
  const scrollers = [new Scroller([graveMesh], graves), new Scroller([sotobaMesh], boards), new Scroller([jizoMesh, bibMesh], jizos), new Scroller([holderMesh], candles), flames];
  return {
    spawn: SPAWN, tomb: TOMB,
    step(dz, t) {
      if (!graveMesh.visible) return;
      flames.items.forEach((it, i) => { it.s = 0.8 + 0.35 * Math.abs(Math.sin(t * 7 + i * 1.7)); });
      for (const sc of scrollers) sc.step(dz);
    },
    theme(th) {
      for (const m of meshes) m.visible = th.graveyard;
      // the field is laid out around the altar: put everything back where it was built
      for (const sc of scrollers) { for (const it of sc.items) it.z = it.z0; sc.apply(); }
    },
  };
}

/* ===================== particles: fireflies, lilies, petals ===================== */

function buildParticles(scene, { count, area, size, color, additive, map = glowTex(), fall = 0, drift = 0 }) {
  const base = new Float32Array(count * 3), pos = new Float32Array(count * 3), phase = new Float32Array(count);
  const layout = (fn) => { for (let i = 0; i < count; i++) base.set(fn(i), i * 3); };
  layout(area);
  for (let i = 0; i < count; i++) phase[i] = Math.random() * Math.PI * 2;
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
    recolor(c, size = pts.material.size) { pts.material.color.copy(c); pts.material.size = size; },
    relayout: layout,
    show(on) { pts.visible = on; },
    step(dz, t, dt) {
      if (!pts.visible) return;
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
    return { t, k, m, opacity };
  });
  return {
    step(dz, t) {
      for (const L of layers) {
        L.t.offset.y += (dz * 7 * L.k) / 150;           // one texture tile = 150 / (7k) world units
        L.t.offset.x = Math.sin(t * 0.05 * L.k) * 0.3;
      }
    },
    theme(th) { for (const L of layers) { L.m.material.color.set(th.mist[0]); L.m.material.opacity = Math.min(1, L.opacity * th.mist[1]); } },
  };
}

/* ===================== assemble ===================== */

// spider lilies: along the path's edges, or over the whole graveyard (clear of the altar)
const LILY_EDGES = (i) => [(i % 2 ? 1 : -1) * (Math.random() < 0.7 ? rand(4.4, 5.0) : rand(5.2, 8)), rand(0.12, 0.3), NEAR - Math.random() * SPAN];
const LILY_FIELD = () => {
  let x, z;
  do { x = rand(-12, 12); z = rand(-70, 3); } while (Math.hypot(x, z) < 3.2);
  return [x, rand(0.12, 0.35), z];
};

export function createEnvironment(scene) {
  const sky = buildSky(scene);
  const torii = buildTorii(scene);
  const graveyard = buildGraveyard(scene);
  const parts = [buildGround(scene), torii, buildLanternStrings(scene), buildStoneLanterns(scene), buildTrees(scene), graveyard, buildMist(scene)];
  const [fireflies, lilies, petals, hitodama] = [
    buildParticles(scene, {
      count: 140, size: 0.3, color: glow(0xd9ff8f, 1.6), additive: true, drift: 0.4,
      area: (i) => [(i % 2 ? 1 : -1) * rand(1, 14), rand(0.4, 4.6), NEAR - Math.random() * SPAN],
    }),
    buildParticles(scene, { count: 300, size: 0.28, color: 0xff2a3a, additive: false, area: LILY_EDGES }),
    buildParticles(scene, {
      count: 260, size: 0.16, color: 0xffd0e2, additive: false, map: petalTex(), fall: 0.45, drift: 0.5,
      area: () => [rand(-9, 9), rand(0.2, 5), NEAR - Math.random() * SPAN],
    }),
    // hitodama: soul-flames drifting between the trees (the blood-moon night only)
    buildParticles(scene, {
      count: 90, size: 1.1, color: glow(0x8fd8ff, 1.7), additive: true, drift: 1.4,
      area: (i) => [(i % 2 ? 1 : -1) * rand(2.5, 13), rand(1.2, 6), NEAR - Math.random() * SPAN],
    }),
  ];
  hitodama.show(false);
  const particles = [fireflies, lilies, petals, hitodama];
  return {
    // arches overhead would fill the play camera's view right after passing the runner
    set hideToriiBeyond(z) { torii.hideZ = z; },
    step(dz, t, dt) {
      sky.step(dt);
      for (const p of parts) p.step(dz, t);
      for (const p of particles) p.step(dz, t, dt);
    },
    // the graveyard's graves the yokai come out of: { spawn: [[x, z]…], tomb: [x, z] }
    graves: { spawn: graveyard.spawn, tomb: graveyard.tomb },
    // switch between the looks in THEMES (the lights and fog are world.js's)
    setTheme(th) {
      sky.theme(th);
      for (const p of parts) p.theme?.(th);
      fireflies.recolor(glow(th.fireflies, 1.6));
      lilies.recolor(glow(th.lilies[0], th.lilies[1]), th.lilies[2]);
      lilies.relayout(th.graveyard ? LILY_FIELD : LILY_EDGES);
      petals.recolor(new THREE.Color(th.petals));
      hitodama.show(th.hitodama);
    },
  };
}
