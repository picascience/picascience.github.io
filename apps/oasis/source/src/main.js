// Oasis — point d'entrée : assemble rendu, monde, simulation, entrées et interface.
import * as THREE from 'three';
import { startLoop, StateMachine, damp, clamp, lerp, smooth } from './core/loop.js';
import { Input } from './core/input.js';
import { haptics } from './core/haptics.js';
import { Sim } from './game/sim.js';
import { N, TILE, BUILDINGS, BUILD_ORDER, KEY, tileCenter, rankOf, RANKS } from './game/defs.js';
import { getMaterials, shared } from './world/materials.js';
import { Terrain } from './world/terrain.js';
import { Decor } from './world/decor.js';
import { Canals } from './world/canals.js';
import { BuildingRenderer, ghostFor } from './world/buildings.js';
import { FX } from './world/particles.js';
import { Atmosphere } from './world/atmosphere.js';
import { tileRing } from './world/textures.js';
import { CameraRig } from './render/camera.js';
import { Post, AdaptiveQuality, QUALITY } from './render/post.js';
import { Hud } from './ui/hud.js';
import { ICONS, RES_ICON } from './ui/icons.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(KEY + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) { /* mode privé */ } },
};

// ---------------- Rendu ----------------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = true;

const scene = new THREE.Scene();
let W = innerWidth, H = innerHeight;
const rig = new CameraRig(W / H);
const camera = rig.camera;
const atmo = new Atmosphere(scene, renderer);
const post = new Post(renderer, scene, camera);
getMaterials();
const fx = new FX(scene);
const buildings = new BuildingRenderer(scene);
const hud = new Hud({
  onPause: () => { haptics.tap(); if (sm.is('play')) sm.set('pause'); },
  onTree: () => { haptics.tap(); openTree(); },
  onSpeed: () => { haptics.tap(); if (!sim) return; sim.speed = sim.speed === 1 ? 2 : 1; $('btnSpeed').textContent = '×' + sim.speed; },
  onSelectTool: (t) => { haptics.tap(); setTool(t); },
  onLockedTap: (t) => { haptics.error(); hud.toast(`${BUILDINGS[t].name} : ${BUILDINGS[t].reqText.toLowerCase()}`, '', '<span class="ico" style="width:22px;height:22px">' + ICONS[t] + '</span>'); },
  onDemolish: (b) => { haptics.place(); sim.demolish(b.i, b.j); },
});

// Curseur de case + fantôme du bâtiment
const cursorMat = new THREE.MeshBasicMaterial({ map: tileRing(), transparent: true, depthWrite: false, color: 0xbff7c0, fog: false });
const cursor = new THREE.Mesh(new THREE.PlaneGeometry(TILE * 0.98, TILE * 0.98).rotateX(-Math.PI / 2), cursorMat);
cursor.renderOrder = 4; cursor.visible = false;
scene.add(cursor);
const ghostMat = new THREE.MeshBasicMaterial({ color: 0x9cf0b0, transparent: true, opacity: 0.42, depthWrite: false, fog: false });
const ghost = new THREE.Mesh(new THREE.BufferGeometry(), ghostMat);
ghost.renderOrder = 5; ghost.visible = false;
scene.add(ghost);
const ghostGeos = {};
const selRing = new THREE.Mesh(cursor.geometry, new THREE.MeshBasicMaterial({ map: cursorMat.map, transparent: true, depthWrite: false, color: 0xffd27a, fog: false }));
selRing.visible = false; selRing.renderOrder = 4;
scene.add(selRing);

// ---------------- Monde ----------------
let sim = null, terrain = null, decor = null, canals = null;
let seed = Number(new URLSearchParams(location.search).get('seed')) || (Math.random() * 1e6) | 0;
let instantPlace = false;
let tool = null;
let gridTarget = 0;
const SUN_AZ = rig.yaw + Math.PI + 1.15;

