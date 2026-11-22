/* Orbite — moteur physique partagé (jeu + solveur Node).
   Monde fixe 1000 x 1800 unités, pas fixe 1/120 s, intégration Verlet (vitesse). */
(function (root) {
  'use strict';
  var W = 1000, H = 1800, DT = 1 / 120, TMAX = 12, PR = 9, MARGIN = 110;
  var VMIN = 160, VMAX = 960;
  var CRYSTAL_R = 26, TARGET_R = 40, TP_R = 30;

  function moverPos(base, mv, t, out) {
    // mv : {ax, ay, w, ph}  oscillation elliptique / linéaire autour de base
    if (!mv) { out[0] = base[0]; out[1] = base[1]; return out; }
    var a = mv.w * t + (mv.ph || 0);
    out[0] = base[0] + (mv.ax || 0) * Math.cos(a);
    out[1] = base[1] + (mv.ay || 0) * Math.sin(a);
    return out;
  }

  // Compile un niveau en structure plate rapide
  function compile(L) {
    var bodies = []; // {x,y,r,mu,kind, moon:{p,d,w,ph}}
    (L.P || []).forEach(function (p) {
      bodies.push({ x: p.x, y: p.y, r: p.r, mu: (p.m || 0) * 1e6 * (p.k === 'rep' ? -1 : 1), kind: p.k || 'p', src: p, cx: p.x, cy: p.y });
    });
    (L.moons || []).forEach(function (m) {
      var par = L.P[m.p];
      bodies.push({ x: 0, y: 0, r: m.r, mu: (m.m || 0) * 1e6, kind: 'moon', src: m, moon: { cx: par.x, cy: par.y, d: m.d, w: m.w, ph: m.ph || 0 } });
    });
    return {
      L: L, bodies: bodies,
      ast: (L.ast || []).map(function (a) { return { b: [a.x, a.y], r: a.r, mv: a.mv || null, src: a }; }),
      belts: L.belts || [],
      fields: L.fields || [],
      tp: L.tp || [],
      cr: L.cr || [],
      tg: { b: [L.tg.x, L.tg.y], mv: L.tg.mv || null, r: L.tg.r || TARGET_R },
      st: L.st
    };
  }

  function placeBodies(C, t) {
    var bs = C.bodies;
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i];
      if (b.moon) {
        var a = b.moon.w * t + b.moon.ph;
        b.x = b.moon.cx + b.moon.d * Math.cos(a);
        b.y = b.moon.cy + b.moon.d * Math.sin(a);
      }
    }
  }

  function acc(C, x, y, t, out) {
    placeBodies(C, t);
    var ax = 0, ay = 0, bs = C.bodies;
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i];
      if (!b.mu) continue;
      var dx = b.x - x, dy = b.y - y;
      var d2 = dx * dx + dy * dy;
      var rr = b.r * b.r * 0.5; if (d2 < rr) d2 = rr;
      var inv = b.mu / (d2 * Math.sqrt(d2));
      ax += dx * inv; ay += dy * inv;
    }
    var fs = C.fields;
    for (var j = 0; j < fs.length; j++) {
      var f = fs[j];
      if (x > f.x && x < f.x + f.w && y > f.y && y < f.y + f.h) { ax += f.ax; ay += f.ay; }
    }
    out[0] = ax; out[1] = ay;
    return out;
  }

  function segDist2(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var l2 = dx * dx + dy * dy;
    var t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    var qx = x1 + t * dx - px, qy = y1 + t * dy - py;
    return qx * qx + qy * qy;
  }

  // Un vol : état pas à pas, utilisé à l'identique par le jeu et le solveur
  function Run(C, angle, power) {
    this.C = C;
    this.x = C.st[0]; this.y = C.st[1];
    this.vx = Math.cos(angle) * power; this.vy = Math.sin(angle) * power;
    this.n = 0; this.t = 0;
    this.a = acc(C, this.x, this.y, 0, [0, 0]);
    this.mask = 0;
    this.tpLock = -1;
    this.done = null; // 'win' | 'crash' | 'out' | 'time'
    this.hit = null;
    this._a1 = [0, 0]; this._p = [0, 0];
  }
  Run.prototype.step = function () {
    if (this.done) return this.done;
    var C = this.C, dt = DT, a0 = this.a;
    var nx = this.x + this.vx * dt + 0.5 * a0[0] * dt * dt;
    var ny = this.y + this.vy * dt + 0.5 * a0[1] * dt * dt;
    this.n++;
    var t = this.n * dt; this.t = t;
    var a1 = acc(C, nx, ny, t, this._a1);
    this.vx += 0.5 * (a0[0] + a1[0]) * dt;
    this.vy += 0.5 * (a0[1] + a1[1]) * dt;
    this.x = nx; this.y = ny;
    var tmp = this.a; this.a = a1; this._a1 = tmp;
    var x = nx, y = ny, i, dx, dy;
    this.ev = null;
    // corps (planètes, lunes, trous noirs) — positions déjà placées pour t
    var bs = C.bodies;
    for (i = 0; i < bs.length; i++) {
      var b = bs[i]; dx = b.x - x; dy = b.y - y;
      var rr = b.r + PR;
      if (dx * dx + dy * dy < rr * rr) { this.done = 'crash'; this.hit = b; return this.done; }
    }
    var p = this._p;
    for (i = 0; i < C.ast.length; i++) {
      var as = C.ast[i]; moverPos(as.b, as.mv, t, p);
      dx = p[0] - x; dy = p[1] - y; var ra = as.r + PR;
      if (dx * dx + dy * dy < ra * ra) { this.done = 'crash'; this.hit = as; return this.done; }
    }
    for (i = 0; i < C.belts.length; i++) {
      var s = C.belts[i], th = s[4] * 0.5 + PR;
      if (segDist2(x, y, s[0], s[1], s[2], s[3]) < th * th) { this.done = 'crash'; this.hit = s; return this.done; }
    }
    for (i = 0; i < C.cr.length; i++) {
      if (this.mask & (1 << i)) continue;
      dx = C.cr[i][0] - x; dy = C.cr[i][1] - y;
      if (dx * dx + dy * dy < CRYSTAL_R * CRYSTAL_R) { this.mask |= 1 << i; this.ev = { type: 'crystal', i: i }; }
    }
    // portails de téléportation (paires bidirectionnelles)
    for (i = 0; i < C.tp.length; i++) {
      var q = C.tp[i];
      var da = (q.a[0] - x) * (q.a[0] - x) + (q.a[1] - y) * (q.a[1] - y);
      var db = (q.b[0] - x) * (q.b[0] - x) + (q.b[1] - y) * (q.b[1] - y);
      if (this.tpLock === i) {
        if (da > (TP_R + 14) * (TP_R + 14) && db > (TP_R + 14) * (TP_R + 14)) this.tpLock = -1;
        continue;
      }
      var from = null, to = null;
      if (da < TP_R * TP_R) { from = q.a; to = q.b; } else if (db < TP_R * TP_R) { from = q.b; to = q.a; }
      if (to) {
        this.x = to[0] + (x - from[0]); this.y = to[1] + (y - from[1]);
        this.tpLock = i;
        this.a = acc(C, this.x, this.y, t, [0, 0]);
        this.ev = { type: 'tp', i: i, fx: x, fy: y };
        x = this.x; y = this.y;
        break;
      }
    }
    moverPos(C.tg.b, C.tg.mv, t, p);
    dx = p[0] - x; dy = p[1] - y;
    if (dx * dx + dy * dy < C.tg.r * C.tg.r) { this.done = 'win'; return this.done; }
    if (x < -MARGIN || x > W + MARGIN || y < -MARGIN || y > H + MARGIN) { this.done = 'out'; return this.done; }
    if (t >= TMAX) { this.done = 'time'; return this.done; }
    return null;
  };

  function simulate(C, angle, power, maxSteps) {
    var r = new Run(C, angle, power), lim = maxSteps || 1e9;
    while (!r.done && r.n < lim) r.step();
    return r;
  }

  var api = {
    W: W, H: H, DT: DT, TMAX: TMAX, PR: PR, MARGIN: MARGIN, VMIN: VMIN, VMAX: VMAX,
    CRYSTAL_R: CRYSTAL_R, TARGET_R: TARGET_R, TP_R: TP_R,
    compile: compile, Run: Run, simulate: simulate, moverPos: moverPos, placeBodies: placeBodies, acc: acc
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OrbCore = api;
})(this);
