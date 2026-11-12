// Interface : menu (titre en typographie animée), HUD sans texte, transitions en iris lumineux.
// Les animations utilisent un easing « ressort » généré en CSS linear() (repli cubic-bezier).

import { Save } from '../game/save';

const $ = (id: string) => document.getElementById(id)!;

/** Courbe de ressort échantillonnée → easing CSS linear(). */
function springEasing(stiffness = 170, damping = 12, samples = 40): string {
  let x = 0, v = 0;
  const dt = 1 / 60, pts: string[] = [];
  const total = samples;
  for (let i = 0; i <= total; i++) {
    pts.push(x.toFixed(3));
    for (let k = 0; k < 2; k++) { const a = stiffness * (1 - x) - damping * v; v += a * dt / 2; x += v * dt / 2; }
  }
  pts[pts.length - 1] = '1';
  return `linear(${pts.join(',')})`;
}

export function initSpringCss() {
  const root = document.documentElement.style;
  if (CSS.supports('transition-timing-function', 'linear(0, 1)')) {
    root.setProperty('--spring', springEasing());
    root.setProperty('--spring-soft', springEasing(110, 13));
  }
}

/** Titre : chaque lettre est un span animé (entrée en ressort, flottement, rebond au toucher). */
export function buildTitle() {
  const t = $('title');
  const word = 'LUMEN';
  t.innerHTML = '';
  [...word].forEach((ch, i) => {
    const s = document.createElement('span');
    s.className = 'ch';
    s.textContent = ch;
    s.style.setProperty('--i', String(i));
    t.appendChild(s);
  });
  t.addEventListener('pointerdown', () => {
    t.classList.remove('bump'); void t.offsetWidth; t.classList.add('bump');
  });
}

/** Micro-interaction : pression (écrasement) puis retour en ressort + onde lumineuse. */
export function pressable(el: HTMLElement, onTap: () => void, sfx?: () => void) {
  el.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    el.classList.add('down');
    const r = el.getBoundingClientRect();
    el.style.setProperty('--rx', `${e.clientX - r.left}px`);
    el.style.setProperty('--ry', `${e.clientY - r.top}px`);
    el.classList.remove('ripple'); void el.offsetWidth; el.classList.add('ripple');
  });
  const up = () => el.classList.remove('down');
  el.addEventListener('pointerup', (e) => { e.stopPropagation(); up(); sfx?.(); onTap(); });
  el.addEventListener('pointerleave', up);
  el.addEventListener('pointercancel', up);
}

export class Hud {
  private dots = $('dots');
  private shards = $('shards');
  readonly root = $('hud');

  build(braseros: number, shards: number, got: number) {
    this.dots.innerHTML = '';
    for (let b = 0; b < braseros; b++) {
      const d = document.createElement('i');
      d.className = 'dot';
      d.style.setProperty('--i', String(b));
      this.dots.appendChild(d);
    }
    this.shards.innerHTML = '';
    for (let s = 0; s < shards; s++) {
      const d = document.createElement('i');
      d.className = 'gem' + (got & (1 << s) ? ' had' : '');
      this.shards.appendChild(d);
    }
  }
  light(b: number) { this.dots.children[b]?.classList.add('on'); }
  allLit() { this.dots.classList.add('all'); }
  shard(s: number) { this.shards.children[s]?.classList.add('on'); }
  show(v: boolean) { this.root.classList.toggle('hidden', !v); if (v) this.dots.classList.remove('all'); }
}

export class Menu {
  readonly root = $('menu');
  private rec = $('record');
  private pickLabel = $('pickLabel');
  island = 1;

  constructor(onPlay: () => void, click: () => void) {
    pressable($('play'), onPlay, click);
    pressable($('prev'), () => this.pick(-1), click);
    pressable($('next'), () => this.pick(1), click);
  }

  refresh() {
    this.island = Math.min(Save.current, Save.farthest);
    const far = Save.farthest, shards = Save.shardTotal;
    this.rec.innerHTML = far > 1 || shards > 0
      ? `<span>Record&nbsp;· île ${far}</span>${shards ? `<span class="gemcount"><i class="gem on"></i>${shards}</span>` : ''}`
      : '';
    this.pick(0);
  }

  private pick(d: number) {
    this.island = Math.max(1, Math.min(Save.farthest, this.island + d));
    this.pickLabel.textContent = `Île ${this.island}`;
    $('prev').classList.toggle('off', this.island <= 1);
    $('next').classList.toggle('off', this.island >= Save.farthest);
    $('picker').classList.toggle('hidden', Save.farthest <= 1);
  }

  show(v: boolean) {
    this.root.classList.toggle('hidden', !v);
    if (v) { this.root.classList.remove('enter'); void this.root.offsetWidth; this.root.classList.add('enter'); }
  }
}

/** Transition en iris lumineux : un cercle de lumière se referme sur l'orbe, puis se rouvre. */
export class Iris {
  private el = $('iris');
  private label = $('irisLabel');
  private sub = $('irisSub');
  r = 2000; // rayon courant (px)

  set(x: number, y: number, r: number) {
    this.r = r;
    const s = this.el.style;
    s.setProperty('--x', `${x.toFixed(0)}px`);
    s.setProperty('--y', `${y.toFixed(0)}px`);
    s.setProperty('--r', `${Math.max(0, r).toFixed(1)}px`);
    this.el.classList.toggle('off', r > 1800);
  }
  text(main: string, sub = '') {
    this.label.textContent = main;
    this.sub.textContent = sub;
    this.label.parentElement!.classList.remove('show'); void this.label.offsetWidth;
    if (main) this.label.parentElement!.classList.add('show');
  }
  hideText() { this.label.parentElement!.classList.remove('show'); }
}
