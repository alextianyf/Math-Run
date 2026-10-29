// powers.js — what makes a run more than answering, run together each frame: the
// skills (skills.js), the nights (nights.js) and the yokai hints (hints.js). The trial
// oni's finisher is in finisher.js. None of it runs during the tutorial.
import { S } from '../core/state.js';
import { runLater, clearLater } from '../core/schedule.js';
import { stepNight, resetNight } from './nights.js';
import { stepSkills, resetSkills, renderEffects } from './skills.js';
import { resetHints } from './hints.js';
import { $ } from '../core/dom.js';

let hudT = 0;
export function updatePowers(dt) {
  runLater(dt);
  const box = $('skill-box');
  if (box.hidden !== !!S.tut) box.hidden = !!S.tut;
  if (S.tut) return;
  stepSkills(dt);
  stepNight(dt);
  // the HUD's draining bars don't need every frame
  hudT -= dt;
  if (hudT <= 0) {
    hudT = 0.12;
    renderEffects();
  }
}

// a clean slate for a new run (or the title screen)
export function resetPowers() {
  clearLater();
  resetHints();
  S.slowmo = 0;
  S.hitstop = 0;
  resetNight();
  resetSkills();
  renderEffects();
}
