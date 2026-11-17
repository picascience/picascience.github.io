// Textures procédurales (canvas) : albedo, normal maps tuilables. Aucun fichier image à charger.
import * as THREE from 'three';

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

// Hauteur -> normal map (différences finies, bords repliés pour rester tuilable)
function heightToNormal(h, size, strength) {
  const [c, ctx] = canvas(size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
    const u = h[((y - 1 + size) % size) * size + x], d = h[((y + 1) % size) * size + x];
    let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz);
    const o = (y * size + x) * 4;
    img.data[o] = (nx / len * 0.5 + 0.5) * 255;
    img.data[o + 1] = (ny / len * 0.5 + 0.5) * 255;
    img.data[o + 2] = (nz / len * 0.5 + 0.5) * 255;
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function tex(c, repeat = 1, srgb = false) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Bruit périodique (somme de sinus à fréquences entières) => tuilable
function periodic(x, y, seed, oct = 4) {
  let s = 0, a = 1, f = 1;
  for (let o = 0; o < oct; o++) {
    const ph = seed * 13.7 + o * 3.1;
    s += a * Math.sin((x * f + Math.sin(y * f * 2 + ph) * 0.35) * Math.PI * 2 + ph)
       * Math.cos((y * f + Math.cos(x * f * 3 + ph) * 0.25) * Math.PI * 2 - ph * 0.7);
    a *= 0.5; f *= 2;
  }
  return s;
}

export function sandNormal() {
  const S = 256, h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    const warp = periodic(u, v, 1, 3) * 0.08;
    const ripple = Math.sin((v * 9 + u * 2 + warp) * Math.PI * 2) * 0.5 + 0.5;
    h[y * S + x] = Math.pow(ripple, 1.6) + periodic(u * 2, v * 2, 7, 3) * 0.15 + (Math.random() - 0.5) * 0.18;
  }
  return tex(heightToNormal(h, S, 2.2), 14);
}

export function waterNormal() {
  const S = 256, h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    h[y * S + x] = periodic(u * 2, v * 2, 3, 4) + periodic(u * 3, v * 3, 9, 3) * 0.5;
  }
  return tex(heightToNormal(h, S, 3.0), 1);
}

// Pierre de taille : assises décalées + joints
export function stoneMaps() {
  const S = 256, h = new Float32Array(S * S);
  const [c, ctx] = canvas(S);
  const img = ctx.createImageData(S, S);
  const rowH = 32, blockW = 64;
  const blockShade = [];
  for (let k = 0; k < 64; k++) blockShade.push(0.86 + Math.random() * 0.2);
  for (let y = 0; y < S; y++) {
    const row = Math.floor(y / rowH);
    const off = (row % 2) * blockW / 2;
    for (let x = 0; x < S; x++) {
      const xx = (x + off) % S;
      const col = Math.floor(xx / blockW);
      const ly = y % rowH, lx = xx % blockW;
      const edge = Math.min(ly, rowH - 1 - ly, lx, blockW - 1 - lx);
      const mortar = edge < 2 ? 1 : 0;
      const grain = periodic(x / S * 4, y / S * 4, 5, 3) * 0.06 + (Math.random() - 0.5) * 0.08;
      const bevel = Math.min(1, edge / 5);
      h[y * S + x] = mortar ? 0 : 0.6 + bevel * 0.4 + grain;
      const shade = mortar ? 0.62 : blockShade[(row * 7 + col) % 64] + grain;
      const o = (y * S + x) * 4;
      img.data[o] = 236 * shade; img.data[o + 1] = 196 * shade; img.data[o + 2] = 150 * shade; img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { map: tex(c, 1, true), normalMap: tex(heightToNormal(h, S, 3.5), 1) };
}

// Mosaïque géométrique : étoiles à 8 branches, turquoise / bleu nuit / or
export function mosaicMap() {
  const S = 256;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#123a5a'; ctx.fillRect(0, 0, S, S);
  const cell = S / 2;
  function star(cx, cy, r, fill, stroke) {
    ctx.beginPath();
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2 + Math.PI / 8;
      const rr = k % 2 === 0 ? r : r * 0.62;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = stroke; ctx.stroke();
  }
  for (let y = 0; y <= 2; y++) for (let x = 0; x <= 2; x++) {
    star(x * cell, y * cell, cell * 0.46, '#26b5ad', '#f4ead6');
    star(x * cell, y * cell, cell * 0.18, '#e7b54a', '#f4ead6');
  }
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    const cx = x * cell + cell / 2, cy = y * cell + cell / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#1d6f8f'; ctx.fillRect(-cell * 0.16, -cell * 0.16, cell * 0.32, cell * 0.32);
    ctx.lineWidth = 4; ctx.strokeStyle = '#f4ead6'; ctx.strokeRect(-cell * 0.16, -cell * 0.16, cell * 0.32, cell * 0.32);
    ctx.restore();
  }
  // micro-variations des tesselles
  const img = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 0.92 + Math.random() * 0.1;
    img.data[i] *= v; img.data[i + 1] *= v; img.data[i + 2] *= v;
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, 1, true);
}

export function fabricMap() {
  const [c, ctx] = canvas(64);
  for (let x = 0; x < 64; x += 16) {
    ctx.fillStyle = '#c4553a'; ctx.fillRect(x, 0, 8, 64);
    ctx.fillStyle = '#f1dfc0'; ctx.fillRect(x + 8, 0, 8, 64);
  }
  return tex(c, 1, true);
}

// Texture ronde douce pour particules et halos
export function softDot() {
  const [c, ctx] = canvas(64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

// Contour de case (curseur)
export function tileRing() {
  const [c, ctx] = canvas(128);
  ctx.strokeStyle = 'white'; ctx.lineWidth = 10;
  const r = 22, s = 10, e = 118;
  ctx.beginPath();
  ctx.moveTo(s + r, s); ctx.lineTo(e - r, s); ctx.quadraticCurveTo(e, s, e, s + r);
  ctx.lineTo(e, e - r); ctx.quadraticCurveTo(e, e, e - r, e);
  ctx.lineTo(s + r, e); ctx.quadraticCurveTo(s, e, s, e - r);
  ctx.lineTo(s, s + r); ctx.quadraticCurveTo(s, s, s + r, s);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
  return new THREE.CanvasTexture(c);
}
