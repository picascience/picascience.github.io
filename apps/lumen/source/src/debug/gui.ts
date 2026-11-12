// Panneau de debug (lil-gui), chargé à la demande au premier triple tap : 0 octet au démarrage.
// Permet de régler les effets en direct sur le téléphone.

import GUI from 'lil-gui';
import type { Scene3D } from '../render/scene';
import { Layers } from '../render/scene';
import type { Quality } from '../render/quality';
import { QualityLevels } from '../render/quality';
import { Shared } from '../render/materials';
import { Tune } from '../game/world';

export function createDebug(scene: Scene3D, quality: Quality, rebuild: () => void, goto: (n: number) => void) {
  const gui = new GUI({ title: 'Lumen · debug', width: 250 });
  const post = scene.post, s = post.s, apply = () => { quality.auto = false; post.apply(); };

  const perf = { fps: '', ms: '', bake: '', drawCalls: 0, tris: 0, qualité: QualityLevels[quality.level].name };
  const fPerf = gui.addFolder('Performance');
  fPerf.add(perf, 'fps').listen().disable();
  fPerf.add(perf, 'ms').name('ms / image').listen().disable();
  fPerf.add(perf, 'bake').name('bake (ms)').listen().disable();
  fPerf.add(perf, 'drawCalls').listen().disable();
  fPerf.add(perf, 'tris').name('triangles').listen().disable();
  fPerf.add(quality, 'auto').name('qualité auto');
  fPerf.add(quality, 'level', 0, QualityLevels.length - 1, 1).name('niveau').listen().onChange((v: number) => { quality.auto = false; quality.set(v); });
  fPerf.add(perf, 'qualité').listen().disable();
  setInterval(() => {
    perf.fps = quality.fps.toFixed(0);
    perf.ms = quality.frameMs.toFixed(1);
    perf.bake = scene.bakeMs.toFixed(0);
    const i = scene.info();
    perf.drawCalls = i.render.calls; perf.tris = i.render.triangles;
    perf.qualité = QualityLevels[quality.level].name;
  }, 500);

  const fL = gui.addFolder('Couches');
  fL.add(Layers, 'bake').name('éclairage cuit').onChange(rebuild);
  fL.add(Layers, 'atmosphere').name('brume + poussière');
  fL.add(Layers, 'orbFx').name('fresnel + traînée');
  fL.add(Layers, 'particles').name('particules');
  fL.add(Layers, 'juice').name('juice (shake…)');

  const fB = gui.addFolder('Bloom');
  fB.add(s, 'bloom').onChange(apply);
  fB.add(s, 'bloomIntensity', 0, 4, 0.01).name('intensité').onChange(apply);
  fB.add(s, 'bloomThreshold', 0.5, 3, 0.01).name('seuil HDR').onChange(apply);
  fB.add(s, 'bloomSmoothing', 0, 1, 0.01).name('douceur').onChange(apply);
  fB.add(s, 'bloomRadius', 0, 1, 0.01).name('rayon').onChange(apply);
  fB.add(s, 'bloomScale', 0.2, 1, 0.01).name('résolution').onChange(apply);

  const fD = gui.addFolder('Tilt-shift');
  fD.add(s, 'dof').onChange(apply);
  fD.add(s, 'dofFocus', 0.1, 1, 0.01).name('zone nette').onChange(apply);
  fD.add(s, 'dofFeather', 0, 1, 0.01).name('fondu').onChange(apply);
  fD.add(s, 'dofOffset', -0.5, 0.5, 0.01).name('décalage').onChange(apply);
  fD.add(s, 'dofScale', 0.2, 1, 0.01).name('résolution').onChange(apply);

  const fC = gui.addFolder('Image');
  fC.add(s, 'aces').name('ACES filmic').onChange(apply);
  fC.add(s, 'exposure', 0.3, 2.5, 0.01).name('exposition').onChange(apply);
  fC.add(s, 'grade').name('étalonnage').onChange(apply);
  fC.add(s, 'warm', 0, 2, 0.01).name('chaleur').onChange(apply);
  fC.add(s, 'sat', 0, 2, 0.01).name('saturation').onChange(apply);
  fC.add(s, 'vignette', 0, 1, 0.01).onChange(apply);
  fC.add(s, 'grain', 0, 0.3, 0.005).onChange(apply);

  const fO = gui.addFolder('Lumières');
  fO.add(Shared.uOrbI, 'value', 0, 8, 0.01).name('lumière orbe');
  fO.add(Shared.uOrbRange, 'value', 1, 10, 0.1).name('portée orbe');
  fO.add(Shared.uGlowGain, 'value', 0, 8, 0.01).name('lueur braseros');
  fO.add(Shared.uEmitI, 'value', 0, 3, 0.01).name('cristaux');
  fO.add(scene.orb.mat.uniforms.uCoreI, 'value', 0, 10, 0.01).name('cœur orbe');
  fO.add(scene.orb.mat.uniforms.uRimI, 'value', 0, 20, 0.01).name('rim fresnel');
  fO.add(Shared.uFogTop, 'value', -4, 1, 0.01).name('brume début');
  fO.add(Shared.uFogBottom, 'value', -12, -2, 0.01).name('brume fin');

  const fP = gui.addFolder('Physique');
  fP.add(Tune, 'maxSpeed', 1, 8, 0.1).name('vitesse max');
  fP.add(Tune, 'accelGround', 2, 30, 0.1).name('accél. sol');
  fP.add(Tune, 'accelAir', 0, 20, 0.1).name('accél. air');
  fP.add(Tune, 'dampIdle', 0, 8, 0.1).name('freinage');
  fP.add(Tune, 'jumpSpeed', 2, 9, 0.1).name('saut');
  fP.add(Tune, 'gravity', 5, 40, 0.1).name('gravité');
  fP.add(Tune, 'coyote', 0, 0.3, 0.01).name('coyote time');
  fP.add(Tune, 'jumpBuffer', 0, 0.3, 0.01).name('tampon saut');

  const nav = { île: 1, aller: () => goto(nav.île) };
  const fN = gui.addFolder('Île');
  fN.add(nav, 'île', 1, 200, 1);
  fN.add(nav, 'aller');
  [fB, fD, fC, fO, fP, fN].forEach(f => f.close());
  return gui;
}
