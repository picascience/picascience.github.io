// Caméra : suivi lissé (lerp amorti), zoom qui fait varier l'inclinaison
// (vue stratégique de haut quand on dézoome, vue cinéma avec le ciel quand on zoome),
// screen shake, interpolation entre deux pas fixes.
import * as THREE from 'three';
import { damp, clamp, lerp, smooth } from '../core/loop.js';
import { HALF } from '../game/defs.js';

export const YAW = Math.PI / 4;

export class CameraRig {
  constructor(aspect) {
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.3, 1200);
    this.virtual = this.camera.clone(); // caméra "cible" pour les raycasts stables
    this.target = new THREE.Vector3(0, 0, 0);    // voulu
    this.cur = new THREE.Vector3(0, 0, 0);       // lissé
    this.dist = 34; this.curDist = 34;
    this.minDist = 12; this.maxDist = 58;
    this.shake = 0; this.shakeT = 0;
    this.prev = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
    this.next = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
    this.orbit = null; // mode menu : orbite lente
    this.yaw = YAW;
    this.compute(this.next, this.cur, this.curDist, this.yaw);
    this.prev.pos.copy(this.next.pos); this.prev.look.copy(this.next.look);
  }

  pitchFor(d) { return lerp(0.36, 0.98, smooth(this.minDist, this.maxDist, d)); } // radians

  compute(out, target, dist, yaw) {
    const p = this.pitchFor(dist);
    out.look.set(target.x, target.y + lerp(1.6, 0, smooth(12, 40, dist)), target.z);
    out.pos.set(
      target.x + Math.sin(yaw) * Math.cos(p) * dist,
      target.y + Math.sin(p) * dist,
      target.z + Math.cos(yaw) * Math.cos(p) * dist);
  }

  setAspect(a) {
    this.camera.aspect = a; this.camera.updateProjectionMatrix();
    this.virtual.aspect = a; this.virtual.updateProjectionMatrix();
  }

  addShake(a) { this.shake = Math.min(0.6, this.shake + a); }

  pan(dx, dz) { this.target.x += dx; this.target.z += dz; this.clampTarget(); }
  clampTarget() {
    const L = HALF + 2;
    this.target.x = clamp(this.target.x, -L, L);
    this.target.z = clamp(this.target.z, -L, L);
  }
  zoomTo(d) { this.dist = clamp(d, this.minDist, this.maxDist); }

  syncVirtual() {
    const o = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
    this.compute(o, this.target, this.dist, this.yaw);
    this.virtual.position.copy(o.pos);
    this.virtual.lookAt(o.look);
    this.virtual.updateMatrixWorld();
    return this.virtual;
  }

  update(dt) {
    this.prev.pos.copy(this.next.pos); this.prev.look.copy(this.next.look);
    if (this.orbit) {
      this.orbit.a += dt * 0.05;
      this.yaw = YAW + Math.sin(this.orbit.a) * 0.6;
    } else this.yaw = damp(this.yaw, YAW, 3, dt);
    this.cur.x = damp(this.cur.x, this.target.x, 7, dt);
    this.cur.z = damp(this.cur.z, this.target.z, 7, dt);
    this.curDist = damp(this.curDist, this.dist, 8, dt);
    this.compute(this.next, this.cur, this.curDist, this.yaw);
    if (this.shake > 0.001) {
      this.shakeT += dt * 38;
      const s = this.shake * this.shake;
      this.next.pos.x += Math.sin(this.shakeT * 1.1) * s;
      this.next.pos.y += Math.sin(this.shakeT * 1.7 + 1) * s * 0.6;
      this.next.pos.z += Math.cos(this.shakeT * 1.3) * s;
      this.shake = damp(this.shake, 0, 7, dt);
    }
  }

  // alpha : fraction du pas fixe écoulée -> rendu fluide même à 120 Hz
  apply(alpha) {
    this.camera.position.lerpVectors(this.prev.pos, this.next.pos, alpha);
    this._look = (this._look || new THREE.Vector3()).lerpVectors(this.prev.look, this.next.look, alpha);
    this.camera.lookAt(this._look);
    this.camera.updateMatrixWorld();
  }

  snap() {
    this.cur.copy(this.target); this.curDist = this.dist;
    this.compute(this.next, this.cur, this.curDist, this.yaw);
    this.prev.pos.copy(this.next.pos); this.prev.look.copy(this.next.look);
  }
}
