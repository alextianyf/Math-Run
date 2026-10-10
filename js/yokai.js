// yokai.js — low-poly yokai built from primitives. Geometries and most materials
// are shared per type; each call returns a fresh scene graph plus an animation hook.
//
//   onibi   鬼火     will-o'-wisp            (common)
//   chochin 提灯お化け paper-lantern ghost      (common)
//   kasa    唐傘お化け one-legged umbrella ghost (from wave 3)
//   oni     大鬼      boss — needs several answers
import * as THREE from 'three';
import { glowTex, flameTex, shadowTex } from './textures.js';

const G = {};
const M = {};
const geo = (key, make) => G[key] || (G[key] = make());
const mat = (key, make) => M[key] || (M[key] = make());

const ink = () => mat('ink', () => new THREE.MeshBasicMaterial({ color: 0x0b0a14 }));
const eyeWhite = () => mat('eyeWhite', () => new THREE.MeshBasicMaterial({ color: 0xfdf8ec }));
const tongueMat = () => mat('tongue', () => new THREE.MeshStandardMaterial({ color: 0xe0405a, roughness: 0.5, emissive: 0x400010 }));

function glowSprite(color, scale, opacity) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  s.scale.setScalar(scale);
  return s;
}

function mesh(g, m, parent, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

export const YOKAI_INFO = {
  onibi:   { baseY: 1.35, labelY: 0.85, color: 0x6fd0ff, radius: 0.5 },
  chochin: { baseY: 1.45, labelY: 1.05, color: 0xffa04a, radius: 0.55 },
  kasa:    { baseY: 1.15, labelY: 1.15, color: 0xff5f9a, radius: 0.6 },
  oni:     { baseY: 2.05, labelY: 1.75, color: 0xff4a3a, radius: 1.1 },
};

function buildOnibi(body) {
  mesh(geo('orb', () => new THREE.SphereGeometry(0.24, 20, 14)),
    mat('orb', () => new THREE.MeshBasicMaterial({ color: 0xd8f6ff })), body);
  for (const sx of [-1, 1]) mesh(geo('dot', () => new THREE.SphereGeometry(0.045, 10, 8)), ink(), body, sx * 0.085, 0.03, 0.215);
  const glow = glowSprite(0x47b8ff, 1.9, 0.85);
  body.add(glow);
  const flames = [0, 1, 2].map((i) => {
    const f = new THREE.Sprite(new THREE.SpriteMaterial({
      map: flameTex(), color: 0x7fdcff, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    f.position.set((i - 1) * 0.13, 0.3, -0.05);
    body.add(f);
    return f;
  });
  return (t, seed) => {
    flames.forEach((f, i) => {
      const k = 0.85 + 0.2 * Math.sin(t * 13 + i * 2.1 + seed);
      f.scale.set(0.5 * k, (i === 1 ? 1.05 : 0.8) * k * (1 + 0.15 * Math.sin(t * 9 + i)), 1);
    });
    glow.material.opacity = 0.7 + 0.2 * Math.sin(t * 6 + seed);
    body.rotation.z = Math.sin(t * 2.3 + seed) * 0.08;
  };
}

function buildChochin(body) {
  const profile = [[0.2, -0.48], [0.34, -0.38], [0.42, -0.16], [0.44, 0.04], [0.41, 0.24], [0.31, 0.41], [0.2, 0.48]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  mesh(geo('lantern', () => new THREE.LatheGeometry(profile, 18)),
    mat('paper', () => new THREE.MeshStandardMaterial({
      color: 0xf2a65a, emissive: 0xff7b22, emissiveIntensity: 0.9, roughness: 0.9, side: THREE.DoubleSide,
    })), body);
  const rib = mat('rib', () => new THREE.MeshBasicMaterial({ color: 0x6a2c10 }));
  for (const [y, r] of [[-0.28, 0.4], [-0.05, 0.44], [0.2, 0.42]]) {
    const ring = mesh(new THREE.TorusGeometry(r, 0.012, 4, 28), rib, body, 0, y, 0);
    ring.rotation.x = Math.PI / 2;
  }
  const cap = geo('cap', () => new THREE.CylinderGeometry(0.21, 0.21, 0.07, 14));
  const dark = mat('dark', () => new THREE.MeshStandardMaterial({ color: 0x1a1218, roughness: 0.7 }));
  mesh(cap, dark, body, 0, 0.5, 0);
  mesh(cap, dark, body, 0, -0.5, 0);
  const handle = mesh(geo('handle', () => new THREE.TorusGeometry(0.08, 0.015, 6, 16)), dark, body, 0, 0.62, 0);
  handle.rotation.y = Math.PI / 2;
  const eye = mesh(geo('eyeL', () => new THREE.SphereGeometry(0.13, 16, 12)), eyeWhite(), body, 0.1, 0.12, 0.37);
  eye.scale.z = 0.6;
  mesh(geo('pupil', () => new THREE.SphereGeometry(0.055, 10, 8)), ink(), body, 0.12, 0.11, 0.45);
  mesh(geo('mouth', () => new THREE.BoxGeometry(0.34, 0.05, 0.06)), ink(), body, 0, -0.13, 0.42);
  const tongue = mesh(geo('tongue', () => new THREE.CapsuleGeometry(0.055, 0.24, 4, 8)), tongueMat(), body, 0.06, -0.32, 0.45);
  tongue.rotation.x = 0.35;
  body.add(glowSprite(0xff8a3a, 2.3, 0.7));
  return (t, seed) => {
    body.rotation.z = Math.sin(t * 1.8 + seed) * 0.18;
    tongue.rotation.z = Math.sin(t * 5 + seed) * 0.3;
  };
}

function buildKasa(body) {
  mesh(geo('canopy', () => new THREE.ConeGeometry(0.82, 0.8, 12, 1, true)),
    mat('canopy', () => new THREE.MeshStandardMaterial({
      color: 0xa8326a, roughness: 0.75, side: THREE.DoubleSide, flatShading: true, emissive: 0x2e0618,
    })), body, 0, 0.15, 0);
  const dark = mat('dark', () => new THREE.MeshStandardMaterial({ color: 0x1a1218, roughness: 0.7 }));
  mesh(geo('tip', () => new THREE.CylinderGeometry(0.035, 0.035, 0.25, 6)), dark, body, 0, 0.62, 0);
  const eye = mesh(geo('eyeK', () => new THREE.SphereGeometry(0.16, 16, 12)), eyeWhite(), body, 0, 0.02, 0.46);
  eye.scale.z = 0.5;
  mesh(geo('pupilK', () => new THREE.SphereGeometry(0.07, 10, 8)), ink(), body, 0, 0.02, 0.53);
  const tongue = mesh(geo('tongueK', () => new THREE.CapsuleGeometry(0.06, 0.3, 4, 8)), tongueMat(), body, 0, -0.24, 0.5);
  tongue.rotation.x = 0.55;
  mesh(geo('leg', () => new THREE.CylinderGeometry(0.045, 0.05, 0.55, 8)),
    mat('legSkin', () => new THREE.MeshStandardMaterial({ color: 0xe9dcc8, roughness: 0.8 })), body, 0, -0.47, 0);
  const wood = mat('wood', () => new THREE.MeshStandardMaterial({ color: 0x6b4426, roughness: 0.9 }));
  mesh(geo('geta', () => new THREE.BoxGeometry(0.22, 0.06, 0.34)), wood, body, 0, -0.76, 0);
  for (const z of [-0.1, 0.1]) mesh(geo('teeth', () => new THREE.BoxGeometry(0.2, 0.07, 0.04)), wood, body, 0, -0.82, z);
  body.add(glowSprite(0xff4f8a, 1.7, 0.4));
  return (t, seed, self) => {
    const hop = Math.abs(Math.sin(t * 3.2 + seed));
    self.hop = hop * 0.55;
    body.scale.set(1 + (1 - hop) * 0.06, 1 - (1 - hop) * 0.08, 1);
    tongue.rotation.z = Math.sin(t * 6 + seed) * 0.25;
  };
}

function buildOni(body) {
  // Boss: per-instance skin material so it can flash when hit
  const skin = new THREE.MeshStandardMaterial({ color: 0xc8302b, roughness: 0.55, emissive: 0x3a0505 });
  const head = mesh(new THREE.SphereGeometry(0.85, 30, 22), skin, body);
  head.scale.set(1, 1.08, 0.88);
  const ivory = new THREE.MeshStandardMaterial({ color: 0xf3e6c4, roughness: 0.5 });
  for (const sx of [-1, 1]) {
    const horn = mesh(new THREE.ConeGeometry(0.15, 0.62, 10), ivory, body, sx * 0.42, 0.9, 0.05);
    horn.rotation.z = -sx * 0.38;
    const brow = mesh(new THREE.BoxGeometry(0.42, 0.1, 0.12), ink(), body, sx * 0.3, 0.34, 0.69);
    brow.rotation.z = sx * 0.4;
    const eye = mesh(new THREE.SphereGeometry(0.14, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffd84a }), body, sx * 0.3, 0.13, 0.69);
    eye.scale.z = 0.6;
    mesh(new THREE.SphereGeometry(0.06, 10, 8), ink(), body, sx * 0.3, 0.12, 0.77);
    const fang = mesh(new THREE.ConeGeometry(0.06, 0.2, 8), ivory, body, sx * 0.24, -0.39, 0.73);
    fang.rotation.x = Math.PI;
    mesh(new THREE.ConeGeometry(0.05, 0.16, 8), ivory, body, sx * 0.12, -0.42, 0.73);
  }
  mesh(new THREE.SphereGeometry(0.15, 12, 10), new THREE.MeshStandardMaterial({ color: 0xa3221f, roughness: 0.5 }), body, 0, -0.06, 0.78);
  mesh(new THREE.BoxGeometry(0.72, 0.18, 0.12), new THREE.MeshBasicMaterial({ color: 0x2a0808 }), body, 0, -0.4, 0.67);
  // wild hair tufts on the back of the head
  const hair = new THREE.MeshStandardMaterial({ color: 0x17101a, roughness: 0.9 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 6 - 0.5) * 2.2;
    const tuft = mesh(new THREE.ConeGeometry(0.16, 0.5, 6), hair, body, Math.sin(a) * 0.62, 0.62 - Math.abs(a) * 0.12, -0.35 + Math.cos(a) * 0.05);
    tuft.rotation.set(-0.6, 0, -a * 0.5);
  }
  const glow = glowSprite(0xff3b2f, 4.2, 0.45);
  body.add(glow);
  let flashT = 0;
  return Object.assign((t, seed, self, dt) => {
    body.rotation.y = Math.sin(t * 0.8 + seed) * 0.15;
    flashT = Math.max(0, flashT - dt * 4);
    skin.emissive.setRGB(0.23 + flashT * 0.9, 0.02 + flashT * 0.8, 0.02 + flashT * 0.6);
    glow.material.opacity = 0.4 + 0.15 * Math.sin(t * 3) + flashT * 0.4;
  }, { flash: () => { flashT = 1; } });
}

const BUILDERS = { onibi: buildOnibi, chochin: buildChochin, kasa: buildKasa, oni: buildOni };

export function createYokai(type) {
  const info = YOKAI_INFO[type];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  if (type === 'oni') body.scale.setScalar(1.05);
  const animate = BUILDERS[type](body);

  const shadow = new THREE.Mesh(
    geo('shadowPlane', () => new THREE.PlaneGeometry(1, 1)),
    new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.05;
  shadow.scale.setScalar(info.radius * 2.4);
  root.add(shadow);

  const seed = Math.random() * 10;
  const self = {
    type, root, body, info, hop: 0,
    flash: animate.flash || (() => {}),
    update(dt, t) {
      self.hop = 0;
      animate(t, seed, self, dt);
      body.position.y = info.baseY + Math.sin(t * 2.4 + seed) * 0.16 + self.hop;
      shadow.material.opacity = 0.9 - Math.min(0.6, self.hop);
    },
    // Where the equation tag should float (world space)
    labelAnchor(out) {
      return out.set(root.position.x, body.position.y + info.labelY * body.scale.y, root.position.z);
    },
    dispose() {
      // Sprites and shadows own their materials; the boss owns everything it built
      const shared = new Set([...Object.values(G), ...Object.values(M)]);
      root.traverse((o) => {
        if (o.geometry && !shared.has(o.geometry) && !o.isSprite) o.geometry.dispose();
        if (o.material && !shared.has(o.material)) o.material.dispose();
      });
    },
  };
  return self;
}
