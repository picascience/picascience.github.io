// HUD minimaliste, lisible au pouce : ressources, soleil, cartes de construction, toasts, fiche bâtiment.
import * as THREE from 'three';
import { BUILDINGS, BUILD_ORDER } from '../game/defs.js';
import { ICONS, LOCK, RES_ICON } from './icons.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.floor(n).toLocaleString('fr-FR');
const rate = (r) => (r >= 0 ? '+' : '−') + Math.abs(r).toFixed(Math.abs(r) < 10 ? 1 : 0);
const RES_SHORT = { eau: 'eau', pierre: 'pierre', fertilite: 'fert.' };

export class Hud {
  constructor(h) {
    this.h = h;
    this.tool = null;
    this.acc = 0;
    this.chips = {};
    document.querySelectorAll('.chip').forEach(c => (this.chips[c.dataset.r] = { el: c, b: c.querySelector('b'), s: c.querySelector('small'), last: -1 }));
    $('btnPause').addEventListener('click', () => h.onPause());
    $('btnTree').addEventListener('click', () => h.onTree());
    $('btnSpeed').addEventListener('click', () => h.onSpeed());
    $('infoClose').addEventListener('click', () => this.hideInfo());
    $('infoDemolish').addEventListener('click', () => { if (this.infoB) h.onDemolish(this.infoB); this.hideInfo(); });
    this.floatPool = [];
    for (let k = 0; k < 14; k++) {
      const el = document.createElement('div');
      el.className = 'floater';
      $('floaters').appendChild(el);
      this.floatPool.push({ el, t: 1, life: 1, pos: new THREE.Vector3() });
    }
    this.v = new THREE.Vector3();
  }

  show(v) { $('hud').classList.toggle('hidden', !v); }

  buildTray(sim) {
    this.sim = sim;
    const tray = $('tray');
    tray.innerHTML = '';
    this.cards = {};
    for (const type of BUILD_ORDER) {
      const d = BUILDINGS[type];
      const el = document.createElement('button');
      el.className = 'card';
      el.innerHTML = `<span class="ico">${ICONS[type]}</span><span class="nm">${d.short || d.name}</span><span class="cost"></span>${LOCK}`;
      el.addEventListener('click', () => {
        if (!sim.unlocked.has(type)) { this.h.onLockedTap(type); return; }
        this.h.onSelectTool(this.tool === type ? null : type);
      });
      tray.appendChild(el);
      this.cards[type] = { el, cost: el.querySelector('.cost') };
    }
    this.refreshCards(true);
  }

  setTool(type) {
    this.tool = type;
    for (const k in this.cards) this.cards[k].el.classList.toggle('sel', k === type);
  }