function newWorld(s, showcase) {
  if (terrain) { scene.remove(terrain.group); terrain.dispose(); }
  if (decor) { scene.remove(decor.group); decor.dispose(); }
  if (canals) canals.dispose();
  buildings.clear();
  fx.clear();
  sim = new Sim(s);
  terrain = new Terrain(sim);
  scene.add(terrain.group);
  decor = new Decor(terrain, s);
  scene.add(decor.group);
  canals = new Canals(scene, sim, terrain);
  wireSim();
  if (showcase) buildShowcase();
  atmo.shadowDirty = true;
}

function worldOf(i, j) { const [x, z] = tileCenter(i, j); return [x, terrain.height(x, z) + 0.02, z]; }

function wireSim() {
  sim.on('place', b => {
    const [x, y, z] = worldOf(b.i, b.j);
    buildings.add(b, x, y, z, instantPlace);
    terrain.stampAO(x, z, 1.5, 0.3);
    canals.dirty = true;
  });
  sim.on('remove', b => {
    const [x, y, z] = worldOf(b.i, b.j);
    buildings.remove(b);
    terrain.stampAO(x, z, 1.5, -0.3);
    fx.dustBurst(x, y, z, 30, 1.6);
    rig.addShake(0.25);
    canals.dirty = true; atmo.shadowDirty = true;
    if (hud.infoB === b) hud.hideInfo();
  });
  sim.on('canal', (i, j) => {
    canals.popIn(i, j);
    if (!instantPlace) { const [x, y, z] = worldOf(i, j); fx.dustBurst(x, y, z, 8, 0.8); }
    atmo.shadowDirty = true;
  });
  sim.on('canalRemove', () => { canals.dirty = true; atmo.shadowDirty = true; });
  sim.on('network', () => {
    canals.dirty = true;
    for (const b of sim.buildings) if (b.type === 'jardin') buildings.setDry(b, !b.watered);
  });
  sim.on('bury', (i, j) => { canals.bury(i, j); atmo.shadowDirty = true; });
  sim.on('clear', (i, j) => {
    canals.unbury(i, j);
    const [x, y, z] = worldOf(i, j);
    fx.dustBurst(x, y + 0.3, z, 28, 1.4);
    fx.sparkleRing(x, y, z, 1.0, 12);
    atmo.shadowDirty = true;
  });
  sim.on('unlock', type => {
    if (instantPlace) return;
    hud.toast(`Débloqué : ${BUILDINGS[type].name}`, 'good', '<span class="ico" style="width:24px;height:24px">' + ICONS[type] + '</span>');
    hud.markNew(type);
  });
  sim.on('storm', (on, dir) => {
    if (!on || instantPlace) return;
    const names = ['du nord', 'de l’est', 'du sud', 'de l’ouest'];
    hud.toast(`Tempête de sable venue ${names[dir]} !`, 'warn', RES_ICON.storm);
  });
  sim.on('drought', on => {
    if (instantPlace) return;
    hud.toast(on ? 'Sécheresse : puits et source faiblissent' : 'La sécheresse est passée', on ? 'warn' : 'good', RES_ICON.sun);
  });
  sim.on('end', () => { if (sm.is('play')) sm.set('end'); });
}

// Petite cité de démonstration pour le menu
function buildShowcase() {
  instantPlace = true;
  const s = sim;
  BUILD_ORDER.forEach(t => s.unlocked.add(t));
  const put = (t, i, j) => { s.res = { eau: 999, pierre: 999, fertilite: 999 }; s.place(t, i, j); };
  [[9, 7], [10, 7], [11, 7], [12, 7], [7, 9], [7, 10], [7, 11], [6, 11], [12, 8], [12, 9]].forEach(([i, j]) => put('canal', i, j));
  put('puits', 5, 7); put('canal', 6, 7);
  [[10, 6], [11, 6], [10, 8], [6, 10], [8, 10], [8, 11], [11, 9], [5, 11], [13, 9]].forEach(([i, j]) => put('jardin', i, j));
  put('fontaine', 11, 8); put('fontaine', 8, 9);
  put('marche', 9, 10); put('bibliotheque', 10, 11); put('tour', 13, 6); put('aqueduc', 13, 7); put('atelier', 5, 5);
  s.update(0.3);
  instantPlace = false;
}

