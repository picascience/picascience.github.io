// Retour haptique léger. Android : navigator.vibrate.
// iOS (Safari 18+) : basculer un <input type="checkbox" switch> déclenche un petit "tic" Taptic Engine.
// Doit être appelé pendant un geste utilisateur (pointerup / click).
let label = null;
let enabled = true;

function ensureSwitch() {
  if (label) return label;
  label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  return label;
}

function pulse(ms) {
  if (!enabled) return;
  try {
    if (navigator.vibrate && !/iP(hone|ad|od)/.test(navigator.userAgent)) { navigator.vibrate(ms); return; }
    ensureSwitch().click();
  } catch (e) { /* pas d'haptique : tant pis, le visuel suffit */ }
}

export const haptics = {
  tap: () => pulse(8),
  place: () => pulse(14),
  success: () => { pulse(12); setTimeout(() => pulse(12), 90); },
  error: () => pulse(25),
  setEnabled(v) { enabled = v; },
};
