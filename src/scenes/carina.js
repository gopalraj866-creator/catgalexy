// 00:20-01:30  The Carina Nebula: a huge star-forming cloud (about 7,500 ly away, about 300 ly across).
// A cavity carved by the nebula's massive stars sits at one side; the little Cat's Head pillar is a speck on
// the dusty wall. The camera glides in to the cat, then pulls back out to show how small it is.
// Also used (mode 'outro') for the closing pull-back.
import * as THREE from 'three';
import { CatVolume } from '../simulation/catVolume.js';
import { StarField } from '../simulation/starfield.js';
import { Rig } from '../camera/rig.js';
import { rigSpec, makeCamera, window01, labelAt, CREDIT } from './common.js';
import { track, smoothstep, clamp, rng } from '../animations/ease.js';

export const PC = [5, -2, -7], CS = 0.38;              // cat position / scale inside the Carina field
const CAVITY = [-22, 8, -14];

export function createWith(ctx, kind) {
  const cam = makeCamera(ctx, 38), rig = new Rig(cam);
  const vol = new CatVolume(ctx, { field: true });
  const stars = new StarField(ctx, { count: ctx.quality.stars, spikeCount: ctx.quality.spikes, rMin: 90, rMax: 220, seed: 17, focus: 60, aperture: 0.6 });
  const sStars = new THREE.Scene(); sStars.add(stars.group);
  // the massive-star cluster inside the cavity
  const cluster = new THREE.Group(), r = rng(3);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctx.tex.glow, color: new THREE.Color(0.55, 0.72, 1.0).multiplyScalar(2.2), blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false }));
  halo.position.set(...CAVITY); halo.scale.set(26, 26, 1); cluster.add(halo);
  for (let i = 0; i < 11; i++) {
    const m = new THREE.SpriteMaterial({ map: ctx.tex.spikeW, color: new THREE.Color(0.75, 0.88, 1.0).multiplyScalar(1.6 + r() * 1.4), blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false });
    const s = new THREE.Sprite(m); const a = r() * 6.28, d = 1 + r() * 7;
    s.position.set(CAVITY[0] + Math.cos(a) * d, CAVITY[1] + (r() - 0.5) * 6, CAVITY[2] + Math.sin(a) * d); const k = 3 + r() * 5; s.scale.set(k, k, 1); cluster.add(s);
  }
  const sCluster = new THREE.Scene(); sCluster.add(cluster);

  const S = kind === 'outro' ? ctx.start('outro') : ctx.start('carina');
  const B = kind === 'outro' ? S : ctx.start('carina2'), END = kind === 'outro' ? ctx.end('outro') : ctx.end('carina2');
  const sg = (id, o = 0) => ctx.segStart(id) + o;
  const at = (o) => ({ cx: PC[0], cy: PC[1], cz: PC[2], ...o });
  const wideV = (o) => ({ cx: -4, cy: 1, cz: -6, w: 70, h: 40, fill: 0.82, ...o });
  let keys;
  if (kind === 'outro') {
    keys = [
      [S, at({ w: 2.2 * CS, h: 5.2 * CS, fill: 0.78, az: 6, el: 1, shift: 0.7 })],
      [S + 6, at({ w: 8, h: 8, fill: 0.7, az: 8, el: 4 })],
      [S + 14, wideV({ az: -10, el: 8 })],
      [END, wideV({ w: 120, h: 70, az: -20, el: 14, cy: 4 })],
    ];
  } else {
    keys = [
      [S, wideV({ az: -34, el: 14 })],
      [sg('i1', 11), wideV({ az: -20, el: 8, w: 62, h: 34 })],
      [sg('i2', 0.5), at({ w: 14, h: 12, fill: 0.7, az: 4, el: 4 })],
      [sg('i3', 0), at({ w: 2.2 * CS, h: 5.2 * CS, fill: 0.62, az: 10, el: 3, shift: 0.5 })],
      [sg('i4', 1), at({ w: 2.2 * CS, h: 5.2 * CS, fill: 0.64, az: 2, el: 1, shift: 0.5 })],
      [B + 1.5, at({ w: 2.2 * CS, h: 5.2 * CS, fill: 0.64, az: -2, el: 0, shift: 0.5 })],
      [sg('b2', 0), wideV({ az: -12, el: 8, w: 66, h: 38 })],
      [END, wideV({ az: -22, el: 12, w: 96, h: 54, cy: 3 })],
    ];
  }

  return {
    draw(T) {
      const rd = ctx.renderer, p = ctx.post.params;
      rig.apply(rigSpec(ctx, keys, { shake: 0.02 }), T);
      const closeFrac = 1 - smoothstep(2, 30, cam.position.distanceTo(new THREE.Vector3(...PC)));   // 1 when near the cat
      const eyeGlow = 0.2 + 1.0 * closeFrac;
      vol.update(cam, T, {
        mode: 0.55, light: 1.15, ambient: 1.1, gas: 0.85, steps: Math.min(72, Math.round(ctx.quality.steps * 1.1)),
        cat: [...PC, CS], eyePos: vol.eyeFromCat([...PC, CS]), eyeSize: 0.12, eyeGlow, cavity: CAVITY, bound: [0, 0, -4, 85], fieldGain: 0.011, seed: 0.61, gasSeed: 4.0,
        lightDir: [CAVITY[0] - PC[0], CAVITY[1] - PC[1], CAVITY[2] - PC[2]],
      });
      stars.update(T, { spike: 1, gain: 0.8, focus: 70 });
      vol.drawGas(rd, cam); rd.render(sStars, cam); rd.render(sCluster, cam); vol.drawVolume(rd, cam);
      p.exposure = 1.0; p.bloom1 = 0.6; p.bloom2 = 0.5; p.vignette = 0.55;

      const items = [];
      if (kind === 'outro') {
        const a = smoothstep(S + 14, S + 18, T);
        items.push({ kind: 'title', small: 'Technical Talk India', text: 'Subscribe', y: ctx.portrait ? 28 : 33, size: ctx.portrait ? 8.5 : 6.2, a });
        items.push({ kind: 'title', text: 'What do you see in this nebula?', y: ctx.portrait ? 44 : 52, size: ctx.portrait ? 4.2 : 3.0, sub: 'A cat · a ghost · something else? Tell me in the comments', a: smoothstep(S + 16, S + 19, T) });
        items.push({ kind: 'credit', text: 'Sources: NASA · ESA · CSA · STScI (Cat\'s Head Nebula release, 29 Oct 2026) · Visuals are illustrative', a: smoothstep(S + 16, S + 19, T) });
        return items;
      }
      const catP = new THREE.Vector3(PC[0], PC[1] + 0.4 * CS, PC[2]), cavP = new THREE.Vector3(...CAVITY);
      const tI1 = sg('i1');
      items.push({ kind: 'title', small: 'Hubble + Webb · 29 October 2026', text: 'The Cat’s Head Nebula', y: ctx.portrait ? 16 : 14, size: ctx.portrait ? 7 : 4.8, sub: 'Inside the Carina Nebula · about 7,500 light-years away', a: window01(T, tI1 + 1.5, tI1 + 10.5, 1.2, 1.2) });
      const lab = (v, text, a0, a1, sub, dx, dy) => { const l = labelAt(cam, v.toArray(), text, window01(T, a0, a1, 0.8, 0.8), { sub, dx, dy }); if (l) items.push(l); };
      lab(catP, 'Cat’s Head Nebula', sg('i2', 4), sg('i4', 5), 'A small dusty filament', 9, -7);
      lab(cavP, 'Massive stars', sg('b2', 0.5), END - 0.5, 'At least a dozen are 50–100× the Sun’s mass', -9, -7);
      lab(catP, 'Cat’s Head', sg('b1', 6), sg('b2', 2), 'Tiny next to the whole nebula', 9, 8);
      items.push({ kind: 'stat', x: ctx.portrait ? 8 : 6.5, y: ctx.portrait ? 22 : 70, text: '≈ 300 light-years', sub: 'Width of the Carina Nebula', a: window01(T, sg('b2', 0.2), END - 0.5, 0.9, 0.9) });
      items.push({ kind: 'tag', text: 'Illustrative 3-D visualisation', a: 0.85 });
      items.push({ kind: 'credit', text: CREDIT, a: smoothstep(S + 2, S + 4, T) });
      return items;
    },
  };
}
export function create(ctx) { return createWith(ctx, 'carina'); }
