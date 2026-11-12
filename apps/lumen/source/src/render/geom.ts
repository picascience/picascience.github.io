// Constructeur de géométrie low-poly : on empile des quads/triangles (positions, normales, couleurs)
// puis on produit UNE BufferGeometry fusionnée par île (un seul draw call pour tout le décor statique).
// Chaque face a ses propres sommets (normales plates = look low-poly), ce qui permet aussi
// de cuire l'éclairage par sommet.

import * as THREE from 'three';

export class GeoBuilder {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  emit: number[] = [];   // intensité émissive (veines de cristal)
  index: number[] = [];
  emitVal = 0;

  get vertexCount() { return this.pos.length / 3; }

  private vtx(x: number, y: number, z: number, nx: number, ny: number, nz: number, c: THREE.Color) {
    this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.col.push(c.r, c.g, c.b); this.emit.push(this.emitVal);
  }

  /** Quad p0→p1→p2→p3 (sens anti-horaire vu depuis l'extérieur). */
  quad(
    x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number, x3: number, y3: number, z3: number,
    nx: number, ny: number, nz: number, c: THREE.Color,
  ) {
    const b = this.vertexCount;
    this.vtx(x0, y0, z0, nx, ny, nz, c); this.vtx(x1, y1, z1, nx, ny, nz, c);
    this.vtx(x2, y2, z2, nx, ny, nz, c); this.vtx(x3, y3, z3, nx, ny, nz, c);
    this.index.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }

  /** Quad dont la normale est calculée (faces inclinées : chanfreins). */
  quadAuto(
    x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number, x3: number, y3: number, z3: number, c: THREE.Color,
  ) {
    const ux = x1 - x0, uy = y1 - y0, uz = z1 - z0, vx = x3 - x0, vy = y3 - y0, vz = z3 - z0;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    this.quad(x0, y0, z0, x1, y1, z1, x2, y2, z2, x3, y3, z3, nx / l, ny / l, nz / l, c);
  }

  tri(
    x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number, c: THREE.Color, faceUp = false,
  ) {
    const ux = x1 - x0, uy = y1 - y0, uz = z1 - z0, vx = x2 - x0, vy = y2 - y0, vz = z2 - z0;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (faceUp && ny < 0) { this.tri(x0, y0, z0, x2, y2, z2, x1, y1, z1, c); return; } // on retourne le triangle
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const b = this.vertexCount;
    this.vtx(x0, y0, z0, nx, ny, nz, c); this.vtx(x1, y1, z1, nx, ny, nz, c); this.vtx(x2, y2, z2, nx, ny, nz, c);
    this.index.push(b, b + 1, b + 2);
  }

  /** Boîte alignée (option : avec la face du dessous). */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: THREE.Color, bottom = false) {
    this.quad(x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0, 0, 1, 0, c);
    if (bottom) this.quad(x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, 0, -1, 0, c);
    this.quad(x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, 0, 0, 1, c);
    this.quad(x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, 0, 0, -1, c);
    this.quad(x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, 1, 0, 0, c);
    this.quad(x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, -1, 0, 0, c);
  }

  /** Prisme à n côtés (rayons r0 en bas, r1 en haut), avec ou sans couvercle. */
  prism(cx: number, cz: number, y0: number, y1: number, r0: number, r1: number, n: number, c: THREE.Color, cap = true, rot = 0, topJitter?: number[]) {
    for (let k = 0; k < n; k++) {
      const a0 = rot + (k / n) * Math.PI * 2, a1 = rot + ((k + 1) / n) * Math.PI * 2;
      const t0 = y1 + (topJitter ? topJitter[k] : 0), t1 = y1 + (topJitter ? topJitter[(k + 1) % n] : 0);
      this.quadAuto(
        cx + Math.cos(a0) * r0, y0, cz + Math.sin(a0) * r0,
        cx + Math.cos(a0) * r1, t0, cz + Math.sin(a0) * r1,
        cx + Math.cos(a1) * r1, t1, cz + Math.sin(a1) * r1,
        cx + Math.cos(a1) * r0, y0, cz + Math.sin(a1) * r0, c,
      );
    }
    if (cap) {
      let my = y1;
      if (topJitter) my += topJitter.reduce((a, b) => a + b, 0) / n;
      for (let k = 0; k < n; k++) {
        const a0 = rot + (k / n) * Math.PI * 2, a1 = rot + ((k + 1) / n) * Math.PI * 2;
        this.tri(cx, my, cz,
          cx + Math.cos(a1) * r1, y1 + (topJitter ? topJitter[(k + 1) % n] : 0), cz + Math.sin(a1) * r1,
          cx + Math.cos(a0) * r1, y1 + (topJitter ? topJitter[k] : 0), cz + Math.sin(a0) * r1, c);
      }
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aEmit', new THREE.Float32BufferAttribute(this.emit, 1));
    g.setIndex(this.index);
    g.computeBoundingSphere();
    return g;
  }
}