// ---------------- Outils & sélection ----------------
function setTool(t) {
  tool = t;
  hud.setTool(t);
  hud.hideInfo();
  selRing.visible = false;
  gridTarget = t ? 1 : 0;
  if (t && t !== 'canal') {
    if (!ghostGeos[t]) ghostGeos[t] = ghostFor(t);
    ghost.geometry = ghostGeos[t];
  }
}

const ray = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.08);
const ndc = new THREE.Vector2();
const hitV = new THREE.Vector3();
function ground(x, y, cam = rig.syncVirtual()) {
  ndc.set((x / W) * 2 - 1, -(y / H) * 2 + 1);
  ray.setFromCamera(ndc, cam);
  return ray.ray.intersectPlane(plane, hitV) ? hitV.clone() : null;
}
function tileAt(x, y, cam) {
  const p = ground(x, y, cam || camera);
  if (!p) return null;
  const i = Math.floor(p.x / TILE + N / 2), j = Math.floor(p.z / TILE + N / 2);
  return { i, j, p };
}

// ---------------- Gestes ----------------
let press = null;      // {x,y,tile}
let dragPan = null;    // point monde saisi
let canalLast = null;
let pinch0 = null;
let fingerXY = null;

function showGhostAt(t) {
  if (!t || !sim.cell(t.i, t.j)) { cursor.visible = ghost.visible = false; return null; }
  const [x, y, z] = worldOf(t.i, t.j);
  cursor.position.set(x, y + 0.12, z);
  cursor.visible = true;
  const ok = sim.canPlace(tool, t.i, t.j).ok;
  cursorMat.color.set(ok ? 0xbff7c0 : 0xff8f7a);
  if (tool !== 'canal') {
    ghost.visible = true;
    ghost.position.set(x, y, z);
    ghostMat.color.set(ok ? 0x9cf0b0 : 0xff8f7a);
  }
  return ok;
}

function traceCanal(t) {
  if (!t) return;
  if (canalLast && (canalLast.i !== t.i || canalLast.j !== t.j)) {
    // chemin 4-connexe entre la dernière case et la case courante
    let { i, j } = canalLast;
    let guard = 0;
    while ((i !== t.i || j !== t.j) && guard++ < 40) {
      if (Math.abs(t.i - i) >= Math.abs(t.j - j)) i += Math.sign(t.i - i); else j += Math.sign(t.j - j);
      sim.place('canal', i, j);
    }
  } else if (!canalLast) sim.place('canal', t.i, t.j);
  canalLast = { i: t.i, j: t.j };
}

