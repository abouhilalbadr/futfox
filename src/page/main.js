// Waits for the Web App to finish starting, notes the active squad, then adds the
// FutFox button.
(function (root) {
  'use strict';

  const H = root.FutFox;
  if (!H || H.started) return;
  H.started = true;

  let waited = 0;
  const timer = setInterval(() => {
    if (!H.fut.isReady() || !document.body) return;
    // Login data fills the club cache with the active squad; wait for it, but not forever.
    if (H.fut.knownClubItems().length === 0 && ++waited < 30) return;
    clearInterval(timer);
    H.fut.rememberActiveSquad();
    H.ui = H.panel.create();
  }, 1000);
})(typeof globalThis !== 'undefined' ? globalThis : this);
