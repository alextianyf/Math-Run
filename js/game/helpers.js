// helpers.js — small helpers shared by the game modules.

export const $ = (id) => document.getElementById(id);
export const rand = (a, b) => a + Math.random() * (b - a);

// easing curves: k goes 0 → 1, the result eases in or out
export const easeOut = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
export const easeOutBack = (k) => {
  k = Math.min(1, k);
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
};
export const smooth01 = (k) => {
  const c = Math.min(1, Math.max(0, k));
  return c * c * (3 - 2 * c);
};
