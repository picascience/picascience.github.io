// Icônes dessinées des bâtiments (SVG inline, aucun emoji).
const S = (body) => `<svg viewBox="0 0 48 48" fill="none" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const sand = '#eec38c', stone = '#d9a46a', teal = '#4fd6cc', gold = '#f6c46a', white = '#fff4e2', green = '#8fcf5e', blue = '#2f7fa8';

export const ICONS = {
  puits: S(`<path d="M8 22 24 11l16 11" stroke="${gold}" stroke-width="4"/><path d="M14 22v10M34 22v10" stroke="${white}" stroke-width="3"/>
    <rect x="11" y="30" width="26" height="11" rx="3" fill="${stone}"/><path d="M15 33h18" stroke="${teal}" stroke-width="3"/>`),
  canal: S(`<rect x="6" y="14" width="36" height="20" rx="5" fill="${stone}"/><rect x="9" y="19" width="30" height="10" rx="3" fill="${teal}"/>
    <path d="M12 24c3-2.5 6 2.5 9 0s6 2.5 9 0 6 2.5 6 0" stroke="${white}" stroke-width="2"/>`),
  jardin: S(`<rect x="7" y="31" width="34" height="9" rx="3" fill="${stone}"/><path d="M24 31V17" stroke="#a87444" stroke-width="3"/>
    <path d="M24 17c-4-6-11-6-15-3 5 1 10 2 15 3zM24 17c4-6 11-6 15-3-5 1-10 2-15 3zM24 17c-2-5-1-9 3-12 1 5 0 9-3 12z" fill="${green}"/>
    <circle cx="14" cy="29" r="3.5" fill="${green}"/><circle cx="34" cy="29" r="3.5" fill="${green}"/>`),
  atelier: S(`<rect x="8" y="17" width="22" height="20" rx="2" fill="${stone}"/><path d="M15 37v-7a4 4 0 0 1 8 0v7" fill="#5a3a22"/>
    <rect x="22" y="9" width="5" height="9" fill="${stone}"/><path d="M24.5 7c2-2 0-4 2-5" stroke="${white}" stroke-width="2" opacity=".7"/>
    <rect x="32" y="29" width="9" height="8" rx="1" fill="${sand}"/><rect x="34" y="22" width="7" height="7" rx="1" fill="${stone}"/>`),
  fontaine: S(`<path d="M8 32h32l-3 8H11z" fill="${stone}"/><path d="M8 32h32" stroke="${teal}" stroke-width="3"/>
    <path d="M24 32V18" stroke="${white}" stroke-width="3"/><path d="M17 18h14l-2 3H19z" fill="${stone}"/>
    <path d="M24 15c-5 2-8 7-9 13M24 15c5 2 8 7 9 13" stroke="${teal}" stroke-width="2.5"/><circle cx="24" cy="12" r="2.5" fill="${gold}"/>`),
  marche: S(`<rect x="7" y="18" width="34" height="22" rx="2" fill="${white}" opacity=".9"/>
    <path d="M10 40v-9a4 4 0 0 1 8 0v9M20 40v-9a4 4 0 0 1 8 0v9M30 40v-9a4 4 0 0 1 8 0v9" fill="#6b4226"/>
    <path d="M5 18l4-8h30l4 8z" fill="#d8643f"/><path d="M15 10l-2 8M24 10v8M33 10l2 8" stroke="${white}" stroke-width="2.5"/>`),
  bibliotheque: S(`<path d="M12 22a12 12 0 0 1 24 0z" fill="${gold}"/><path d="M24 6v4" stroke="${gold}" stroke-width="2.5"/>
    <rect x="9" y="22" width="30" height="5" fill="${blue}"/><rect x="10" y="27" width="28" height="13" fill="${white}"/>
    <path d="M20 40v-6a4 4 0 0 1 8 0v6" fill="#5a3a22"/><path d="M13 36v-3a2 2 0 0 1 4 0v3M31 36v-3a2 2 0 0 1 4 0v3" fill="#5a3a22"/>`),
  tour: S(`<path d="M18 13a6 6 0 0 1 12 0z" fill="${gold}"/><rect x="18" y="13" width="12" height="4" fill="#ffb35a"/>
    <rect x="17" y="17" width="14" height="23" fill="${blue}"/><path d="M17 23h14M17 29h14M17 35h14" stroke="${teal}" stroke-width="2"/>
    <path d="M24 20l2 2-2 2-2-2z" fill="${gold}"/><rect x="14" y="38" width="20" height="4" rx="1" fill="${stone}"/>`),
  aqueduc: S(`<rect x="5" y="13" width="38" height="5" rx="1" fill="${teal}"/>
    <path d="M5 18h38v22h-6v-8a6 6 0 0 0-12 0v8h-2v-8a6 6 0 0 0-12 0v8H5z" fill="${stone}"/><path d="M8 15.5h32" stroke="${white}" stroke-width="1.6" opacity=".8"/>`),
};

export const LOCK = `<svg viewBox="0 0 24 24" class="lock"><rect x="5" y="10" width="14" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke-width="2.4"/></svg>`;
export const RES_ICON = {
  eau: `<svg viewBox="0 0 24 24" style="color:#4fd6cc"><path d="M12 2.5C9 7 5.5 10.6 5.5 14.6A6.5 6.5 0 0 0 18.5 14.6C18.5 10.6 15 7 12 2.5z"/></svg>`,
  pierre: `<svg viewBox="0 0 24 24" style="color:#eec38c"><path d="M3 9l9-5 9 5-9 5z"/><path d="M3 9v6l9 5V14z" opacity=".75"/><path d="M21 9v6l-9 5V14z" opacity=".55"/></svg>`,
  fertilite: `<svg viewBox="0 0 24 24" style="color:#a8db6e"><path d="M12 12C12 7 8 4 3.5 4.5 3.5 9 7 12 12 12z"/><path d="M12 14c0-4 3.2-6.8 8.5-6.5 0 4.2-3.5 6.5-8.5 6.5z"/></svg>`,
  prosp: `<svg viewBox="0 0 24 24" style="color:#f6c46a"><path d="M12 2l2.6 4.2 4.8-1.2-1.2 4.8L22 12l-4.2 2.6 1.2 4.8-4.8-1.2L12 22l-2.6-4.2-4.8 1.2 1.2-4.8L2 12l4.2-2.6-1.2-4.8 4.8 1.2z"/></svg>`,
  storm: `<svg viewBox="0 0 24 24" style="color:#ffcf8a"><path d="M3 8h11a3 3 0 1 0-3-3M3 13h16a3 3 0 1 1-3 3M3 18h8" fill="none" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" style="color:#ffb35a"><circle cx="12" cy="12" r="5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" fill="none" stroke-width="2" stroke-linecap="round"/></svg>`,
};