const input = new Input(canvas, {
  press(x, y) {
    if (!sm.is('play')) return;
    fingerXY = { x, y };
    press = { x, y };
    if (tool && tool !== 'canal') showGhostAt(tileAt(x, y));
  },
  cancelPress() { press = null; ghost.visible = false; cursor.visible = false; },
  dragStart(x, y) {
    if (!sm.is('play')) return;
    if (tool === 'canal') { canalLast = null; traceCanal(tileAt(x, y)); }
    else if (!tool) dragPan = ground(x, y);
  },
  drag(x, y) {
    if (!sm.is('play')) return;
    fingerXY = { x, y };
    if (tool === 'canal') { const t = tileAt(x, y); traceCanal(t); showGhostAt(t); }
    else if (tool) showGhostAt(tileAt(x, y));
    else if (dragPan) {
      const now = ground(x, y);
      if (now) { rig.pan(dragPan.x - now.x, dragPan.z - now.z); }
    }
  },
  dragEnd(x, y, cancel) {
    if (!sm.is('play')) return;
    if (tool && tool !== 'canal' && !cancel) {
      const t = tileAt(x, y);
      if (t) tryPlace(t, true);
    }
    canalLast = null; dragPan = null; press = null; fingerXY = null;
    ghost.visible = false; cursor.visible = false;
  },
  tapNow(x, y) {
    // haptique synchrone (iOS exige un geste utilisateur) : on prédit le résultat
    if (!sm.is('play')) return;
    ghost.visible = cursor.visible = false; press = null; fingerXY = null;
    const t = tileAt(x, y);
    const c = t && sim.cell(t.i, t.j);
    if (!c) return;
    if (c.buried) haptics.tap();
    else if (tool) (sim.canPlace(tool, t.i, t.j).ok ? haptics.place : haptics.error)();
    else if (c.b) haptics.tap();
  },
  pinchStart(cx, cy) { pinch0 = { d: rig.dist, p: ground(cx, cy) }; ghost.visible = cursor.visible = false; dragPan = null; },
  pinch(scale, cx, cy, wheel) {
    if (!sm.is('play')) return;
    if (wheel) { rig.zoomTo(rig.dist * scale); return; }
    if (!pinch0) return;
    rig.zoomTo(pinch0.d * scale);
    const now = ground(cx, cy);
    if (pinch0.p && now) rig.pan(pinch0.p.x - now.x, pinch0.p.z - now.z);
  },
  pinchEnd() { pinch0 = null; },
});

function tryPlace(t, fromDrag) {
  if (!tool || !sim.cell(t.i, t.j)) return false;
  const cell = sim.cell(t.i, t.j);
  if (cell.buried) { sim.clearSand(t.i, t.j); return true; }
  const r = sim.place(tool, t.i, t.j);
  if (!r.ok) {
    hud.toast(r.reason, '', '');
    return false;
  }
  if (fromDrag) haptics.place();
  if (tool !== 'canal') {
    // la caméra se rapproche doucement de l'action
    const [x, , z] = worldOf(t.i, t.j);
    rig.target.x = lerp(rig.target.x, x, 0.18); rig.target.z = lerp(rig.target.z, z, 0.18);
    const d = BUILDINGS[tool];
    if (Object.keys(d.cost).some(k => sim.res[k] < d.cost[k])) setTool(null); // plus assez : on range l'outil
  }
  return true;
}

function handleTap(tap) {
  if (!sm.is('play')) return true;
  const t = tileAt(tap.x, tap.y);
  if (!t) return true;
  const c = sim.cell(t.i, t.j);
  if (!c) { hud.hideInfo(); selRing.visible = false; return true; }
  if (c.buried) { sim.clearSand(t.i, t.j); return true; }
  if (tool) { tryPlace(t, false); return true; }
  if (c.b) {
    hud.showInfo(c.b);
    const [x, y, z] = worldOf(t.i, t.j);
    selRing.position.set(x, y + 0.14, z); selRing.visible = true;
  } else { hud.hideInfo(); selRing.visible = false; }
  return true;
}

// ---------------- Conseils contextuels ----------------
function hintFor(s) {
  if (s.cells.some(r => r.some(c => c.buried))) return 'Tape les monticules de sable pour dégager.';
  if (!s.count.puits) return 'Choisis le Puits en bas, puis tape une case près de la source.';
  if (!s.count.canal) return 'Choisis le Canal et glisse le doigt depuis le puits ou la source.';
  if (!s.count.jardin) return 'Pose un Jardin au bord d’un canal en eau.';
  const dry = s.buildings.find(b => b.status === 'à sec');
  if (dry) return `Un ${BUILDINGS[dry.type].name.toLowerCase()} est à sec : relie-le à l’eau.`;
  if (!s.count.atelier) return 'Construis un Atelier de pierre (bonus à côté d’un rocher).';
  for (const t of BUILD_ORDER) if (!s.unlocked.has(t)) return `Prochain : ${BUILDINGS[t].name} — ${BUILDINGS[t].reqText.toLowerCase()}.`;
  if (s.progress > 0.8) return 'Le soleil se couche : dernières constructions !';
  return '';
}

