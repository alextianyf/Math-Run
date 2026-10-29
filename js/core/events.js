// events.js — a tiny notice board. Game modules announce what just happened
// ("banish", "promote", "sweep", …) and anyone interested listens: the achievements
// hear about banishes, combat.js banishes what a skill sweeps away. So the module
// that announces never needs to import the one that listens.
const listeners = new Map();

export function on(name, listener) {
  if (!listeners.has(name)) listeners.set(name, []);
  listeners.get(name).push(listener);
}

export function emit(name, data = {}) {
  for (const listener of listeners.get(name) ?? []) listener(data);
}
