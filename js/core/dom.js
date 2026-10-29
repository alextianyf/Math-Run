// dom.js — small helpers for the page.

export function $(id) {
  return document.getElementById(id);
}

// Play a CSS animation again from the start, even if its class is already on.
// Taking the class off and putting it back is not enough on its own: the browser
// merges both changes. Reading offsetWidth in between makes it apply the first one.
export function restartAnimation(el, className) {
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}
