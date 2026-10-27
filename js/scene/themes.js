// themes.js — the nights a run passes through. A change of night only blends colours
// and a few numbers on things that already exist (sky, fog, lights, moon, mist,
// fireflies, exposure, bloom): nothing is created and no shader recompiles, so the
// change never stalls a frame.
import * as THREE from 'three';

// colours are hex; *K is a brightness multiplier (HDR, so it blooms)
export const THEMES = {
  // the usual festival night
  night: {
    skyTop: 0x03020c, skyMid: 0x140f38, horizon: 0x2a2056, fogNear: 24, fogFar: 95,
    moon: 0xffffff, moonK: 1.6, moonScale: 50, moonX: -70, moonY: 85, halo: 0x8f86ff, haloOpacity: 0.5, clouds: 0x9a90d8,
    mist: 0x9d93e6, mistK: 1, banks: 0, foxfire: 0, fireflies: 0xd9ff8f, firefliesK: 1.6,
    hemi: 0x8783f2, hemiI: 1.3, moonLight: 0xc8ceff, moonLightI: 1.8, exposure: 1.25, bloom: 0.9,
    stone: 0xffffff, grass: 0xffffff, groundGlow: 0x000000,
  },
  // full moon: a huge golden moon low over the path, a clear deep-blue sky and the
  // whole shrine washed in cold silver light
  moon: {
    skyTop: 0x020a26, skyMid: 0x0d2558, horizon: 0x24407e, fogNear: 34, fogFar: 130,
    moon: 0xffdc8a, moonK: 1.05, moonScale: 120, moonX: -18, moonY: 46, halo: 0xffc860, haloOpacity: 0.32, clouds: 0x5a6aa0,
    mist: 0x9ab8ff, mistK: 0.7, banks: 0, foxfire: 0, fireflies: 0xfff2a0, firefliesK: 1.8,
    hemi: 0x8fb0ff, hemiI: 1.55, moonLight: 0xdfe9ff, moonLightI: 2.8, exposure: 1.26, bloom: 0.8,
    stone: 0xdce6ff, grass: 0xb8c8ee, groundGlow: 0x0c1426,
  },
  // night mist: a grey-lilac murk close around the path, the moon only a smudge
  fog: {
    skyTop: 0x34304c, skyMid: 0x56527a, horizon: 0x67638a, fogNear: 10, fogFar: 46,
    moon: 0xd8d8e8, moonK: 0.45, moonScale: 44, moonX: -70, moonY: 85, halo: 0xb0aac8, haloOpacity: 0.15, clouds: 0x8a86a0,
    mist: 0xd0cce8, mistK: 2, banks: 1, foxfire: 0, fireflies: 0xd9ff8f, firefliesK: 1.1,
    hemi: 0xa8a4c8, hemiI: 1.45, moonLight: 0xd0d0e8, moonLightI: 1.3, exposure: 1.3, bloom: 0.8,
    stone: 0xd8d4e2, grass: 0xc8c6d6, groundGlow: 0x1c1a26,
  },
  // the parade passes: a blood moon over a crimson sky
  parade: {
    skyTop: 0x0c0206, skyMid: 0x3a0a1c, horizon: 0x5a1830, fogNear: 22, fogFar: 90,
    moon: 0xff4a2a, moonK: 2, moonScale: 70, moonX: -70, moonY: 85, halo: 0xff3a2a, haloOpacity: 0.7, clouds: 0xc0506a,
    mist: 0xe0607a, mistK: 1.1, banks: 0, foxfire: 0, fireflies: 0xff9a4a, firefliesK: 2,
    hemi: 0xf08aa0, hemiI: 1.25, moonLight: 0xffa0a0, moonLightI: 1.8, exposure: 1.25, bloom: 1.05,
    stone: 0xffa49a, grass: 0xff7a6a, groundGlow: 0x240406,
  },
  // the fox's blessing: a deep teal night lit by foxfire along the path
  fox: {
    skyTop: 0x010d14, skyMid: 0x06303c, horizon: 0x0f4a54, fogNear: 24, fogFar: 95,
    moon: 0xd0fff4, moonK: 1.4, moonScale: 56, moonX: -70, moonY: 85, halo: 0x40e0d0, haloOpacity: 0.55, clouds: 0x3a8a90,
    mist: 0x3ac8c8, mistK: 1.2, banks: 0, foxfire: 1, fireflies: 0x7af0ff, firefliesK: 2.2,
    hemi: 0x5ab4cc, hemiI: 1.25, moonLight: 0xb8fff0, moonLightI: 1.7, exposure: 1.22, bloom: 1.0,
    stone: 0x9eeeff, grass: 0x7affe6, groundGlow: 0x021c1e,
  },
};