// ---------------- États ----------------
const sm = new StateMachine();
let endT = 0, endElev = 0;
let dayElev = 36;

function elevFor(p) { return 36 * Math.pow(1 - p, 1.3) - 4 * p; }

function fadeThen(fn) {
  $('fade').classList.add('on');
  setTimeout(() => { fn(); requestAnimationFrame(() => setTimeout(() => $('fade').classList.remove('on'), 60)); }, 470);
}

sm.add('menu', {
  enter() {
    hud.show(false);
    ['pause', 'end', 'tree', 'how'].forEach(id => $(id).classList.add('hidden'));
    $('menu').classList.remove('hidden');
    $('bestVal').textContent = store.get('best', 0) ? Math.floor(store.get('best', 0)).toLocaleString('fr-FR') : '—';
    rig.orbit = { a: 0 };
    rig.target.set(1.5, 0, 1.5); rig.zoomTo(21); rig.snap();
    atmo.setSun(7.5, SUN_AZ);
    gridTarget = 0;
  },
  exit() { $('menu').classList.add('hidden'); rig.orbit = null; },
});
sm.add('play', {
  enter(prev) {
    hud.show(true);
    if (prev === 'pause') return;
    sim.speed = 1; $('btnSpeed').textContent = '×1';
    hud.buildTray(sim);
    setTool(null);
    rig.target.set(0, 0, 0); rig.zoomTo(32); rig.snap();
    hud.toast('Le jour avance : rends l’oasis prospère avant la nuit.', '', RES_ICON.sun);
  },
});
sm.add('pause', {
  enter() {
    hud.hideInfo(); selRing.visible = false;
    $('pause').classList.remove('hidden');
    $('seedInfo').textContent = 'Carte n° ' + sim.seed;
    refreshQualityUI();
  },
  exit() { $('pause').classList.add('hidden'); },
});
sm.add('end', {
  enter() {
    setTool(null); hud.hideInfo();
    endT = 0; endElev = atmo.elev;
    const score = Math.floor(sim.score);
    const best = Math.max(score, store.get('best', 0));
    const isBest = score > store.get('best', 0) && score > 0;
    store.set('best', best);
    const r = rankOf(score);
    setTimeout(() => {
      if (!sm.is('end')) return;
      hud.show(false);
      $('end').classList.remove('hidden');
      $('endScore').textContent = score.toLocaleString('fr-FR');
      $('endRank').textContent = r.name;
      const stars = $('endStars');
      stars.innerHTML = RANKS.slice(1).map((k, i) => `<svg viewBox="0 0 24 24" class="${i < r.index ? 'on' : ''}" style="animation-delay:${0.2 + i * 0.15}s"><path d="M12 2l2.6 4.2 4.8-1.2-1.2 4.8L22 12l-4.2 2.6 1.2 4.8-4.8-1.2L12 22l-2.6-4.2-4.8 1.2 1.2-4.8L2 12l4.2-2.6-1.2-4.8 4.8 1.2z"/></svg>`).join('');
      const nb = sim.buildings.length;
      $('endStats').textContent = `${nb} bâtiment${nb > 1 ? 's' : ''} · ${sim.count.canal} canaux · carte n° ${sim.seed}`;
      $('endBest').innerHTML = isBest ? '<b>Nouveau record !</b>' : `Meilleur score : <b>${best.toLocaleString('fr-FR')}</b>`;
      const next = RANKS[r.index + 1];
      if (next) $('endStats').textContent += ` · ${next.name} à ${next.min.toLocaleString('fr-FR')}`;
    }, 2600);
  },
  exit() { $('end').classList.add('hidden'); },
});

function startGame(s) {
  fadeThen(() => {
    seed = s;
    newWorld(seed, false);
    atmo.setSun(elevFor(0), SUN_AZ);
    sm.set('play');
  });
}

