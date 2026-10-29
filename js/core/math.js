// math.js — small number helpers shared by the game modules.

// a random number between a and b
export function rand(a, b) {
  return a + Math.random() * (b - a);
}

export function clamp01(k) {
  return Math.min(1, Math.max(0, k));
}

// easing curves: k goes 0 → 1, the result eases in or out
export function easeOut(k) {
  return 1 - Math.pow(1 - clamp01(k), 3);
}

// overshoots a little past 1, then settles back (things popping into view)
export function easeOutBack(k) {
  const x = Math.min(1, k) - 1;
  const c = 1.7;
  return 1 + (c + 1) * x * x * x + c * x * x;
}

export function smooth01(k) {
  const c = clamp01(k);
  return c * c * (3 - 2 * c);
}
