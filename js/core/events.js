// events.js — a tiny notice board. Game modules announce what just happened
// ("banish", "promote", …) and anyone interested — the achievements — listens,
// so the rules never need to know about the achievements at all.
const listeners = new Map();

export function on(name, listener) {
  if (!listeners.has(name)) listeners.set(name, []);
  listeners.get(name).push(listener);
}

export function emit(name, data = {}) {
  for (const listener of listeners.get(name) ?? []) listener(data);
}