$('btnPlay').addEventListener('click', () => { haptics.tap(); startGame((Math.random() * 1e6) | 0); });
$('btnHow').addEventListener('click', () => { haptics.tap(); $('how').classList.remove('hidden'); });
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { haptics.tap(); $(b.dataset.close).classList.add('hidden'); }));
$('btnResume').addEventListener('click', () => { haptics.tap(); sm.set('play'); });
$('btnTree2').addEventListener('click', () => { haptics.tap(); openTree(); });
$('btnRestart').addEventListener('click', () => { haptics.tap(); $('pause').classList.add('hidden'); startGame(sim.seed); });
$('btnQuit').addEventListener('click', () => { haptics.tap(); $('pause').classList.add('hidden'); fadeThen(() => { newWorld(seed, true); sm.set('menu'); }); });
$('btnReplay').addEventListener('click', () => { haptics.tap(); startGame(sim.seed); });
$('btnNew').addEventListener('click', () => { haptics.tap(); startGame((Math.random() * 1e6) | 0); });
$('btnMenu').addEventListener('click', () => { haptics.tap(); fadeThen(() => { newWorld((Math.random() * 1e6) | 0, true); sm.set('menu'); }); });
function openTree() { hud.renderTree(sim && sm.name !== 'menu' ? sim : null); $('tree').classList.remove('hidden'); }

// ---------------- Qualité ----------------
const adaptive = new AdaptiveQuality(level => applyQuality(level));
function applyQuality(level) {
  const q = post.setLevel(level, W, H);
  atmo.setShadowQuality(q.shadow, true);
  renderer.shadowMap.type = level === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  atmo.envEnabled = q.env;
  if (!q.env) { scene.environment = null; } else atmo.lastEnvElev = 999;
  fx.density = q.particles;
  renderer.setSize(W, H, false);
  post.resize(W, H);
  updatePointScale();
  refreshQualityUI();
}
function refreshQualityUI() {
  document.querySelectorAll('#qualitySeg button').forEach(b => b.classList.toggle('on', b.dataset.q === adaptive.mode));
  const names = { low: 'basse', medium: 'moyenne', high: 'haute' };
  $('qualityInfo').textContent = `Qualité actuelle : ${names[adaptive.level]} · ${fpsShown} FPS`;
  document.querySelectorAll('#hapticSeg button').forEach(b => b.classList.toggle('on', b.dataset.h === (store.get('haptics', true) ? '1' : '0')));
}
document.querySelectorAll('#qualitySeg button').forEach(b => b.addEventListener('click', () => {
  haptics.tap(); adaptive.setMode(b.dataset.q); store.set('quality', b.dataset.q); refreshQualityUI();
}));
document.querySelectorAll('#hapticSeg button').forEach(b => b.addEventListener('click', () => {
  const on = b.dataset.h === '1'; store.set('haptics', on); haptics.setEnabled(on); haptics.tap(); refreshQualityUI();
}));
haptics.setEnabled(store.get('haptics', true));

function updatePointScale() {
  const s = (H * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  fx.dust.mat.uniforms.uScale.value = s; fx.glow.mat.uniforms.uScale.value = s;
}

function resize() {
  W = innerWidth; H = innerHeight;
  renderer.setSize(W, H, false);
  rig.setAspect(W / H);
  post.resize(W, H);
  updatePointScale();
}
addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => { if (document.hidden && sm.is('play')) sm.set('pause'); });

// ---------------- Boucle ----------------
let hintAcc = 0, floatAcc = 0, floatIdx = 0, fpsShown = 60, fpsAcc = 0, fpsFrames = 0;
const camPos = new THREE.Vector3(), sunTmp = new THREE.Vector3();
const PROD = { puits: ['eau', '+1.5'], aqueduc: ['eau', '+3'], atelier: ['pierre', '+1'], jardin: ['fertilite', '+0.8'], fontaine: ['prosp', '+2'], marche: ['prosp', '+5'], bibliotheque: ['prosp', '+4'], tour: ['prosp', '+8'] };