  markNew(type) {
    const c = this.cards[type];
    if (!c) return;
    c.el.classList.remove('new'); void c.el.offsetWidth; c.el.classList.add('new');
    c.el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  refreshCards(force) {
    const s = this.sim;
    for (const type in this.cards) {
      const c = this.cards[type], d = BUILDINGS[type];
      const locked = !s.unlocked.has(type);
      c.el.classList.toggle('locked', locked);
      let html = '';
      for (const k in d.cost) html += `<i class="${s.res[k] < d.cost[k] ? 'no' : ''}">${d.cost[k]}${RES_ICON[k]}</i>`;
      if (force || c.html !== html) { c.cost.innerHTML = html; c.html = html; }
    }
  }

  update(sim, dt) {
    this.acc += dt;
    if (this.acc < 0.1) return;
    this.acc = 0;
    for (const k in this.chips) {
      const c = this.chips[k], v = Math.floor(sim.res[k]);
      if (v !== c.last) {
        if (v > c.last && c.last >= 0) { c.el.classList.add('bump'); clearTimeout(c.to); c.to = setTimeout(() => c.el.classList.remove('bump'), 160); }
        c.last = v; c.b.textContent = v;
      }
      c.s.textContent = rate(sim.rates[k]) + '/s';
      c.el.classList.toggle('low', v < 5 && sim.rates[k] <= 0);
    }
    $('scoreVal').textContent = fmt(sim.score);
    $('scoreRate').textContent = '+' + sim.rates.prosp.toFixed(1) + '/s';
    const p = sim.progress;
    $('dayFill').style.width = (p * 100).toFixed(2) + '%';
    $('daySun').style.left = (p * 100).toFixed(2) + '%';
    $('daySun').style.color = p > 0.85 ? '#ff7a45' : p > 0.6 ? '#ffae55' : '#ffd77a';
    this.refreshCards(false);
    if (this.infoB) this.fillInfo(this.infoB);
  }

  hint(text) { const el = $('hint'); if (el.textContent !== text) el.textContent = text; }

  toast(text, kind = '', icon = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.innerHTML = (icon ? icon : '') + `<span>${text}</span>`;
    const box = $('toasts');
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 360); }, 2600);
  }

  showInfo(b) { this.infoB = b; $('info').classList.remove('hidden'); this.fillInfo(b); }
  hideInfo() { this.infoB = null; $('info').classList.add('hidden'); }
  fillInfo(b) {
    const d = BUILDINGS[b.type];
    $('infoIcon').innerHTML = ICONS[b.type];
    $('infoName').textContent = d.name;
    const st = { ok: 'En activité', 'à sec': 'À sec : relie-le à l’eau', 'ensablé': 'Ensablé : tape le sable pour dégager', 'sécheresse': 'Ralenti par la sécheresse', 'peu de fertilité': 'Manque de fertilité' }[b.status] || b.status;
    const extra = [];
    if (b.type === 'atelier' && b.near.rock) extra.push('bonus rocher');
    if (b.near.fountain && b.type === 'jardin') extra.push('bonus fontaine');
    if (b.near.tower && b.type !== 'tour') extra.push('aura de la tour');
    $('infoStatus').textContent = st + (extra.length ? ' · ' + extra.join(' · ') : '');
    $('infoDesc').textContent = d.desc;
  }

  // "+N" flottants au-dessus des bâtiments (pool de 14 éléments DOM réutilisés)
  floater(pos, text, res) {
    const f = this.floatPool.find(x => x.t >= x.life);
    if (!f) return;
    f.t = 0; f.life = 1.4; f.pos.copy(pos);
    f.el.innerHTML = (RES_ICON[res] || '') + text;
  }
  updateFloaters(camera, w, h, dt) {
    for (const f of this.floatPool) {
      if (f.t >= f.life) { if (f.el.style.opacity !== '0') f.el.style.opacity = '0'; continue; }
      f.t += dt;
      const u = f.t / f.life;
      this.v.copy(f.pos); this.v.y += u * 1.2;
      this.v.project(camera);
      if (this.v.z > 1) { f.el.style.opacity = '0'; continue; }
      const x = (this.v.x * 0.5 + 0.5) * w, y = (-this.v.y * 0.5 + 0.5) * h;
      f.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%) scale(${(0.8 + Math.min(1, u * 5) * 0.2).toFixed(2)})`;
      f.el.style.opacity = (Math.min(1, u * 6) * (1 - u * u)).toFixed(2);
    }
  }

  renderTree(sim) {
    const list = $('treeList');
    const node = (type) => {
      const d = BUILDINGS[type];
      const ok = sim ? sim.unlocked.has(type) : type === 'puits' || type === 'canal';
      const cost = Object.entries(d.cost).map(([k, v]) => `${v} ${k === 'fertilite' ? 'fertilité' : k}`).join(' · ');
      const n = sim ? sim.count[type] : 0;
      return `<div class="tnode ${ok ? '' : 'locked'}"><span class="ico">${ICONS[type]}</span><div><b>${d.name}</b><p>${d.desc}</p><p>Coût : ${cost}</p>
        <span class="st ${ok ? 'ok' : 'lk'}">${ok ? (n ? `Débloqué · ${n} construit${n > 1 ? 's' : ''}` : 'Débloqué') : 'Requis : ' + d.reqText}</span></div></div>`;
    };
    const link = '<div class="tlink"></div>';
    list.innerHTML = `<div class="tpair">${node('puits')}${node('canal')}</div>` +
      ['jardin', 'atelier', 'fontaine', 'marche', 'bibliotheque', 'tour', 'aqueduc'].map(t => link + node(t)).join('');
  }
}
