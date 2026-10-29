// schedule.js — things to do a moment later, on the game's own clock (so a pause
// holds them too, and a new run drops whatever was still waiting).
const queue = [];

export function later(delay, fn) {
  queue.push({ wait: delay, fn });
}

// once per frame, tutorial included
export function runLater(dt) {
  for (let i = queue.length - 1; i >= 0; i--) {
    const item = queue[i];
    item.wait -= dt;
    if (item.wait > 0) continue;
    queue.splice(i, 1);
    item.fn();
  }
}

export function clearLater() {
  queue.length = 0;
}
