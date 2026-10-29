// yokai/ — the parade, one file per yokai. Each factory returns the same small interface:
//   { type, root, info, update(dt,t), center(out), labelAnchor(out), flash(), dispose() }
//
//   onibi     鬼火      will-o'-wisp with a shader flame
//   chochin   提灯お化け  glowing paper-lantern ghost
//   hitotsume 一つ目小僧  one-eyed little monk in a straw hat, hops
//   kappa     河童      river imp with a water dish, waddles
//   kitsunebi 狐火      floating fox mask trailing violet foxfire
//   kasa      唐傘お化け  one-legged umbrella ghost, hops
//   ittan     一反木綿   a flying bolt of cloth, rippling
//   hyakume   百目      a lump covered in eyes, rolls along
//   nekomata  猫又      two-tailed cat dancing on its hind legs
//   tengu     烏天狗     crow-beaked mountain goblin, beating its wings, leaf fan in hand
//   rokurokubi 轆轤首    lady in a kimono whose long neck sways and stretches
//   nopperabo のっぺらぼう faceless man with a lantern, wiping the face he doesn't have
//   kamaitachi 鎌鼬     sickle-pawed weasel riding a little whirlwind, spinning
//   oni       大鬼      boss — the full jointed oni, walking
import * as THREE from 'three';
import { shadowTex } from '../textures.js';
import { takeOni, releaseOni } from '../oni/index.js';
import { shared, once } from './shared.js';
import { buildOnibi } from './onibi.js';
import { buildChochin } from './chochin.js';
import { buildKasa } from './kasa.js';
import { buildHitotsume } from './hitotsume.js';
import { buildKappa } from './kappa.js';
import { buildKitsunebi } from './kitsunebi.js';
import { buildIttan } from './ittan.js';
import { buildHyakume } from './hyakume.js';
import { buildNekomata } from './nekomata.js';
import { buildTengu } from './tengu.js';
import { buildRokurokubi } from './rokurokubi.js';
import { buildNopperabo } from './nopperabo.js';
import { buildKamaitachi } from './kamaitachi.js';

const YOKAI_INFO = {
  onibi:   { baseY: 1.35, labelY: 1.05, centerY: 0, color: 0x6fd0ff, radius: 0.5 },
  chochin: { baseY: 1.5,  labelY: 0.9,  centerY: 0, color: 0xffa04a, radius: 0.55 },
  kasa:    { baseY: 1.2,  labelY: 0.85, centerY: 0, color: 0xff5f9a, radius: 0.6 },
  hitotsume: { baseY: 0.95, labelY: 0.95, centerY: 0, color: 0xffd27a, radius: 0.55 },
  kappa:     { baseY: 0.85, labelY: 0.95, centerY: 0, color: 0x7ae07a, radius: 0.55 },
  kitsunebi: { baseY: 1.45, labelY: 0.8,  centerY: 0, color: 0xa88aff, radius: 0.5 },
  ittan:     { baseY: 1.7,  labelY: 0.6,  centerY: 0, color: 0xe8f4ff, radius: 0.6 },
  hyakume:   { baseY: 0.8,  labelY: 0.95, centerY: 0, color: 0xff9a5a, radius: 0.6 },
  nekomata:  { baseY: 0.9,  labelY: 1.0,  centerY: 0, color: 0xffd9a0, radius: 0.55 },
  tengu:      { baseY: 1.35, labelY: 1.0,  centerY: 0, color: 0x8a9cff, radius: 0.65 },
  rokurokubi: { baseY: 0.95, labelY: 1.95, centerY: 0, color: 0xd28aff, radius: 0.55 },
  nopperabo:  { baseY: 0.95, labelY: 1.15, centerY: 0, color: 0xf3e2cc, radius: 0.55 },
  kamaitachi: { baseY: 1.2,  labelY: 0.85, centerY: 0, color: 0x9affc8, radius: 0.6 },
  oni:     { baseY: 0,    labelY: 3.7,  centerY: 2.1, color: 0xff4a3a, radius: 1.3 },
};
export const YOKAI_TYPES = Object.keys(YOKAI_INFO);
const ONI_SCALE = 0.92;

const BUILD = {
  onibi: buildOnibi,
  chochin: buildChochin,
  kasa: buildKasa,
  hitotsume: buildHitotsume,
  kappa: buildKappa,
  kitsunebi: buildKitsunebi,
  ittan: buildIttan,
  hyakume: buildHyakume,
  nekomata: buildNekomata,
  tengu: buildTengu,
  rokurokubi: buildRokurokubi,
  nopperabo: buildNopperabo,
  kamaitachi: buildKamaitachi,
};

export function createYokai(type) {
  const info = YOKAI_INFO[type];
  const root = new THREE.Group();
  const seed = Math.random() * 10;

  const shadow = new THREE.Mesh(
    once('shadowPlane', () => new THREE.PlaneGeometry(1, 1)),
    new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.05;
  shadow.scale.setScalar(info.radius * (type === 'oni' ? 3 : 2.4));
  root.add(shadow);

  if (type === 'oni') {
    const oni = takeOni();
    oni.root.scale.setScalar(ONI_SCALE);
    oni.setMode('walk');
    oni.roar();
    root.add(oni.root);
    return {
      type, root, info, oni,
      update(dt, t) { oni.update(dt, t, 1); },
      center(out) { return out.set(root.position.x, info.centerY, root.position.z); },
      labelAnchor(out) { return out.set(root.position.x, info.labelY, root.position.z); },
      flash() { oni.flash(); },
      dispose() {
        releaseOni(oni);
        shadow.material.dispose();
      },
    };
  }

  const body = new THREE.Group();
  root.add(body);
  const animate = BUILD[type](body, seed);
  let flashT = 0;
  const self = {
    type, root, info, hop: 0,
    update(dt, t) {
      self.hop = 0;
      animate(t, seed, self);
      body.position.y = info.baseY + Math.sin(t * 2.4 + seed) * 0.15 + self.hop;
      flashT = Math.max(0, flashT - dt * 5);
      body.scale.setScalar(1 + flashT * 0.25);
      shadow.material.opacity = 0.9 - Math.min(0.6, self.hop);
    },
    center(out) { return out.set(root.position.x, body.position.y, root.position.z); },
    labelAnchor(out) { return out.set(root.position.x, body.position.y + info.labelY, root.position.z); },
    flash() { flashT = 1; },
    dispose() {
      // shared materials/geometries and the cached outline shader stay alive;
      // baked meshes may carry an array of materials
      const keep = new Set(Object.values(shared));
      root.traverse((o) => {
        for (const m of [].concat(o.material || [])) {
          if (keep.has(m)) continue;
          if (m.isShaderMaterial && !m.uniforms?.seed) continue;
          m.dispose();
        }
        if (o.geometry && !keep.has(o.geometry) && !o.isSprite) o.geometry.dispose();
      });
    },
  };
  return self;
}
