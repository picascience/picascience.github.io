// Point d'entrée : boucle de jeu à pas fixe (120 Hz) + rendu interpolé,
// machine à états (menu → jeu → transition en iris), branchement des effets (juice) et de l'audio.

import { generateLevel } from './game/level';
import { World, InputState } from './game/world';
import { Ev } from './game/events';
import { Save } from './game/save';
import { Input } from './input/input';
import { Scene3D, CAM_RIGHT, CAM_FWD, Layers } from './render/scene';
import { Quality } from './render/quality';
import { Pal } from './render/palette';
import { Sfx } from './audio/sfx';
import { Hud, Menu, Iris, initSpringCss, buildTitle, pressable } from './ui/ui';
import * as THREE from 'three';
import { Clock, STEP } from './core/clock';

const HITSTOP_S = 0.06;
const $ = (id: string) => document.getElementById(id)!;

initSpringCss();
buildTitle();

const canvas = $('c') as HTMLCanvasElement;
const scene = new Scene3D(canvas);
const quality = new Quality(scene);
const world = new World();
const input = new Input(canvas);
const sfx = new Sfx();
const inp: InputState = { mx: 0, mz: 0, jump: false };
const hud = new Hud();
const iris = new Iris();

// État de la boucle dans un objet (champs flottants modifiés sur place : pas d'allocation,
// contrairement à des variables de module réassignées)
const loop = { last: performance.now(), acc: 0, hitstop: 0 };

type Mode = 'menu' | 'play' | 'trans';
let mode: Mode = 'menu';
let island = 1;
let shardMask = 0;          // éclats déjà obtenus sur cette île (sauvegarde)
let shardGot = new Uint8Array(0);

// Couleurs HDR des particules (pré-multipliées une fois)
const SPARK_FIRE = Pal.flame.clone().multiplyScalar(7);
const SPARK_GOLD = Pal.portal.clone().multiplyScalar(5);
const SPARK_SHARD = Pal.shard.clone().multiplyScalar(4);

// --- Son -------------------------------------------------------------------
sfx.muted = Save.muted;
const muteBtn = $('mute');
muteBtn.classList.toggle('muted', sfx.muted);
input.onFirstTouch = () => sfx.unlock();
window.addEventListener('pointerdown', () => sfx.unlock(), { once: true });
pressable(muteBtn, () => {
  sfx.setMuted(!sfx.muted); Save.muted = sfx.muted; muteBtn.classList.toggle('muted', sfx.muted);
});
pressable($('home'), () => { if (mode === 'play') transition(() => toMenu()); }, () => sfx.click());

// --- Anneau du stick (mis à jour sur les événements tactiles, pas dans la boucle) --
const stick = $('stick'), knob = $('knob');
input.onStick = (on, ax, ay, cx, cy) => {
  stick.classList.toggle('on', on && mode === 'play');
  if (!on) return;
  stick.style.transform = `translate(${ax}px, ${ay}px)`;
  knob.style.transform = `translate(${cx - ax}px, ${cy - ay}px)`;
};

// --- Panneau de debug : triple tap (chargé à la demande) ---------------------
let gui: { show: (v?: boolean) => void; _hidden: boolean } | null = null;
input.onTripleTap = async () => {
  if (gui) { gui.show(gui._hidden); return; }
  const { createDebug } = await import('./debug/gui');
  gui = createDebug(scene, quality, () => loadIsland(island), (n) => { transition(() => { loadIsland(n); mode = 'play'; }); }) as any;
};

// --- Menu --------------------------------------------------------------------
const menu = new Menu(() => {
  if (mode !== 'menu') return;
  Save.current = menu.island;
  transition(() => {
    loadIsland(menu.island);
    menu.show(false);
    hud.show(true);
    mode = 'play';
  }, `Île ${menu.island}`);
}, () => sfx.click());

function toMenu() {
  mode = 'menu';
  hud.show(false);
  menu.refresh();
  menu.show(true);
  loadIsland(menu.island);
}

function loadIsland(n: number) {
  island = n;
  const L = generateLevel(n);
  world.load(L);
  scene.buildLevel(L);
  shardMask = Save.shardMask(n);
  shardGot = new Uint8Array(L.shards.length);
  hud.build(L.braseros.length, L.shards.length, shardMask);
  input.reset();
  loop.acc = 0;
}

