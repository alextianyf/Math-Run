// fx.js — visual effects: pooled additive particles, shock rings, and the
// flying talismans (textured with the digit the player actually wrote).
import * as THREE from 'three';
import { glowTex, ringTex } from './textures.js';

const MAX_PARTICLES = 1000;

export function createFx(scene, camera) {
  /* ---------- particles (one draw call) ---------- */
  const pos = new Float32Array(MAX_PARTICLES * 3);
  const col = new Float32Array(MAX_PARTICLES * 3);
  const size = new Float32Array(MAX_PARTICLES);
  const alpha = new Float32Array(MAX_PARTICLES);
  const vel = new Float32Array(MAX_PARTICLES * 3);
  const life = new Float32Array(MAX_PARTICLES);
  const maxLife = new Float32Array(MAX_PARTICLES);
  const size0 = new Float32Array(MAX_PARTICLES);
  const grav = new Float32Array(MAX_PARTICLES);
  const drag = new Float32Array(MAX_PARTICLES);
  let cursor = 0;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('pcolor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('psize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('palpha', new THREE.BufferAttribute(alpha, 1));
  const uniforms = { uScale: { value: 400 } };
  const points = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec3 pcolor; attribute float psize; attribute float palpha;
      uniform float uScale;
      varying vec3 vColor; varying float vAlpha;
      void main() {
        vColor = pcolor; vAlpha = palpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = psize * uScale / max(0.1, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vColor; varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor, a);
      }`,
  }));
  points.frustumCulled = false;
  scene.add(points);

  const cA = new THREE.Color(), cB = new THREE.Color();

  function emit(p, {
    count = 20, color = 0xffd36b, color2 = color, speed = 4, life: l = 0.7, size: s = 0.25,
    gravity = -4, up = 0.6, spread = 1, dragK = 1.6, dir = null,
  } = {}) {
    cA.set(color); cB.set(color2);
    for (let n = 0; n < count; n++) {
      const i = cursor; cursor = (cursor + 1) % MAX_PARTICLES;
      pos[i * 3] = p.x + (Math.random() - 0.5) * 0.2 * spread;
      pos[i * 3 + 1] = p.y + (Math.random() - 0.5) * 0.2 * spread;
      pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 0.2 * spread;
      // random direction on a sphere, biased upward
      const th = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, r = Math.sqrt(1 - u * u);
      const v = speed * (0.35 + Math.random() * 0.65);
      vel[i * 3] = (dir ? dir.x : 0) + Math.cos(th) * r * v;
      vel[i * 3 + 1] = (dir ? dir.y : 0) + u * v + up * speed * 0.5;
      vel[i * 3 + 2] = (dir ? dir.z : 0) + Math.sin(th) * r * v;
      const k = Math.random();
      col[i * 3] = cA.r + (cB.r - cA.r) * k;
      col[i * 3 + 1] = cA.g + (cB.g - cA.g) * k;
      col[i * 3 + 2] = cA.b + (cB.b - cA.b) * k;
      maxLife[i] = life[i] = l * (0.6 + Math.random() * 0.6);
      size0[i] = s * (0.6 + Math.random() * 0.8);
      grav[i] = gravity;
      drag[i] = dragK;
    }
  }

  function updateParticles(dt) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (life[i] <= 0) { alpha[i] = 0; continue; }
      life[i] -= dt;
      const k = Math.max(0, life[i] / maxLife[i]);
      const dk = Math.max(0, 1 - drag[i] * dt);
      vel[i * 3] *= dk; vel[i * 3 + 1] = vel[i * 3 + 1] * dk + grav[i] * dt; vel[i * 3 + 2] *= dk;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      alpha[i] = k;
      size[i] = size0[i] * (0.4 + 0.6 * k);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.pcolor.needsUpdate = true;
    geo.attributes.psize.needsUpdate = true;
    geo.attributes.palpha.needsUpdate = true;
  }

  /* ---------- shock rings ---------- */
  const rings = [];
  function ring(p, { color = 0xffd36b, scale = 3, dur = 0.45 } = {}) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: ringTex(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    s.position.copy(p);
    s.scale.setScalar(0.2);
    scene.add(s);
    rings.push({ s, t: 0, dur, scale });
  }
  function updateRings(dt) {
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.t += dt / r.dur;
      const e = 1 - Math.pow(1 - Math.min(1, r.t), 3);
      r.s.scale.setScalar(0.2 + r.scale * e);
      r.s.material.opacity = 1 - Math.min(1, r.t);
      if (r.t >= 1) { scene.remove(r.s); r.s.material.dispose(); rings.splice(i, 1); }
    }
  }

  /* ---------- talismans ---------- */
  const talGeo = new THREE.PlaneGeometry(0.36, 0.54);
  const flights = [];
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), cur = new THREE.Vector3();

  // texture: CanvasTexture shared by all talismans of one cast (ref-counted)
  function talisman(texture, from, getTarget, { dur = 0.34, side = 0, onHit } = {}) {
    texture.userData.refs = (texture.userData.refs || 0) + 1;
    const mesh = new THREE.Mesh(talGeo, new THREE.MeshBasicMaterial({
      map: texture, side: THREE.DoubleSide, transparent: true, fog: false,
    }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex(), color: 0xffc84a, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    halo.scale.setScalar(1.3);
    mesh.add(halo);
    mesh.position.copy(from);
    scene.add(mesh);
    flights.push({ mesh, halo, texture, from: from.clone(), getTarget, t: 0, dur, side, onHit, spin: (Math.random() - 0.5) * 12 });
  }

  function updateFlights(dt) {
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      f.t = Math.min(1, f.t + dt / f.dur);
      const e = f.t * f.t * (3 - 2 * f.t) * 0.35 + f.t * 0.65;
      p0.copy(f.from);
      f.getTarget(p2);
      p1.lerpVectors(p0, p2, 0.5);
      p1.y += 1.4;
      p1.x += f.side;
      // quadratic bezier
      cur.copy(p0).multiplyScalar((1 - e) * (1 - e))
        .addScaledVector(p1, 2 * (1 - e) * e)
        .addScaledVector(p2, e * e);
      f.mesh.position.copy(cur);
      f.mesh.quaternion.copy(camera.quaternion);
      f.mesh.rotateZ(f.spin * f.t);
      emit(cur, { count: 2, color: 0xffe08a, color2: 0xff7a3a, speed: 0.8, life: 0.35, size: 0.18, gravity: 0, up: 0 });
      if (f.t >= 1) {
        scene.remove(f.mesh);
        f.mesh.material.dispose();
        f.halo.material.dispose();
        if (--f.texture.userData.refs <= 0) f.texture.dispose();
        flights.splice(i, 1);
        f.onHit?.(cur.clone());
      }
    }
  }

  return {
    emit, ring, talisman,
    setScale(px) { uniforms.uScale.value = px; },
    update(dt) {
      updateFlights(dt);
      updateRings(dt);
      updateParticles(dt);
    },
    clear() {
      life.fill(0);
      for (const f of flights.splice(0)) { scene.remove(f.mesh); }
      for (const r of rings.splice(0)) { scene.remove(r.s); }
    },
  };
}
