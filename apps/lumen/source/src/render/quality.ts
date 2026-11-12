// Qualité adaptative : si les FPS chutent, on baisse d'abord la résolution du bloom,
// puis celle du DoF, puis on coupe le DoF, et en dernier recours la résolution de rendu.
// Hystérésis : on ne remonte qu'après plusieurs secondes confortables.

import { Scene3D } from './scene';
import { Clock } from '../core/clock';

interface Level { name: string; bloomScale: number; dofScale: number; dof: boolean; dpr: number }

export const QualityLevels: Level[] = [
  { name: 'max', bloomScale: 0.5, dofScale: 0.5, dof: true, dpr: 1 },
  { name: 'bloom ½', bloomScale: 0.33, dofScale: 0.5, dof: true, dpr: 1 },
  { name: 'dof ½', bloomScale: 0.33, dofScale: 0.33, dof: true, dpr: 1 },
  { name: 'sans dof', bloomScale: 0.33, dofScale: 0.33, dof: false, dpr: 1 },
  { name: 'rés. 85 %', bloomScale: 0.33, dofScale: 0.33, dof: false, dpr: 0.85 },
  { name: 'rés. 70 %', bloomScale: 0.25, dofScale: 0.33, dof: false, dpr: 0.7 },
];

export class Quality {
  level = 0;
  auto = true;
  fps = 60;
  frameMs = 16.7;
  private acc = 0; private frames = 0;
  private goodWindows = 0;
  private cooldown = 0;
  private baseDpr = Math.min(2, window.devicePixelRatio || 1);
  onChange?: () => void;

  constructor(private scene: Scene3D) { this.apply(); }

  /** À appeler une fois par image (lit Clock.dt). */
  tick() {
    const dt = Clock.dt;
    this.acc += dt; this.frames++;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.acc < 1.5) return;
    const avg = this.acc / this.frames;
    this.fps = 1 / avg; this.frameMs = avg * 1000;
    this.acc = 0; this.frames = 0;
    if (!this.auto || document.hidden) return;
    if (this.fps < 54 && this.level < QualityLevels.length - 1 && this.cooldown === 0) {
      this.set(this.level + 1); this.goodWindows = 0; this.cooldown = 3;
    } else if (this.fps > 58.5) {
      if (++this.goodWindows >= 6 && this.level > 0 && this.cooldown === 0) { this.set(this.level - 1); this.goodWindows = 0; this.cooldown = 8; }
    } else this.goodWindows = 0;
  }

  set(l: number) { this.level = l; this.apply(); this.onChange?.(); }

  private apply() {
    const L = QualityLevels[this.level], s = this.scene.post.s;
    s.bloomScale = L.bloomScale; s.dofScale = L.dofScale; s.dof = L.dof;
    this.scene.post.apply();
    this.scene.setPixelRatio(this.baseDpr * L.dpr);
  }
}
