// 04:30-05:38  Zooming in on the "eye" and on the other mysterious features.
//  1. Fly in to the eye of the illustrative pillar (near-infrared look)
//  2. Cut-away concept of an embedded infant star: dust cocoon, accretion disk, bipolar outflow
//  3. The second bright source with a filament crossing over it (connected? the image alone cannot say)
//  4. The faint jet-like feature near the cat's belly: origin uncertain
// Everything past step 1 is a CONCEPT drawing of what astronomers think a young embedded star may look like,
// not a measurement of this particular object. Labels say so.
import * as THREE from 'three';
import { CatVolume } from '../simulation/catVolume.js';
import { Particles, starSprite } from '../simulation/particles.js';
import { StarField } from '../simulation/starfield.js';
import { Rig } from '../camera/rig.js';
import { rigSpec, makeCamera, window01, labelAt, farKeys } from './common.js';
import { rng, smoothstep, clamp } from '../animations/ease.js';

export function create(ctx) {
  const cam = makeCamera(ctx, 36), rig = new Rig(cam);
  const S = ctx.start('eye'), J = ctx.start('jet'), END = ctx.end('jet');
  const d2 = ctx.segStart('d2'), d3 = ctx.segStart('d3'), d4 = ctx.segStart('d4'), d6 = ctx.segStart('d6');
  const SW = d2 + 0.2;                                      // switch from pillar view to the concept model
  const r = rng(99), q = ctx.quality.particles;
  const vol = new CatVolume(ctx);
  const stars = new StarField(ctx, { count: ctx.quality.stars, spikeCount: 10, rMin: 80, rMax: 200, seed: 12, focus: 60, aperture: 0.2 });
  const sBg = new THREE.Scene(); sBg.add(stars.group);
  const sMain = new THREE.Scene();

  // star 1 (the "eye") at origin, star 2 at (9,-1.2,-1)
  const S2 = [9, -1.2, -1];
  const st1 = starSprite(ctx, sMain, [0, 0, 0], 2.4, [1.0, 0.82, 0.5], { gain: 3.0 });
  const st2 = starSprite(ctx, sMain, S2, 1.6, [1.0, 0.85, 0.5], { gain: 2.4 });

  const cocoon = (cx, cy, cz, n, rin, rout) => {
    const a = [];
    for (let i = 0; i < n; i++) { const u = r() * 2 - 1, th = r() * 6.283, s = Math.sqrt(1 - u * u), rr = rin + (rout - rin) * Math.cbrt(r()); const x = cx + Math.cos(th) * s * rr, y = cy + u * rr, z = cz + Math.sin(th) * s * rr; if (x - cx > 0.2 && z - cz > 0.2 && Math.abs(y - cy) < rout * 0.7) continue; a.push({ x, y, z, rr, sz: 0.5 + 0.8 * r(), ph: r() * 6.28 }); }
    return a;
  };
  const C1 = cocoon(0, 0, 0, Math.round(2600 * q), 1.6, 4.2), C2 = cocoon(...S2, Math.round(1100 * q), 1.0, 2.6);
  const pCD = new Particles(ctx, C1.length + C2.length, { additive: false }), pCG = new Particles(ctx, C1.length + C2.length);
  sMain.add(pCD.points, pCG.points);

  const ND = Math.round(1700 * q), D = [];
  for (let i = 0; i < ND; i++) D.push({ rad: 0.45 + 1.9 * Math.pow(r(), 0.8), a0: r() * 6.283, y: (r() - 0.5) * 0.12 });
  const pDisk = new Particles(ctx, ND); sMain.add(pDisk.points);

  const NJ = Math.round(420 * q), JT = [];
  for (let i = 0; i < NJ; i++) JT.push({ off: r(), sgn: i % 2 ? 1 : -1, ph: r() * 6.28, spread: r() });
  const pJet = new Particles(ctx, NJ); sMain.add(pJet.points);

  const NF = Math.round(420 * q), F = [];
  for (let i = 0; i < NF; i++) F.push({ u: r(), j: [(r() - 0.5) * 0.35, (r() - 0.5) * 0.35, (r() - 0.5) * 0.35], sz: 0.35 + 0.5 * r() });
  const pFil = new Particles(ctx, NF, { additive: false }), pFilG = new Particles(ctx, NF); sMain.add(pFil.points, pFilG.points);
  const filAt = (u) => { const t = 1 - u; return [t * t * 3.8 + 2 * t * u * 8 + u * u * 12.2, t * t * 3.2 + 2 * t * u * 1.2 + u * u * -3.6, 2.2 + Math.sin(u * 3.1) * 0.4]; };

  const view0 = rigSpec(ctx, [[S, { cy: 0, fill: 0.7, az: 18, el: 4, shift: 1.0 }], [S + 5, { cx: 0.55, cy: 1.1, w: 1.4, h: 1.2, fill: 0.7, az: 8, el: 2 }], [SW, { cx: 0.6, cy: 1.12, w: 0.38, h: 0.34, fill: 0.7, az: 2, el: 1 }]], { shake: 0.004 });
  const model = {
    pos: [[SW, [3, 2.5, 13]], [d3 - 1, [4.5, 3.2, 12]], [d3 + 5, [11.5, 2.4, 9.5]], [d4 + 1, [8, 4.5, 17]], [d4 + 15, [5, 3.5, 20]], [J, [-8, 4, 13]], [J + 7, [-12, 0.6, 12]], [d6, [-10, -3, 16]], [END, [-4, -2, 22]]],
    look: [[SW, [0, 0, 0]], [d3 - 1, [1, 0, 0]], [d3 + 5, [9, -1.2, -1]], [d4 + 1, [6, 0, 0]], [d4 + 15, [4.5, 0, 0]], [J, [0, 0.5, 0]], [J + 7, [0, 1.5, 0]], [d6, [1, 0, 0]], [END, [3, 0, 0]]],
    fov: [[SW, ctx.portrait ? 48 : 36]],
  };

  return {
    draw(T) {
      const rd = ctx.renderer, p = ctx.post.params;
      const pillar = T < SW + 0.3;
      if (pillar) {
        rig.apply(view0, T);
        const ey = vol.eyeFromCat([0, 0, 0, 1]);
        vol.update(cam, T, { mode: 1, light: 1, ambient: 1.0, eyeGlow: 1.2 + 1.6 * smoothstep(S + 3, SW, T), eyeSize: 0.09, gas: 1.0, cat: [0, 0, 0, 1], eyePos: ey, steps: ctx.quality.steps, seed: 0.37 });
        stars.update(T, { spike: 1, gain: 1.1, focus: 11 });
        vol.drawGas(rd, cam); rd.render(sBg, cam); vol.drawVolume(rd, cam);
        p.exposure = 1.05; p.bloom1 = 0.7; p.bloom2 = 0.55; p.vignette = 0.5;
        const f = smoothstep(SW - 0.9, SW + 0.1, T);
        p.fade = f; p.fadeColor = [1, 0.9, 0.75];
        return [
          { kind: 'lower', title: 'The “eye”', sub: 'Webb NIRCam · near-infrared', a: window01(T, S + 1.2, SW - 1, 0.8, 0.5) },
          { kind: 'tag', text: 'Illustrative 3-D visualisation', a: 0.85 },
        ];
      }
      rig.apply(farKeys(ctx, model, 1.5), T);
      const tm = T - SW;
      const jet = 0.28 + 0.72 * smoothstep(J - 1, J + 2.5, T), s2on = smoothstep(d3 - 2.5, d3 - 0.5, T);
      stars.update(T, { spike: 1, gain: 0.8, focus: 80 });
      vol.update(cam, T, { mode: 1, gas: 0.32, gasSeed: 9.0 }); vol.drawGas(rd, cam); rd.render(sBg, cam);
      const nC1 = C1.length;
      const cocoonIn = smoothstep(SW, SW + 2, T);
      for (let i = 0; i < C1.length + C2.length; i++) {
        const o = i < nC1 ? C1[i] : C2[i - nC1], on = (i < nC1 ? 1 : s2on) * cocoonIn, cx = i < nC1 ? 0 : S2[0], cy = i < nC1 ? 0 : S2[1], cz = i < nC1 ? 0 : S2[2];
        const glow = Math.exp(-(o.rr * o.rr) / (i < nC1 ? 7 : 2.2));
        pCD.set(i, o.x, o.y, o.z, 0.04, 0.025, 0.018, 0.30 * on, o.sz);
        pCG.set(i, o.x, o.y, o.z, 1.2, 0.55, 0.24, (0.06 + 0.22 * glow) * on * (0.8 + 0.2 * Math.sin(T * 0.9 + o.ph)), o.sz * 0.95);
      }
      pCD.commit(cam); pCG.commit(cam);
      for (let i = 0; i < ND; i++) { const o = D[i], w = 1.4 / Math.pow(o.rad, 1.5), a = o.a0 + T * w, x = Math.cos(a) * o.rad, z = Math.sin(a) * o.rad; const tilt = 0.42; pDisk.set(i, x, o.y + z * Math.sin(tilt) * 0.55, z * Math.cos(tilt), 1.5, 0.75 - 0.2 * o.rad / 2.4, 0.3, cocoonIn * (0.42 - 0.12 * o.rad / 2.4), 0.12); }
      pDisk.commit(cam);
      for (let i = 0; i < NJ; i++) {
        const o = JT[i], s = ((T * 0.11 + o.off) % 1 + 1) % 1, len = 9 * s, wd = 0.06 + 0.32 * s * (0.4 + 0.6 * o.spread), ang = o.ph + T * 0.8;
        const knot = 0.55 + 0.45 * Math.sin(len * 2.3 - T * 3);
        const col = s < 0.5 ? [0.7, 0.9, 1.6] : [1.6, 0.55, 0.3];
        pJet.set(i, Math.cos(ang) * wd * 0.6 + len * 0.18 * o.sgn * 0.0, o.sgn * (0.5 + len), Math.sin(ang) * wd * 0.6, col[0], col[1], col[2], jet * knot * (1 - s) * 0.8 * cocoonIn, 0.16 + 0.1 * s);
      }
      pJet.commit(cam);
      const fa = smoothstep(d4 - 4, d4 - 1, T) * (1 - smoothstep(J - 2, J, T));
      for (let i = 0; i < NF; i++) { const o = F[i], v = filAt(o.u); pFil.set(i, v[0] + o.j[0], v[1] + o.j[1], v[2] + o.j[2], 0.03, 0.02, 0.015, 0.5 * fa, o.sz); pFilG.set(i, v[0] + o.j[0] * 0.8, v[1] + o.j[1] * 0.8 + 0.1, v[2] + o.j[2], 1.0, 0.5, 0.45, 0.07 * fa, o.sz); }
      pFil.commit(cam); pFilG.commit(cam);
      const pulse = 1 + 0.07 * Math.sin(T * 2.6);
      st1.setGain(3.0 * pulse * cocoonIn); st1.setScale(0.9 + 0.1 * pulse); st2.setGain(2.4 * s2on * pulse); st2.setScale(0.9);
      rd.render(sMain, cam);
      p.exposure = 1.0; p.bloom1 = 0.75; p.bloom2 = 0.6; p.vignette = 0.55;
      p.fade = 1 - smoothstep(SW, SW + 1.4, T); p.fadeColor = [1, 0.9, 0.75];

      const it = [], lab = (v, text, a0, a1, sub, dx, dy) => { const l = labelAt(cam, v, text, window01(T, a0, a1, 0.6, 0.6), { sub, dx, dy }); if (l) it.push(l); };
      lab([0, 0, 0], 'Infant star', SW + 2.5, d3 - 1, 'Hidden in a dust cocoon', 7, -8);
      lab([1.4, 0.4, 0], 'Accretion disk', SW + 9, d3 - 1, 'Gas spiralling in as the star grows', 7, 8);
      lab(S2, 'Another bright source', d3, d4 - 0.5, 'Likely an infant star, embedded in dust', 6, -8);
      lab(filAt(0.5), 'Filament', d4 + 0.3, J - 1, 'Connected to the star? Unknown', 6, -7);
      lab([0, 7.5, 0], 'Possible outflow', J + 1, d6 - 0.5, 'Jet-like feature · origin uncertain', 7, -4);
      const qa = (txt, a0, y) => it.push({ kind: 'stat', x: ctx.portrait ? 6 : 6.5, y, text: txt, size: ctx.portrait ? 3.2 : 2.3, sub: '', a: window01(T, a0, END - 0.6, 0.9, 0.8) });
      const yy = ctx.portrait ? 26 : 22;
      if (T > d6) { it.push({ kind: 'stat', x: ctx.portrait ? 6 : 6.5, y: yy - (ctx.portrait ? 6 : 6), text: 'Open questions', size: ctx.portrait ? 2.6 : 1.7, sub: '', a: window01(T, d6 + 5.5, END - 0.6, 0.9, 0.8) }); qa('? Is the eye a young star', d6 + 7, yy); qa('? Are the filament and the second source linked', d6 + 9.5, yy + (ctx.portrait ? 6.5 : 6)); qa('? What is the jet-like feature', d6 + 12, yy + (ctx.portrait ? 13 : 12)); }
      it.push({ kind: 'tag', text: 'Concept drawing · not a measurement', a: 0.85 });
      return it;
    },
  };
}
