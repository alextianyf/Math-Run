// yokaiInfo.js — what the screens need to know about each kind of yokai: its seal
// and colour (bestiary, the hint card) and the trick some of them have.

// [seal character, colour]
export const YOKAI_LOOK = {
  onibi: ['火', '#4aa8e0'], chochin: ['灯', '#e8892e'], hitotsume: ['目', '#d2a640'], kappa: ['河', '#4fa65a'],
  kitsunebi: ['狐', '#8a6aff'], kasa: ['伞', '#e0457f'], ittan: ['布', '#8fb4d8'], hyakume: ['百', '#e0804a'], nekomata: ['猫', '#d8a860'],
  tengu: ['天', '#5a6ad0'], rokurokubi: ['首', '#a058c8'], nopperabo: ['无', '#8a8a9a'], kamaitachi: ['镰', '#c88a3a'], oni: ['鬼', '#c9302c'],
};

// what some yokai do besides walking up the path (shown as a badge on their tag):
//   sway      ittan: the cloth weaves from side to side
//   blink     kitsunebi: halfway, it vanishes and reappears in another lane
//   faceless  nopperabo: its equation fades away — remember it — and comes back only up close
//   trio      kamaitachi: come three at once, one answer for all three
//   dash      tengu: dawdles, then swoops in on its wings
//   lives     nekomata: two lives, two problems
//   late      rokurokubi: worth more the nearer it gets (instead of the farther)
export const TRAITS = { ittan: 'sway', kitsunebi: 'blink', nopperabo: 'faceless', kamaitachi: 'trio', tengu: 'dash', nekomata: 'lives', rokurokubi: 'late' };
