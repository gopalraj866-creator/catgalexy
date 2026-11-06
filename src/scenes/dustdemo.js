// 02:09-02:30  Why infrared sees through dust. Two lanes of photons cross a dust cloud:
//  upper lane  visible light - most photons are scattered or absorbed by grains
//  lower lane  infrared      - longer wavelength slips past almost all grains
// then the absorbed energy re-emerges as a warm mid-infrared glow from the dust itself.
// Each photon's fate is fixed by a seeded random draw, so the animation is deterministic.
import * as THREE from 'three';
import { Particles } from '../simulation/particles.js';
import { CatVolume } from '../simulation/catVolume.js';
import { StarField } from '../simulation/starfield.js';
import { Rig } from '../camera/rig.js';
import { makeCamera, window01, labelAt, farKeys } from './common.js';
import { rng, smoothstep } from '../animations/ease.js';

export function create(ctx) {
  const cam = makeCamera(ctx, 38), rig = new Rig(cam);
  const S = ctx.start('dustdemo'), END = ctx.end('dustdemo'), t3 = ctx.segStart('t3'), t4 = ctx.segStart('t4'), t5 = ctx.segStart('t5');
  const r = rng(7), q = ctx.quality.particles;
  const bg = new CatVolume(ctx);
  const stars = new StarField(ctx, { count: ctx.quality.stars >> 1, spikeCount: 6, rMin: 80, rMax: 200, seed: 4, focus: 60, aperture: 0.1 });
  const sBg = new THREE.Scene(); sBg.add(stars.group);
  const sMain = new THREE.Scene();
  const CX = 2, RX = 5.2, RY = 6.6, RZ = 3.2, L = 36, X0 = -15, SPD = 7;

  const grains = []; const NG = Math.round(1300 * q);
  for (let i = 0; i < NG; i++) { let x, y, z; do { x = (r() * 2 - 1); y = (r() * 2 - 1); z = (r() * 2 - 1); } while (x * x + y * y + z * z > 1); grains.push({ x: CX + x * RX, y: y * RY, z: z * RZ, s: 0.7 + 1.3 * r(), warm: r() }); }
  const pGrain = new Particles(ctx, NG, { additive: false }), pGlow = new Particles(ctx, NG);
  sMain.add(pGrain.points, pGlow.points);

  const NP = Math.round(70 * q), P = [];
  for (let lane = 0; lane < 2; lane++) for (let i = 0; i < NP; i++) {
    const ir = lane === 1, u = r();
    let fate = 0; // 0 pass, 1 scatter, 2 absorb
    if (!ir) fate = u < 0.55 ? 1 : u < 0.92 ? 2 : 0; else fate = u < 0.06 ? 1 : 0;
    P.push({ ir, y: (ir ? -1 : 1) * (1.2 + r() * 4.6), z: (r() - 0.5) * 3.0, off: r() * L, evx: CX - 3.8 + r() * 5.5, ang: (r() < 0.5 ? -1 : 1) * (ir ? 0.18 : 0.8 + r() * 1.5), fate, col: ir ? [1.6, 0.25, 0.1] : [[0.3, 0.7, 1.7], [0.4, 1.7, 0.7], [1.7, 1.5, 0.4]][Math.floor(r() * 3)] });
  }
  const pPh = new Particles(ctx, P.length * 4); sMain.add(pPh.points);
  const keys = { pos: [[S, [-4, 2, 30]], [S + 10, [6, 4, 27]], [END, [2, 2, 29]]], look: [[S, [1, 0, 0]], [S + 10, [3, 0, 0]], [END, [2, 0, 0]]], fov: [[S, ctx.portrait ? 54 : 38]] };

  return {
    draw(T) {
      const rd = ctx.renderer, p = ctx.post.params;
      rig.apply(farKeys(ctx, keys, 1.4), T);
      const warm = smoothstep(t4 - 0.5, t4 + 3.5, T);
      bg.update(cam, T, { mode: 0, gas: 0.42, gasSeed: 2.0 }); bg.drawGas(rd, cam);
      stars.update(T, { spike: 1, gain: 0.6, focus: 80 }); rd.render(sBg, cam);
      for (let i = 0; i < NG; i++) {
        const g = grains[i];
        pGrain.set(i, g.x, g.y, g.z, 0.04, 0.025, 0.02, 0.35 * (1 - 0.5 * warm), g.s);
        pGlow.set(i, g.x, g.y, g.z, 1.2, 0.42, 0.24, warm * (0.1 + 0.14 * g.warm) * (0.7 + 0.3 * Math.sin(T * 1.2 + g.warm * 30)), g.s * 0.9);
      }
      pGrain.commit(cam); pGlow.commit(cam);
      let k = 0;
      for (const o of P) {
        const s = ((T * SPD + o.off) % L + L) % L, x = X0 + s, c = o.col;
        let px = x, py = o.y, pz = o.z, a = 1, flash = 0;
        if (o.fate === 2 && x > o.evx) { px = o.evx; flash = Math.max(0, 1 - (x - o.evx) / 1.4); a = flash; }
        else if (o.fate === 1 && x > o.evx) { const d = x - o.evx; px = o.evx + Math.cos(o.ang) * d; py = o.y + Math.sin(o.ang) * d; pz = o.z + Math.sin(o.ang * 0.7) * d * 0.3; a = Math.max(0, 1 - d / 9); }
        const fadeIn = smoothstep(0, 2.5, s) * (1 - smoothstep(L - 4, L, s));
        for (let t = 0; t < 3; t++) {
          const back = t * 0.35, bx = o.fate === 1 && x > o.evx ? px - Math.cos(o.ang) * back : px - back, by = o.fate === 1 && x > o.evx ? py - Math.sin(o.ang) * back : py;
          pPh.set(k++, bx, by, pz, c[0], c[1], c[2], a * fadeIn * (t === 0 ? 0.95 : t === 1 ? 0.5 : 0.22), o.ir ? 0.55 : 0.3);
        }
        pPh.set(k++, o.evx, o.y, o.z, 2.0, 1.1, 0.5, flash * flash * 0.9 * fadeIn, 1.2);
      }
      pPh.commit(cam);
      rd.render(sMain, cam);
      p.exposure = 1.0; p.bloom1 = 0.7; p.bloom2 = 0.5; p.vignette = 0.55;

      const it = [], lab = (v, text, a0, a1, sub, dx, dy) => { const l = labelAt(cam, v, text, window01(T, a0, a1, 0.6, 0.6), { sub, dx, dy }); if (l) it.push(l); };
      lab([-9, 4.2, 0], 'Visible light', S + 0.8, t4 + 8, 'Scattered or absorbed by dust grains', 5, -5);
      lab([-9, -4.2, 0], 'Infrared', t3 + 1.5, t4 + 8, 'Longer wavelength · mostly passes through', 5, 5);
      lab([CX, 0, 0], 'Dust cloud', S + 3, t3 + 1, '', 0, -9);
      lab([CX, 3, 0], 'Dust glows with absorbed heat', t4 + 4, t5 - 0.2, 'This is what mid-infrared sees', 6, -8);
      it.push({ kind: 'tag', text: 'Conceptual illustration', a: 0.85 });
      return it;
    },
  };
}