function update(dt) {
  input.consume(handleTap);
  shared.time.value += dt;
  const playing = sm.is('play');

  if (playing) {
    sim.update(dt);
    dayElev = elevFor(sim.progress);
    atmo.setSun(dayElev, SUN_AZ);
    hud.update(sim, dt);
    hintAcc += dt;
    if (hintAcc > 0.5) { hintAcc = 0; hud.hint(hintFor(sim)); }
    // "+N" au-dessus des bâtiments productifs
    floatAcc += dt;
    if (floatAcc > 1.1 && sim.buildings.length) {
      floatAcc = 0;
      const b = sim.buildings[floatIdx++ % sim.buildings.length];
      if (b.status === 'ok' && PROD[b.type]) {
        const [x, y, z] = worldOf(b.i, b.j);
        hud.floater(new THREE.Vector3(x, y + 2.2, z), PROD[b.type][1], PROD[b.type][0]);
      }
    }
    // bord d'écran : la caméra suit le doigt quand on vise avec un bâtiment
    if (tool && tool !== 'canal' && fingerXY && press) {
      const ey = fingerXY.y / H, ex = fingerXY.x / W;
      const f = { x: -Math.sin(rig.yaw), z: -Math.cos(rig.yaw) }, r = { x: Math.cos(rig.yaw), z: -Math.sin(rig.yaw) };
      let fw = 0, rt = 0;
      if (ey < 0.24) fw = (0.24 - ey) / 0.24; else if (ey > 0.72 && ey < 0.78) fw = -(ey - 0.72) / 0.06;
      if (ex < 0.1) rt = -(0.1 - ex) / 0.1; else if (ex > 0.9) rt = (ex - 0.9) / 0.1;
      if (fw || rt) { rig.pan((f.x * fw + r.x * rt) * 14 * dt, (f.z * fw + r.z * rt) * 14 * dt); showGhostAt(tileAt(fingerXY.x, fingerXY.y)); }
    }
    // le sable qui recouvre une case scintille pour attirer l'œil
    if (Math.random() < 3 * dt) {
      const buried = [];
      for (const r of sim.cells) for (const c of r) if (c.buried) buried.push(c);
      if (buried.length) { const c = buried[(Math.random() * buried.length) | 0]; const [x, y, z] = worldOf(c.i, c.j); fx.glint(x, y + 1.0, z); fx.dustBurst(x, y + 0.6, z, 3, 0.6); }
    }
    // tempête : rafales de sable, brume plus dense
    if (sim.storm.active) {
      const d = [[0, 1], [-1, 0], [0, -1], [1, 0]][sim.storm.dir];
      fx.storm(rig.cur.x, rig.cur.z, d[0], d[1], 2);
    }
    // émetteurs : fumée, jets d'eau, éclaboussures, éclats dorés
    buildings.forEachEmitter((kind, x, y, z, it) => {
      if (it.b.status !== 'ok' && it.b.status !== 'sécheresse') return;
      if (kind === 'smoke' && Math.random() < 5 * dt) fx.smoke(x, y, z);
      else if (kind === 'jet' && Math.random() < 28 * dt) fx.jet(x, y, z);
      else if (kind === 'splash' && Math.random() < 6 * dt) fx.splash(x, y, z, 2);
      else if (kind === 'glint' && Math.random() < (0.5 + shared.night.value * 3) * dt) fx.glint(x, y, z);
    });
  } else if (sm.is('menu')) {
    buildings.forEachEmitter((kind, x, y, z) => {
      if (kind === 'smoke' && Math.random() < 4 * dt) fx.smoke(x, y, z);
      else if (kind === 'jet' && Math.random() < 22 * dt) fx.jet(x, y, z);
      else if (kind === 'splash' && Math.random() < 5 * dt) fx.splash(x, y, z, 2);
      else if (kind === 'glint' && Math.random() < 2 * dt) fx.glint(x, y, z);
    });
  } else if (sm.is('end')) {
    // la nuit tombe : la caméra recule lentement, les lanternes s'allument
    endT += dt;
    atmo.setSun(lerp(endElev, -7, smooth(0, 2.5, endT)), SUN_AZ);
    rig.zoomTo(lerp(rig.dist, 40, dt * 0.6));
    buildings.forEachEmitter((kind, x, y, z) => {
      if (kind === 'jet' && Math.random() < 20 * dt) fx.jet(x, y, z);
      else if (kind === 'glint' && Math.random() < 3 * dt) fx.glint(x, y, z);
    });
  }

  terrain.grid.value = damp(terrain.grid.value, gridTarget, 8, dt);
  rig.update(dt);
  buildings.setLOD(rig.curDist > 44);
  const anim = buildings.update(dt, it => {
    // atterrissage : screen shake, poussière, anneau de lumière
    const big = { tour: 1.3, bibliotheque: 1.15, aqueduc: 1.2, marche: 1.1 }[it.b.type] || 1;
    rig.addShake(0.32 * big);
    fx.dustBurst(it.x, it.y, it.z, 34 * big, 1.7);
    if (it.b.type === 'fontaine' || it.b.type === 'puits' || it.b.type === 'aqueduc') fx.splash(it.x, it.y + 0.6, it.z, 18);
    atmo.shadowDirty = true;
  });
  canals.update(dt);
  fx.update(dt);
  camPos.copy(rig.next.pos);
  decor.update(dt, camPos);
  // reflets de l'eau qui ondulent
  getMaterials().waterNormal.offset.set(shared.time.value * 0.02, shared.time.value * 0.013);
  // bâtiments en animation (ou roue à eau qui tourne) -> ombres à jour
  if (anim) atmo.shadowDirty = true;
}

