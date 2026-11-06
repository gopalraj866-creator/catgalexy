// Procedural textures. Nothing here is a NASA/ESA image: every texture is generated in code,
// so the project has no third-party image licences and renders identically everywhere.
import * as THREE from 'three';
import { rng } from '../animations/ease.js';

// --- Tileable 3D value-noise volume: R,G,B,A hold 4 octaves (4,8,16,32 cells per tile) -------------
export function makeNoise3D(size = 64) {
  const data = new Uint8Array(size * size * size * 4);
  const cells = [4, 8, 16, 32];
  const lattices = cells.map((c, k) => {
    const r = rng(1337 + k * 97);
    const a = new Float32Array(c * c * c);
    for (let i = 0; i < a.length; i++) a[i] = r();
    return a;
  });
  const sm = (t) => t * t * (3 - 2 * t);
  for (let k = 0; k < 4; k++) {
    const c = cells[k], L = lattices[k];
    const at = (x, y, z) => L[((z % c) * c + (y % c)) * c + (x % c)];
    for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = (x / size) * c, fy = (y / size) * c, fz = (z / size) * c;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), z0 = Math.floor(fz);
      const tx = sm(fx - x0), ty = sm(fy - y0), tz = sm(fz - z0);
      const l = (a, b, t) => a + (b - a) * t;
      const v = l(
        l(l(at(x0, y0, z0), at(x0 + 1, y0, z0), tx), l(at(x0, y0 + 1, z0), at(x0 + 1, y0 + 1, z0), tx), ty),
        l(l(at(x0, y0, z0 + 1), at(x0 + 1, y0, z0 + 1), tx), l(at(x0, y0 + 1, z0 + 1), at(x0 + 1, y0 + 1, z0 + 1), tx), ty), tz);
      data[((z * size + y) * size + x) * 4 + k] = Math.round(v * 255);
    }
  }
  const tex = new THREE.Data3DTexture(data, size, size, size);
  tex.format = THREE.RGBAFormat; tex.type = THREE.UnsignedByteType;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
  tex.unpackAlignment = 1; tex.needsUpdate = true;
  return tex;
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  return t;
}

// Soft round glow
export function glowTexture(size = 128) {
  return canvasTex(size, size, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,255,255,0.65)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

// Diffraction-spike star sprite. Hubble: 4 spikes. Webb: 6 long spikes (from the hexagonal mirror)
// plus 2 short horizontal spikes (from the support struts) = the famous 8-point pattern.
export function spikeTexture(kind = 'hubble', size = 256) {
  return canvasTex(size, size, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.translate(w / 2, h / 2);
    g.globalCompositeOperation = 'lighter';
    const spike = (ang, len, wd, a) => {
      g.save(); g.rotate(ang);
      const gr = g.createLinearGradient(0, 0, len, 0);
      gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.25, `rgba(255,255,255,${a * 0.35})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(0, -wd); g.lineTo(len, -wd * 0.12); g.lineTo(len, wd * 0.12); g.lineTo(0, wd); g.closePath(); g.fill();
      g.restore();
    };
    const R = w / 2;
    if (kind === 'hubble') { for (let k = 0; k < 4; k++) spike(k * Math.PI / 2 + Math.PI / 4 * 0, R * 0.98, 2.2, 0.9); }
    else {
      for (let k = 0; k < 6; k++) spike(Math.PI / 2 + k * Math.PI / 3, R * 0.98, 2.0, 0.9);
      for (let k = 0; k < 2; k++) spike(k * Math.PI, R * 0.55, 1.6, 0.6);
    }
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.22);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * 0.22, 0, Math.PI * 2); g.fill();
  });
}

// Crinkled-foil normal map for the Webb sunshield
export function foilNormalMap(size = 256) {
  const r = rng(77); const h = new Float32Array(size * size);
  for (let o = 0; o < 4; o++) {
    const c = 4 << o, lat = new Float32Array((c + 1) * (c + 1)); for (let i = 0; i < lat.length; i++) lat[i] = r();
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = x / size * c, fy = y / size * c, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const a = lat[y0 * (c + 1) + x0], b = lat[y0 * (c + 1) + x0 + 1], cc = lat[(y0 + 1) * (c + 1) + x0], d = lat[(y0 + 1) * (c + 1) + x0 + 1];
      h[y * size + x] += (a + (b - a) * tx + (cc - a + (a - b - cc + d) * tx) * ty) / (1 << o);
    }
  }
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const hx = h[y * size + ((x + 1) % size)] - h[y * size + ((x + size - 1) % size)];
    const hy = h[((y + 1) % size) * size + x] - h[((y + size - 1) % size) * size + x];
    const nx = -hx * 3, ny = -hy * 3, nz = 1, l = Math.hypot(nx, ny, nz);
    const i = (y * size + x) * 4; data[i] = (nx / l * 0.5 + 0.5) * 255; data[i + 1] = (ny / l * 0.5 + 0.5) * 255; data[i + 2] = (nz / l * 0.5 + 0.5) * 255; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; return t;
}

// Solar-panel grid texture
export function panelTexture() {
  const t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#0b1b3d'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,160,230,0.55)'; g.lineWidth = 2;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * w / 8, 0); g.lineTo(i * w / 8, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 8); g.lineTo(w, i * h / 8); g.stroke(); }
  });
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
