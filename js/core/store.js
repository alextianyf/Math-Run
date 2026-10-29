// store.js — saved settings and records, in the browser's localStorage.
// Every key gets a "mathrun." prefix. Reading or writing never throws: in a private
// window, or with storage turned off, reads give the fallback and writes do nothing.

const PREFIX = 'mathrun.';

export const store = {
  get(key, fallback) {
    try {
      const saved = localStorage.getItem(PREFIX + key);
      if (saved === null) return fallback;
      return JSON.parse(saved);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // private mode, storage full, …: the setting just isn't kept
    }
  },
};
