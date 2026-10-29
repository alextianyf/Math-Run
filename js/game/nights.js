// nights.js — every NIGHT_EVERY metres the run moves on to another night (full moon,
// mist, the parade, the fox's blessing). Each changes the scene (scene/themes.js) and
// one rule while it lasts; the scene changes while the path is quiet.
import * as THREE from 'three';
import { sfx } from '../ui/audio.js';
import { banner } from '../ui/popups.js';
import { S } from '../core/state.js';
import { world } from './stage.js';
import { emit } from '../core/events.js';
import { later } from '../core/schedule.js';
import { t } from '../core/i18n.js';

export const NIGHT_EVERY = 500;
const CYCLE = ['night', 'moon', 'fog', 'parade', 'fox'];
export const NIGHTS = {
  night: {},                                   // the usual festival night
  moon: { score: 2, pace: 1.25 },              // full moon: double points, faster yokai
  fog: { fog: true, depth: 0.7, time: 0.85 }, // mist: yokai come out of the fog nearer, with a little less time
  parade: { spawn: 0.6, alive: 1 },            // the parade: more yokai at once
  fox: { charge: 2 },                          // the fox's blessing: skills charge twice as fast
};
// a change of night: no new yokai until every one on the path is gone (banished, or
// it reached the hero), then the scene blends over SHIFT_S with the night's name on
// screen, and a breath of CALM_S before yokai return
const SHIFT_S = 3.5;
const CALM_S = 1.8;

// the rules of the current night apply while it is on (and while the path clears for the next)
export function nightRules() {
  const state = S.night.state;
  if (state === 'on' || state === 'clearing') return NIGHTS[S.night.id];
  return NIGHTS.night;
}
export const spawnMult = () => nightRules().spawn ?? 1;
export const aliveBonus = () => nightRules().alive ?? 0;
export const holdSpawns = () => !S.tut && S.night.state !== 'on';
// how far down the path yokai appear (1 = the usual spawn point) and how much of the
// usual time they take to arrive from there
export const spawnDepth = () => nightRules().depth ?? 1;
export const travelMult = () => nightRules().time ?? 1;

// in the mist an equation shows only once its yokai has come out of the fog
// (near: 0 at the usual spawn point → 1 at the hero)
export function tagVisibility(near) {
  if (!nightRules().fog) return 1;
  return THREE.MathUtils.smoothstep(near, 0.34, 0.46);
}

// how much of this night is left (1 → 0), for its chip under the combo
export const nightLeft = () => (S.nextNightAt - S.distance) / NIGHT_EVERY;

function bossOnPath() {
  return S.pendingBoss || S.enemies.some((o) => o.boss && !o.dying);
}

function announce(id) {
  const html = `<span class="ev-kicker">${t('nightEnter')}</span>`
    + `<span class="ev-title">${t(`ev_${id}`)}</span>`
    + `<span class="ev-sub">${t(`evd_${id}`)}</span>`;
  banner('', 'event', 1, { html, ms: 3400 });
  sfx.event();
}

function moveTo(state) {
  S.night.state = state;
  S.night.t = 0;
}

export function stepNight(dt) {
  const n = S.night;
  n.t += dt;
  if (n.state === 'on') {
    if (S.distance >= S.nextNightAt && !bossOnPath()) moveTo('clearing');  // no new yokai from here
  } else if (n.state === 'clearing') {
    if (S.enemies.some((o) => !o.dying)) return;
    const id = CYCLE[(CYCLE.indexOf(n.id) + 1) % CYCLE.length];
    n.id = id;
    moveTo('shifting');
    world.setTheme(id, SHIFT_S);
    document.body.dataset.night = id;
    later(0.6, () => announce(id));
    emit('night', { id });
  } else if (n.state === 'shifting' && n.t >= SHIFT_S) {
    moveTo('calm');
  } else if (n.state === 'calm' && n.t >= CALM_S) {
    moveTo('on');
    S.nextNightAt = S.distance + NIGHT_EVERY;
    S.spawnTimer = Math.min(S.spawnTimer, 0.6);
    emit('nightBegins', { id: n.id });
  }
}

export function resetNight() {
  S.night = { id: 'night', state: 'on', t: 0 };
  S.nextNightAt = NIGHT_EVERY;
  delete document.body.dataset.night;
  world.setTheme('night', 1.2);
}