function render(alpha, dt) {
  rig.apply(alpha);
  atmo.update(camera, rig.cur);
  const d = rig.curDist;
  const stormK = sim && sim.storm.active ? Math.sin(Math.min(1, sim.storm.t / 7) * Math.PI) : 0;
  scene.fog.near = d * 1.35 * (1 - stormK * 0.6);
  scene.fog.far = (d * 4 + 40) * (1 - stormK * 0.55);
  atmo.u.uHaze.value = 0.3 + stormK * 0.6 + (sim && sim.drought.active ? 0.25 : 0);
  const sunWorld = sunTmp.copy(atmo.u.uSun.value).multiplyScalar(300).add(camera.position);
  post.render(shared.time.value, atmo.exposure, sunWorld, shared.night.value, 0.48);
  hud.updateFloaters(camera, W, H, dt);
  adaptive.sample(dt);
  fpsAcc += dt; fpsFrames++;
  if (fpsAcc > 1) { fpsShown = Math.round(fpsFrames / fpsAcc); fpsAcc = 0; fpsFrames = 0; if (sm.is('pause')) refreshQualityUI(); }
}

// Petit accès de débogage (tests automatisés) : n'affecte pas le jeu.
window.__oasis = {
  get sim() { return sim; }, get state() { return sm.name; },
  screenOf(i, j) { const [x, y, z] = worldOf(i, j); const v = new THREE.Vector3(x, y, z).project(camera); return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H]; },
  skip(sec) { sim.time += sec; },
  give(n) { sim.res.eau += n; sim.res.pierre += n; sim.res.fertilite += n; },
  quality: () => adaptive.level,
};

// ---------------- Démarrage ----------------
resize();
const savedQ = store.get('quality', 'auto');
adaptive.mode = savedQ;
const initial = savedQ === 'auto' ? 'medium' : savedQ;
adaptive.level = initial;
applyQuality(initial);
newWorld(seed, true);
sm.set('menu');
renderer.compile(scene, camera);
startLoop(update, render);
requestAnimationFrame(() => setTimeout(() => $('loading').classList.add('done'), 150));
