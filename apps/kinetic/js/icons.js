// KINETIC — Icônes vectorielles géométriques sur mesure (stroke 1.75, extrémités rondes). Zéro emoji.
const P = {
  logo: '<path d="M6 4.5v15"/><path d="M18.5 4.5 10.5 12l8 7.5"/><path d="M13.5 12H21"/>',
  sound: '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6"/><path d="M18.2 6.6a7.6 7.6 0 0 1 0 10.8"/>',
  mute: '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path d="m16 9.5 5 5"/><path d="m21 9.5-5 5"/>',
  left: '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
  right: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  up: '<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  grip: '<path d="M9 7h.01M15 7h.01M9 12h.01M15 12h.01M9 17h.01M15 17h.01" stroke-width="2.6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  alert: '<path d="M12 4 21 19.5H3z"/><path d="M12 10v4"/><path d="M12 16.8h.01" stroke-width="2.4"/>',
  split: '<path d="M12 21v-6.5"/><path d="M12 14.5 6.5 9V4.5"/><path d="M12 14.5 17.5 9V4.5"/><path d="M4.2 6.8 6.5 4.5l2.3 2.3"/><path d="m15.2 6.8 2.3-2.3 2.3 2.3"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9.5 7V4.5h5V7"/><path d="m6.5 7 1 12.5h9l1-12.5"/><path d="M10 11v5M14 11v5"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  pause: '<path d="M9 5.5v13M15 5.5v13"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  flame: '<path d="M12 21a6 6 0 0 0 6-6c0-4.2-3.2-6.4-4.2-10.5C11.6 6.6 10.8 8.6 10.8 10.6 9.6 9.8 9 8.7 9 7.6 7.3 9.4 6 11.9 6 15a6 6 0 0 0 6 6z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="M12 1.8v3M12 19.2v3M1.8 12h3M19.2 12h3"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>',
  inbox: '<path d="M3.5 13.5 6 5.5h12l2.5 8"/><path d="M3.5 13.5v5h17v-5h-5.2a3.3 3.3 0 0 1-6.6 0z"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
}