const COLORS = ['skyTop', 'skyMid', 'horizon', 'moon', 'halo', 'clouds', 'mist', 'fireflies', 'hemi', 'moonLight', 'stone', 'grass', 'groundGlow'];
const NUMBERS = ['fogNear', 'fogFar', 'moonK', 'moonScale', 'moonX', 'moonY', 'haloOpacity', 'mistK', 'banks', 'foxfire', 'firefliesK', 'hemiI', 'moonLightI', 'exposure', 'bloom'];

// a theme as live values (Colors and numbers), so two can be blended
function values(theme) {
  const v = {};
  for (const k of COLORS) v[k] = new THREE.Color(theme[k]);
  for (const k of NUMBERS) v[k] = theme[k];
  return v;
}

// targets: { scene, look (environment.js), hemi, moonLight, renderer, bloom }
export function createThemer(t) {
  const mistBase = t.look.mist.map((m) => m.opacity);
  const curbBase = t.look.ground.curb.color.clone();
  let from = values(THEMES.night), to = from, k = 1, dur = 1;
  const cur = values(THEMES.night);
  const tmp = new THREE.Color();

  function apply() {
    t.look.sky.top.value.copy(cur.skyTop);
    t.look.sky.mid.value.copy(cur.skyMid);
    t.look.sky.horizon.value.copy(cur.horizon);
    t.scene.background.copy(cur.horizon);
    t.scene.fog.color.copy(cur.horizon);
    t.scene.fog.near = cur.fogNear;
    t.scene.fog.far = cur.fogFar;
    t.look.moon.material.color.copy(tmp.copy(cur.moon).multiplyScalar(cur.moonK));
    t.look.moon.scale.setScalar(cur.moonScale);
    t.look.moon.position.x = t.look.halo.position.x = cur.moonX;
    t.look.moon.position.y = t.look.halo.position.y = cur.moonY;
    t.look.halo.material.color.copy(cur.halo);
    t.look.halo.material.opacity = cur.haloOpacity;
    t.look.halo.scale.setScalar(cur.moonScale * 4.8);
    for (const c of t.look.clouds) c.material.color.copy(cur.clouds);
    t.look.mist.forEach((m, i) => { m.color.copy(cur.mist); m.opacity = mistBase[i] * cur.mistK; });
    t.look.banks.amount = cur.banks;
    t.look.foxfire.amount = cur.foxfire;
    const g = t.look.ground;
    g.stone.color.copy(cur.stone); g.gravel.color.copy(cur.stone); g.grass.color.copy(cur.grass);
    g.curb.color.copy(curbBase).multiply(cur.stone);
    for (const m of [g.stone, g.gravel, g.grass]) m.emissive.copy(cur.groundGlow);
    t.look.banks.color.copy(cur.mist);
    t.look.fireflies.color.copy(tmp.copy(cur.fireflies).multiplyScalar(cur.firefliesK));
    t.hemi.color.copy(cur.hemi);
    t.hemi.intensity = cur.hemiI;
    t.moonLight.color.copy(cur.moonLight);
    t.moonLight.intensity = cur.moonLightI;
    t.renderer.toneMappingExposure = cur.exposure;
    t.bloom.strength = cur.bloom;
  }

  return {
    // blend to the named night over `seconds` (0: at once)
    set(name, seconds = 3) {
      from = {};
      for (const key of COLORS) from[key] = cur[key].clone();
      for (const key of NUMBERS) from[key] = cur[key];
      to = values(THEMES[name]);
      dur = Math.max(0.001, seconds);
      k = seconds > 0 ? 0 : 1;
      if (k === 1) { Object.assign(cur, values(THEMES[name])); apply(); }
    },
    get blending() { return k < 1; },
    update(dt) {
      if (k >= 1) return;                     // nothing to do between changes
      k = Math.min(1, k + dt / dur);
      const e = k * k * (3 - 2 * k);
      for (const key of COLORS) cur[key].lerpColors(from[key], to[key], e);
      for (const key of NUMBERS) cur[key] = from[key] + (to[key] - from[key]) * e;
      apply();
    },
  };
}
