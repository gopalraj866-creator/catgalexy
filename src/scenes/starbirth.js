// 01:21-01:57  How stars are born, and how massive stars erode their own nursery.
//  A  cold cloud collapses under gravity until a star ignites              (b3)
//  B  a massive star floods the region with UV radiation + stellar wind    (b4)
//  C  photoevaporation: thin gas is stripped first, dense clumps survive and leave pillars pointing at the star (b5, b6)
// Phase C is a simplified model: each gas parcel has a "resistance" threshold (distance from the star plus a
// shadow bonus where a dense clump lies between it and the star). An erosion front sweeps from the star outward and
// removes every parcel whose threshold it passes. Qualitative, not a hydrodynamic simulation.
import * as THREE from 'three';
import { Particles, starSprite } from '../simulation/particles.js';
import { StarField } from '../simulation/starfield.js';
import { CatVolume } from '../simulation/catVolume.js';
import { Rig } from '../camera/rig.js';
import { makeCamera, window01, labelAt, farKeys, CREDIT } from './common.js';
import { rng, smoothstep, smootherstep } from '../animations/ease.js';

export function create(ctx) {
  const cam = makeCamera(ctx, 40), rig = new Rig(cam), q = ctx.quality.particles;
  const t3 = ctx.segStart('b3'), t4 = ctx.segStart('b4'), t5 = ctx.segStart('b5'), t6 = ctx.segStart('b6'), END = ctx.end('starbirth');
  const r = rng(42);
  const MS = [-14, 2, -2];
  const bg = new CatVolume(ctx);
  const stars = new StarField(ctx, { count: ctx.quality.stars, spikeCount: 10, rMin: 80, rMax: 200, seed: 5, focus: 60, aperture: 0.2 });
  const sBg = new THREE.Scene(); sBg.add(stars.group);
  const sMain = new THREE.Scene();

  // A: collapsing cloud
  const NA = Math.round(2600 * q), A = [];
  for (let i = 0; i < NA; i++) { const u = r() * 2 - 1, th = r() * 6.283, s = Math.sqrt(1 - u * u); A.push({ d: [Math.cos(th) * s, u, Math.sin(th) * s], rad: 4 * Math.cbrt(r()) * (0.6 + 0.4 * r()), sz: 0.25 + 0.4 * r() }); }
  const pA = new Particles(ctx, NA); sMain.add(pA.points);
  const core = starSprite(ctx, sMain, [0, 0, 0], 3.2, [1.0, 0.78, 0.5], { gain: 2.2 });
  const msStar = starSprite(ctx, sMain, MS, 9, [0.62, 0.78, 1.0], { gain: 2.6 });

  // B: UV photons and winds streaming away from the massive star
  const NU = Math.round(360 * q), U = [];
  for (let i = 0; i < NU; i++) { const th = Math.acos(1 - r() * (1 - Math.cos(0.5))), ph = r() * 6.283; U.push({ d: [Math.cos(th), Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph)], off: r(), spd: 8 + 4 * r() }); }
  const pU = new Particles(ctx, NU * 3); sMain.add(pU.points);
  const NWd = Math.round(200 * q), Wd = [];
  for (let i = 0; i < NWd; i++) { const th = Math.acos(1 - r() * (1 - Math.cos(0.7))), ph = r() * 6.283; Wd.push({ d: [Math.cos(th), Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph)], off: r() }); }
  const pW = new Particles(ctx, NWd); sMain.add(pW.points);

  // C: the dusty wall with dense clumps
  const clumps = [{ x: 11.5, y: 3.8, z: 0.8, r: 1.15 }, { x: 14.0, y: -0.6, z: -0.6, r: 1.45 }, { x: 12.2, y: -4.4, z: 1.2, r: 1.0 }, { x: 16.5, y: 5.0, z: -1.5, r: 0.8 }];
  const wall = [];
  const NT = Math.round(3000 * q);
  for (let i = 0; i < NT; i++) {
    const x = 9 + 13 * r(), y = (r() - 0.5) * 15, z = (r() - 0.5) * 10; let th = (x - 9) / 13 * 0.85 + 0.1 * r();
    for (const c of clumps) { const dist = Math.hypot(y - c.y, z - c.z); if (x > c.x && dist < c.r) th = Math.max(th, 1.0 + 0.4 * (1 - dist / c.r)); }
    wall.push({ x, y, z, th, sz: 0.5 + 0.9 * r() });
  }
  for (const c of clumps) {
    const nc = Math.round(380 * q);
    for (let i = 0; i < nc; i++) { const a = r() * 6.283, b = Math.acos(2 * r() - 1), rr = c.r * 0.7 * Math.cbrt(r()); wall.push({ x: c.x + rr * Math.sin(b) * Math.cos(a), y: c.y + rr * Math.cos(b), z: c.z + rr * Math.sin(b) * Math.sin(a), th: 1.9, sz: 0.5 + 0.6 * r() }); }
    const nt = Math.round(260 * q);
    for (let i = 0; i < nt; i++) { const u = r(), rad = c.r * 0.55 * (1 - 0.6 * u) * Math.sqrt(r()), a = r() * 6.283; wall.push({ x: c.x + 0.3 + u * 9, y: c.y + Math.cos(a) * rad, z: c.z + Math.sin(a) * rad, th: 1.15 + 0.35 * (1 - u), sz: 0.4 + 0.5 * r() }); }
  }
  const NWall = wall.length;
  const pDark = new Particles(ctx, NWall, { additive: false }), pRim = new Particles(ctx, NWall);
  sMain.add(pDark.points, pRim.points);

  const keys = {
    pos: [[0, [0, 1.5, 17]], [t3 + 14, [1, 1, 14]], [t4 + 0.2, [-4, 2.5, 25]], [t4 + 7, [-2, 3, 28]], [t5 + 0.5, [5, 2.5, 26]], [t6 - 1, [10, 2, 24]], [t6 + 8, [20, 5, 20]], [END, [26, 7, 14]]],
    look: [[0, [0, 0, 0]], [t3 + 14, [0, 0, 0]], [t4 + 0.2, [-5, 1, 0]], [t4 + 7, [0, 0.5, 0]], [t5 + 0.5, [10, 0, 0]], [t6 - 1, [14, 0, 0]], [t6 + 8, [16, 0, 0]], [END, [16, 0, 0]]],
    fov: [[0, 40]],
  };
  keys.fov = [[0, ctx.portrait ? 52 : 40]];

  return {
    draw(T) {
      const rd = ctx.renderer, p = ctx.post.params;
      rig.apply(farKeys(ctx, keys, 1.55), T);
      const c = smoothstep(t3 + 1, t4 + 0.5, T), uvOn = smoothstep(t4 + 0.5, t4 + 2.5, T);
      bg.update(cam, T, { mode: 0, gas: 0.35, gasSeed: 6.0 }); bg.drawGas(rd, cam);
      stars.update(T, { spike: 0, gain: 0.7, focus: 80 }); rd.render(sBg, cam);

      // A
      const aA = 1 - smoothstep(t5 + 2, t5 + 6, T) * 0.7;
      for (let i = 0; i < NA; i++) {
        const o = A[i], f = 1 - 0.94 * Math.pow(c, 1.6), ang = c * 2.4 * (1.25 - o.rad / 4);
        const x0 = o.d[0] * o.rad * f, y0 = o.d[1] * o.rad * f, z0 = o.d[2] * o.rad * f, ca = Math.cos(ang), sa = Math.sin(ang);
        const hot = c * c, br = 1 + 3.2 * Math.pow(c, 3) * (1.2 - o.rad / 5);
        pA.set(i, x0 * ca + z0 * sa, y0, -x0 * sa + z0 * ca, (0.2 + 0.8 * hot) * br * 0.55, (0.26 + 0.4 * hot) * br * 0.55, (0.42 - 0.2 * hot) * br * 0.55, (0.16 + 0.3 * hot) * aA, o.sz * (1 - 0.55 * c));
      }
      pA.commit(cam);
      const ign = smoothstep(t4 - 1.2, t4 + 0.8, T); core.setScale(0.3 + 0.7 * ign); core.setGain(ign * 2.4 * (1 + 0.08 * Math.sin(T * 5)));
      const msOn = smoothstep(t4 - 0.2, t4 + 1.8, T); msStar.setGain(msOn * 2.8 * (1 + 0.05 * Math.sin(T * 3))); msStar.setScale(0.8 + 0.2 * msOn);

      // B
      for (let i = 0; i < NU; i++) {
        const o = U[i], s0 = ((T * o.spd + o.off * 36) % 36 + 36) % 36;
        for (let k = 0; k < 3; k++) {
          const s = s0 - k * 0.32, ss = ((s % 36) + 36) % 36, al = uvOn * (1 - ss / 36) * (k === 0 ? 0.85 : k === 1 ? 0.5 : 0.25);
          pU.set(i * 3 + k, MS[0] + o.d[0] * ss, MS[1] + o.d[1] * ss, MS[2] + o.d[2] * ss, 0.7, 0.85, 1.4, al, 0.14);
        }
      }
      pU.commit(cam);
      for (let i = 0; i < NWd; i++) { const o = Wd[i], s = ((T * 4.4 + o.off * 34) % 34 + 34) % 34; pW.set(i, MS[0] + o.d[0] * s, MS[1] + o.d[1] * s, MS[2] + o.d[2] * s, 1.0, 0.72, 0.45, uvOn * 0.45 * (1 - s / 34), 0.35); }
      pW.commit(cam);

      // C
      const E = smootherstep(t5 - 0.5, END - 5, T) * 0.88 * 1.25, wallIn = smoothstep(t4 + 2, t5, T);
      for (let i = 0; i < NWall; i++) {
        const o = wall[i], d = E - o.th, gone = smoothstep(-0.05, 0.05, d), alive = 1 - gone;
        const fx = o.x - Math.max(0, d) * 11, front = Math.exp(-(d * d) / 0.012);
        const sway = Math.sin(T * 0.3 + o.y) * 0.05;
        pDark.set(i, fx, o.y + sway, o.z, 0.03, 0.018, 0.012, 0.42 * alive * wallIn, o.sz);
        pRim.set(i, fx, o.y + sway, o.z, 1.2, 0.78, 0.32, (0.38 * front + 0.04) * (alive * 0.6 + 0.4 * front * (1 - gone * 0.5)) * wallIn * (E > 0.02 ? 1 : 0.35), o.sz * 0.9);
      }
      pDark.commit(cam); pRim.commit(cam);
      rd.render(sMain, cam);
      p.exposure = 1.05; p.bloom1 = 0.65; p.bloom2 = 0.5; p.vignette = 0.55;

      const it = [], lab = (v, text, a0, a1, sub, dx, dy) => { const l = labelAt(cam, v, text, window01(T, a0, a1, 0.7, 0.7), { sub, dx, dy }); if (l) it.push(l); };
      lab([0, 2.2, 0], 'Cold gas & dust', t3 + 0.5, t3 + 9, 'Gravity pulls it together', 7, -6);
      lab([0, 0, 0], 'A new star ignites', t3 + 11, t4 + 1.5, '', 7, -6);
      lab(MS, 'Massive star', t4 + 1.5, t5 + 1, 'Hot, bright, short-lived', 7, -7);
      lab([-4, 1, 0], 'Ultraviolet radiation + stellar wind', t4 + 3, t5 + 2, '', 0, -8);
      lab([11, 1, 0], 'Photoevaporation', t5 + 3, t6 + 2, 'Gas heated until it evaporates', -5, -9);
      lab([clumps[1].x, clumps[1].y, 0], 'Dense clump resists', t6 + 1, END - 1, 'Leaves a pillar pointing at the star', 6, 8);
      it.push({ kind: 'tag', text: 'Simplified illustration', a: 0.85 });
      it.push({ kind: 'credit', text: 'Concept: star formation and photoevaporation (NASA / ESA / STScI) · Not a hydrodynamic simulation', a: 1 });
      return it;
    },
  };
}