// --- Transition en iris --------------------------------------------------------
let trans: { t: number; phase: 0 | 1 | 2; mid: () => void; label: string; sub: string } | null = null;
const scr = { x: 0, y: 0 };
const IRIS_CLOSE = 0.55, IRIS_HOLD = 0.55, IRIS_OPEN = 0.75;

function transition(mid: () => void, label = '', sub = '') {
  if (trans) return;
  mode = mode === 'play' || mode === 'menu' ? 'trans' : mode;
  trans = { t: 0, phase: 0, mid, label, sub };
  input.reset();
}

function updateTransition(dt: number) {
  if (!trans) return;
  trans.t += dt;
  const R = Math.hypot(window.innerWidth, window.innerHeight);
  scene.toScreen(scr, scene.orb.mesh.position.x, scene.orb.mesh.position.y, scene.orb.mesh.position.z);
  if (trans.phase === 0) {
    const k = Math.min(1, trans.t / IRIS_CLOSE);
    iris.set(scr.x, scr.y, R * (1 - k * k * (3 - 2 * k)) ** 1.6);
    if (k >= 1) {
      trans.phase = 1; trans.t = 0;
      const prevMode = mode;
      trans.mid();                          // chargement de l'île pendant que l'écran est fermé
      if (mode === prevMode && mode === 'trans') mode = 'play';
      if (trans.label) iris.text(trans.label, trans.sub);
    }
  } else if (trans.phase === 1) {
    iris.set(scr.x, scr.y, 0);
    if (trans.t >= (trans.label ? IRIS_HOLD + 0.35 : IRIS_HOLD * 0.4)) { trans.phase = 2; trans.t = 0; }
  } else {
    const k = Math.min(1, trans.t / IRIS_OPEN);
    const e = 1 - Math.pow(1 - k, 3);
    iris.set(scr.x, scr.y, R * e * 1.05);
    if (k >= 1) { iris.set(0, 0, 4000); trans = null; }
  }
}

// --- Boucle -------------------------------------------------------------------

const perf = { jsMs: 0 };
function frame(now: number) {
  requestAnimationFrame(frame);
  const tJs = performance.now();
  const rawDt = Math.min((now - loop.last) / 1000, 0.1);
  loop.last = now;
  Clock.dt = rawDt;
  Clock.time += rawDt;
  quality.tick();
  let dt = rawDt;

  input.poll();
  if (mode === 'play') {
    // Hitstop : on gèle la simulation quelques millisecondes (impact ressenti)
    if (loop.hitstop > 0) { loop.hitstop -= dt; dt = 0; }
    inp.mx = CAM_RIGHT.x * input.sx + CAM_FWD.x * input.sy;
    inp.mz = CAM_RIGHT.z * input.sx + CAM_FWD.z * input.sy;
    if (input.consumeJump()) inp.jump = true;
    loop.acc += dt;
    let n = 0;
    while (loop.acc >= STEP && n < 10) {
      world.step(inp);
      inp.jump = false;
      loop.acc -= STEP; n++;
      if (world.events.count) handleEvents();
      if (loop.hitstop > 0) { loop.acc = 0; break; }
    }
    if (n === 10) loop.acc = 0;
    sfx.roll(world.vel, world.grounded);
  } else {
    input.consumeJump();
    sfx.roll(world.vel, false);
  }
  updateTransition(rawDt);

  Clock.alpha = mode === 'play' ? loop.acc / STEP : 1;
  if (world.level) scene.sync(world, shardGot);
  perf.jsMs += (performance.now() - tJs - perf.jsMs) * 0.05;   // moyenne glissante
  scene.render();
}

