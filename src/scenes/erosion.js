// 06:30-07:40  The biggest revelation: the cat is temporary.
// UV light and stellar winds sculpted the pillar and keep eroding it. The erosion parameter sweeps the signed-distance
// surface inward from the star-facing side; denser interior resists longest. Gas flows off the lit surface TOWARD the
// radiation source (photoevaporative flow). The eye (a possible young star) brightens as the cloud is stripped.
// The time-lapse is illustrative: NASA/ESA give no erosion timescale, and neither does this video.
import * as THREE from 'three';
import { CatVolume } from '../simulation/catVolume.js';
import { Particles } from '../simulation/particles.js';
import { StarField } from '../simulation/starfield.js';
import { Rig } from '../camera/rig.js';
import { rigSpec, makeCamera, window01, labelAt } from './common.js';
import { rng, smoothstep, smootherstep } from '../animations/ease.js';

export function create(ctx) {
  const cam = makeCamera(ctx, 36), rig = new Rig(cam);
  const S = ctx.start('erosion'), M = ctx.start('erosion2'), END = ctx.end('erosion2');
  const r1 = ctx.segStart('r1'), r2 = ctx.segStart('r2'), r3 = ctx.segStart('r3'), r4 = ctx.segStart('r4'), r5 = ctx.segStart('r5'), r6 = ctx.segStart('r6'), r7 = ctx.segStart('r7'), r8 = ctx.segStart('r8');
  const r = rng(5), q = ctx.quality.particles;
  const vol = new CatVolume(ctx);
  const stars = new StarField(ctx, { count: ctx.quality.stars, spikeCount: 12, rMin: 80, rMax: 200, seed: 14, focus: 11, aperture: 0.3 });
  const sBg = new THREE.Scene(); sBg.add(stars.group);
  const L = new THREE.Vector3(0.62, 0.70, 0.35).normalize();
  const NF = Math.round(900 * q), F = [];
  for (let i = 0; i < NF; i++) F.push({ x: -0.55 + 1.3 * r(), y: -2.4 + 4.2 * r(), z: (r() - 0.5) * 0.7, off: r(), spd: 0.5 + r() * 0.8, sz: 0.04 + 0.07 * r() });
  const pF = new Particles(ctx, NF); const sF = new THREE.Scene(); sF.add(pF.points);

  const full = { cy: 0, fill: 0.80, shift: 0.9 };
  const keys = [
    [S, { ...full, az: -22, el: 2, fill: 0.74 }], [r2, { ...full, az: -12, el: 3, fill: 0.78 }], [r4, { cx: 0, cy: 0.6, w: 3, h: 3.4, fill: 0.8, az: 12, el: 6, shift: 0.5 }],
    [r5, { ...full, az: 22, el: 4, fill: 0.82 }], [r6, { cx: 0.55, cy: 1.1, w: 1.8, h: 1.6, fill: 0.78, az: 6, el: 2, shift: 0.3 }], [r8, { ...full, az: -4, el: 0, fill: 0.9 }], [END, { ...full, cy: 0.2, az: 0, el: 0, fill: 0.7 }],
  ];

  return {
    draw(T) {
      const rd = ctx.renderer, p = ctx.post.params;
      rig.apply(rigSpec(ctx, keys, { shake: 0.008 }), T);
      const E = 0.9 * smootherstep(S + 3, END - 8, T);
      const ey = vol.eyeFromCat([0, 0, 0, 1]);
      const on = smoothstep(r6 - 1, r6 + 6, T);
      vol.update(cam, T, { mode: 1.3, light: 1.15 + 0.4 * smoothstep(S, END, T), erode: E, ambient: 1.0, eyeGlow: (1.2 + 1.9 * on) * (1 + 0.06 * Math.sin(T * 2.7)), eyeSize: 0.09 + 0.05 * on, gas: 1, cat: [0, 0, 0, 1], eyePos: ey, steps: ctx.quality.steps, seed: 0.37, lightDir: [L.x, L.y, L.z] });
      stars.update(T, { spike: 1, gain: 1.0, focus: 11 });
      vol.drawGas(rd, cam); rd.render(sBg, cam); vol.drawVolume(rd, cam);
      const flow = smoothstep(S + 1, S + 4, T) * (1 - 0.35 * smoothstep(END - 20, END - 5, T));
      for (let i = 0; i < NF; i++) {
        const o = F[i], u = ((T * o.spd * 0.45 + o.off) % 1 + 1) % 1, d = 0.15 + u * 2.4;
        pF.set(i, o.x + L.x * d + (r() * 0), o.y + L.y * d, o.z + L.z * d, 1.5, 0.95, 0.5, flow * (1 - u) * 0.55 * (0.4 + E), o.sz * (1 + u * 2));
      }
      pF.commit(cam); rd.render(sF, cam);
      p.exposure = 1.05; p.bloom1 = 0.7 + 0.2 * on; p.bloom2 = 0.55; p.vignette = 0.55;
      const it = [], lab = (v, text, a0, a1, sub, dx, dy) => { const l = labelAt(cam, v, text, window01(T, a0, a1, 0.7, 0.7), { sub, dx, dy }); if (l) it.push(l); };
      it.push({ kind: 'title', text: 'It isn’t permanent', y: ctx.portrait ? 14 : 12, size: ctx.portrait ? 6.4 : 4.6, small: '', a: window01(T, r2 - 0.2, r3 + 5.5, 1.0, 1.0) });
      lab([ctx.portrait ? -0.1 : 0.55, 0.8, 0.3], 'UV light + stellar winds', r3 + 1, r4 + 1, 'Still eroding the pillar', 8, -9);
      lab([0.1, -0.5, 0], 'Dense interior', r4 + 1.5, r5 - 0.5, 'Resists erosion, for now', -7, 7);
      lab(ey, 'A young star switching on?', r6 + 2, r7 + 3, 'Inside the cloud being destroyed', 8, -8);
      it.push({ kind: 'tag', text: 'Illustrative time-lapse · real timescale unknown', a: 0.85 });
      it.push({ kind: 'credit', text: 'Concept: NASA / ESA / STScI – the Cat’s Head is a temporary scene shaped by nearby massive stars', a: smoothstep(r5, r5 + 2, T) });
      return it;
    },
  };
}
