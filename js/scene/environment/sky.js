// sky.js — the night sky: stars, moon, clouds, layered mountains and the pagoda on the ridge.
import * as THREE from 'three';
import { glow } from '../toon.js';
import { glowTex, moonTex, cloudTex } from '../textures.js';
import { FOG_COLOR } from './shared.js';
import { rand } from '../../core/math.js';

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

export function buildSky(scene) {
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
