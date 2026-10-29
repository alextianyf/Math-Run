// rules.js — the "How to play" screen: hearts and how to win them back, the ranks
// and their trials, scoring, skills and night events, and the fair-play rules. The numbers here are the
// game's own (progress.js, combat.js, enemies.js); keep them in step.
import * as ui from '../ui/ui.js';
import { RANKS } from '../difficulty/adaptive.js';
import { MAX_HEARTS } from '../core/state.js';
import { SKILLS, NIGHTS } from './powers.js';
import { $ } from '../core/dom.js';
import { t } from '../core/i18n.js';

// what each rank unlocks, by operation, as shown on the problems
const UNLOCKS = ['+ −', '× ÷', '( )', 'x² √', 'x³ ∛ 2ⁿ'];

function render() {
  const ranks = RANKS.map((r, i) => `<li><span class="stamp"><b>${ui.rankSeal(i)}</b></span>
    <div><b>${t(`rank${i}`)}</b><small>${UNLOCKS[i]}</small></div></li>`).join('');
  // the four skills, each with its seal in the colour it glows when ready
  const skills = Object.entries(SKILLS).map(([id, s]) => `<li style="--sk:#${s.color.toString(16).padStart(6, '0')}"><span class="rules-skill">${s.ch}</span>
    <div><b>${t(`sk_${id}`)}</b><small>${t(`skd_${id}`)}</small></div></li>`).join('');
  // the nights, in the order the run meets them, each with a little moon in its sky
  const nights = Object.keys(NIGHTS).map((id) => `<li><span class="rules-night n-${id}"></span>
    <div><b>${t(`ev_${id}`)}</b><small>${t(`evd_${id}`)}</small></div></li>`).join('');
  // the keys: send, skill, pause (on a touch screen the buttons do the same)
  const keys = [[t('rulesKeyCap1'), 1], ['F', 2], ['Esc', 3]].map(([cap, i]) => `<li><kbd class="rules-key">${cap}</kbd>
    <div><b>${t(`rulesKeyN${i}`)}</b><small>${t(`rulesKeys${i}`)}</small></div></li>`).join('');
  const section = (title, items) => `<section><h3>${t(title)}</h3><ul>${items.map((k) => `<li>${t(k, { h: MAX_HEARTS })}</li>`).join('')}</ul></section>`;
  $('rules-body').innerHTML = [
    section('rulesBasicsT', ['rulesBasics1', 'rulesBasics2', 'rulesBasics3']),
    `<section><h3>${t('rulesKeysT')}</h3><ol class="rules-ranks rules-keys">${keys}</ol></section>`,
    section('rulesHeartsT', ['rulesHearts1', 'rulesHearts2', 'rulesHearts3', 'rulesHearts4']),
    `<section><h3>${t('rulesRanksT')}</h3><p>${t('rulesRanks1')}</p><ol class="rules-ranks">${ranks}</ol><ul>
      <li>${t('rulesRanks2')}</li><li>${t('rulesRanks3')}</li><li>${t('rulesRanks4')}</li></ul></section>`,
    section('rulesScoreT', ['rulesScore1', 'rulesScore2', 'rulesScore3', 'rulesScore4']),
    `<section><h3>${t('rulesSkillsT')}</h3><p>${t('rulesSkills1')}</p><ol class="rules-ranks rules-skills">${skills}</ol><ul>
      <li>${t('rulesSkills2')}</li><li>${t('rulesSkills4')}</li></ul></section>`,
    `<section><h3>${t('rulesNightsT')}</h3><p>${t('rulesNights1')}</p><ol class="rules-ranks rules-nights">${nights}</ol></section>`,
    section('rulesFairT', ['rulesFair1', 'rulesFair2', 'rulesFair3']),
  ].join('');
}

export function openRules() {
  render();
  ui.show('ov-rules');
  $('rules-body').scrollTop = 0;
}

export function initRules() {
  for (const id of ['btn-rules', 'btn-pause-rules']) $(id).addEventListener('click', openRules);
  $('btn-rules-close').addEventListener('click', () => ui.show('ov-rules', false));
}