function handleEvents() {
  const E = world.events, L = world.level, juice = Layers.juice;
  for (let e = 0; e < E.count; e++) {
    const a = E.a[e];
    switch (E.type[e]) {
      case Ev.Land:
        if (juice) scene.orb.land(a);
        if (a > 5) scene.trauma = Math.min(1, scene.trauma + 0.22);
        scene.particles.puff(world.pos[0], world.pos[1] - 0.26, world.pos[2], Math.min(14, 4 + (a | 0)), Math.min(1, a / 7));
        sfx.land(a);
        break;
      case Ev.Jump:
        if (juice) { scene.orb.squashV += 3.5; }
        sfx.jump();
        break;
      case Ev.Light: {
        const B = L.braseros[a];
        scene.setGlow(a, 1);
        if (juice) { loop.hitstop = HITSTOP_S; scene.trauma = Math.min(1, scene.trauma + 0.38); }
        scene.particles.sparksAt(B.x, B.y + 0.6, B.z, 46, SPARK_FIRE, 3.2, 2.2, 0.9, 11, 2.5);
        scene.orb.mat.uniforms.uPulse.value = 1.5;
        hud.light(a);
        sfx.chime(world.litCount - 1);
        break;
      }
      case Ev.PortalOpen: {
        const P = L.portal;
        scene.setGlow(L.braseros.length, 1);
        scene.portalOpen = 1;
        scene.particles.sparksAt(P.x, P.y + 1, P.z, 50, SPARK_GOLD, 2.4, 1.2, 1.3, 9, 0.5);
        scene.trauma = Math.min(1, scene.trauma + 0.2);
        hud.allLit();
        sfx.portalOpen();
        break;
      }
      case Ev.PortalEnter: {
        const P = L.portal;
        scene.particles.sparksAt(P.x, P.y + 0.9, P.z, 60, SPARK_GOLD, 4, 1, 1.0, 12, 0);
        sfx.portalEnter();
        completeIsland();
        break;
      }
      case Ev.FragileCrack:
        sfx.crack();
        break;
      case Ev.FragileFall: {
        const i = a % 64, j = (a / 64) | 0;
        scene.particles.chunksAt(i - 32 + 0.5, L.heights[a] - 0.15, j - 32 + 0.5, 7);
        scene.trauma = Math.min(1, scene.trauma + 0.12);
        sfx.crumble();
        break;
      }
      case Ev.Fall:
        scene.trauma = 0.5;
        scene.orb.resetTrail(world.pos[0], world.pos[1], world.pos[2]);
        sfx.fall();
        break;
      case Ev.Shard: {
        const S = L.shards[a];
        shardGot[a] = 1;
        scene.particles.sparksAt(S.x, S.y, S.z, 34, SPARK_SHARD, 2.6, 1.5, 0.9, 9, 1.5);
        if (juice) loop.hitstop = HITSTOP_S * 0.7;
        hud.shard(a);
        Save.collectShard(island, a);
        sfx.shard();
        break;
      }
    }
  }
  E.clear();
}

function completeIsland() {
  const t = world.time + world.falls * 3; // pénalité de 3 s par chute
  const rec = Save.submitTime(island, t);
  Save.farthest = island + 1;
  Save.current = island + 1;
  const next = island + 1;
  const got = shardGot.reduce((s, v) => s + v, 0);
  const sub = `${t.toFixed(1).replace('.', ',')} s${rec ? ' · record' : ''}${got ? ` · ${'◆'.repeat(got)}` : ''}`;
  transition(() => { loadIsland(next); }, `Île ${next}`, sub);
}

function resize() { scene.resize(window.innerWidth, window.innerHeight); }
window.addEventListener('resize', resize);
resize();

// Paramètre de capture : ?couches=K n'active que les K premières couches de rendu
// (0 rien · 1 éclairage cuit · 2 ACES · 3 bloom · 4 tilt-shift · 5 brume/poussière · 6 orbe fresnel+traînée · 7 étalonnage/vignette/grain)
const cParam = new URLSearchParams(location.search).get('couches');
if (cParam !== null) {
  const K = parseInt(cParam), ps = scene.post.s;
  Layers.bake = K >= 1; ps.aces = K >= 2; ps.bloom = K >= 3; ps.dof = K >= 4;
  Layers.atmosphere = K >= 5; Layers.orbFx = K >= 6;
  ps.grade = K >= 7; ps.vignette = K >= 7 ? ps.vignette : 0; ps.grain = K >= 7 ? ps.grain : 0;
  quality.auto = false;
  scene.post.apply();
}

// Île de fond derrière le menu
menu.refresh();
loadIsland(menu.island);
menu.show(true);

// Paramètres de test : ?ile=N lance directement l'île N ; ?couches=K n'active que les K premières couches
const params = new URLSearchParams(location.search);
const q = params.get('ile');
if (q) { menu.island = Math.max(1, parseInt(q) || 1); loadIsland(menu.island); menu.show(false); hud.show(true); mode = 'play'; }

requestAnimationFrame((t) => { loop.last = t; frame(t); });
requestAnimationFrame(() => $('boot').classList.add('done'));

// Hors ligne : service worker limité à /apps/lumen/ (ne touche pas au launcher MK Apps)
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => { /* ignoré */ });
}

// Accès pour les tests automatisés
(window as any).__lumen = { world, scene, input, quality, loadIsland, Layers, THREE, perf, get mode() { return mode; } };
