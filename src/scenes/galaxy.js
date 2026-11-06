// 05:38-06:30  Where is it? (galaxymap)  and  how big / how old is the light? (scale)
// galaxymap: a face-on Milky Way (stylised spiral) with approximate positions of the Sun, the Cat's Paw Nebula
//            (NGC 6334, Scorpius, about 4,000 ly) and the Cat's Head region (Carina, about 7,500 ly).
//            Directions come from galactic longitudes (about 351 and 288 degrees); positions are approximate.
// scale:     Hubble's view is about 5.5 light-years across -> a pulse of light needs 5.5 years to cross it.
//            Then the light we see left the region about 7,500 years ago -> a pull-back "flight" with a year counter.
import * as THREE from 'three';
import { Particles } from '../simulation/particles.js';
import { CatVolume } from '../simulation/catVolume.js';
import { StarField } from '../simulation/starfield.js';
import { Rig } from '../camera/rig.js';
import { rigSpec, makeCamera, window01, labelAt, farKeys } from './common.js';
import { rng, smoothstep, smootherstep, clamp, lerp } from '../animations/ease.js';

const LY = 1000;                                          // 1 scene unit = 1,000 light-years in the map
const SUN = [0, 0, 26];
const dirL = (lDeg) => { const l = lDeg * Math.PI / 180; return [-Math.sin(l), 0, -Math.cos(l)]; };   // galactic longitude -> map direction
const at = (lDeg, dKly) => { const d = dirL(lDeg); return [SUN[0] + d[0] * dKly, 0, SUN[2] + d[2] * dKly]; };
const PAW = at(351.2, 4.0), HEAD = at(287.6, 7.5);

export function create(ctx) {
  const cam = makeCamera(ctx, 38), rig = new Rig(cam);
  const S = ctx.start('galaxymap'), M = ctx.start('scale'), END = ctx.end('scale');
  const d8 = ctx.segMap.d8, d9 = ctx.segStart('d9'), d9e = ctx.segEnd('d9');
  const r = rng(31), q = ctx.quality.particles;
  const stars = new StarField(ctx, { count: ctx.quality.stars, spikeCount: 8, rMin: 200, rMax: 400, seed: 2, focus: 200, aperture: 0.05 });
  const sBg = new THREE.Scene(); sBg.add(stars.group);

  // --- galaxy map ---
  const NG = Math.round(14000 * q), G = [];
  for (let i = 0; i < NG; i++) {
    let x, z, y, c, sz;
    if (i < NG * 0.16) { const rr = Math.pow(r(), 1.7) * 7, a = r() * 6.283; x = Math.cos(a) * rr; z = Math.sin(a) * rr; y = (r() - 0.5) * 3.2 * Math.exp(-rr / 4); c = [1.0, 0.8, 0.5]; sz = 0.35; }
    else {
      const arm = Math.floor(r() * 4), t = Math.pow(r(), 0.85), rr = 3 + t * 47, a = arm * Math.PI / 2 + Math.log(rr / 3) * 2.1 + (r() - 0.5) * (0.35 + 0.25 * t);
      x = Math.cos(a) * rr; z = Math.sin(a) * rr; y = (r() - 0.5) * 0.7; c = r() < 0.35 ? [0.55, 0.72, 1.0] : [1.0, 0.86, 0.65]; sz = 0.3 + 0.35 * r();
    }
    G.push({ x, y, z, c, sz, b: 0.4 + 0.6 * r() });
  }
  const pG = new Particles(ctx, NG); const sMap = new THREE.Scene(); sMap.add(pG.points);
  for (let i = 0; i < NG; i++) { const o = G[i]; pG.set(i, o.x, o.y, o.z, o.c[0] * o.b * 0.8, o.c[1] * o.b * 0.8, o.c[2] * o.b * 0.8, 0.5, o.sz); }
  const mkLine = (a, b, col) => { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color(...col), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthTest: false })); sMap.add(l); return l; };
  const lPaw = mkLine(SUN, PAW, [0.4, 0.7, 1.4]), lHead = mkLine(SUN, HEAD, [1.4, 0.7, 0.4]);
  const mk = (pos, col, s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctx.tex.glow, color: new THREE.Color(...col), blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false })); sp.position.set(...pos); sp.scale.set(s, s, 1); sMap.add(sp); return sp; };
  const spSun = mk(SUN, [2.4, 2.2, 1.6], 1.8), spPaw = mk(PAW, [0.7, 1.4, 2.6], 1.5), spHead = mk(HEAD, [2.8, 1.4, 0.7], 1.8);

  // --- scale scene ---
  const vol = new CatVolume(ctx);
  const pS = new THREE.Scene(); const NS = Math.round(300 * q);
  const streaks = new Particles(ctx, NS * 6); pS.add(streaks.points); const SS = [];
  for (let i = 0; i < NS; i++) { const a = r() * 6.283, rad = 1.5 + Math.pow(r(), 0.7) * 22; SS.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad, z0: r() * 260, c: r() < 0.5 ? [0.7, 0.85, 1.4] : [1.4, 1.1, 0.8] }); }
  const earth = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctx.tex.glow, color: new THREE.Color(0.4, 0.8, 2.2), blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false })); pS.add(earth);

  const mapKeys = {
    pos: [[S, [0, 95, 38]], [S + 5, [4, 46, 52]], [M - 0.2, [5, 11, 40]]], look: [[S, [0, 0, 14]], [S + 5, [3, 0, 20]], [M - 0.2, [4, 0, 23]]], fov: [[S, ctx.portrait ? 50 : 40]],
  };
  const catKeys = rigSpec(ctx, [[M, { cy: 0, fill: 0.78, az: 8, el: 2, shift: 0.7 }], [d9 - 0.5, { cy: 0, fill: 0.82, az: 0, el: 0, shift: 0.7 }]], { shake: 0.006 });

  return {
    draw(T, sid) {
      const rd = ctx.renderer, p = ctx.post.params, it = [];
      if (T < M) {
        rig.apply(farKeys(ctx, mapKeys, 1.5), T);
        stars.update(T, { spike: 0, gain: 0.5, focus: 300 }); rd.render(sBg, cam);
        pG.commit(cam); rd.render(sMap, cam);
        const pulse = 1 + 0.1 * Math.sin(T * 3);
        lPaw.material.opacity = smoothstep(S + 3, S + 5, T) * 0.8; lHead.material.opacity = smoothstep(S + 5, S + 7, T) * 0.8;
        spPaw.material.opacity = smoothstep(S + 3, S + 4, T); spHead.material.opacity = smoothstep(S + 5, S + 6, T); spSun.scale.set(1.8 * pulse, 1.8 * pulse, 1);
        p.exposure = 1.1; p.bloom1 = 0.55; p.bloom2 = 0.5; p.vignette = 0.5;
        const lab = (v, text, a0, a1, sub, dx, dy) => { const l = labelAt(cam, v, text, window01(T, a0, a1, 0.6, 0.6), { sub, dx, dy }); if (l) it.push(l); };
        lab(SUN, 'Sun', S + 3.5, M - 0.5, '', -6, 6);
        lab(PAW, 'Cat’s Paw Nebula', S + 4, M - 0.5, 'Scorpius · about 4,000 ly', 6, -9);
        lab(HEAD, 'Cat’s Head', S + 6, M - 0.5, 'Carina · about 7,500 ly', 6, 6);
        it.push({ kind: 'tag', text: 'Schematic map · positions approximate', a: 0.85 });
        return it;
      }
      // ---- scale ----
      const inFlight = T >= d9 - 0.3;
      const k = smoothstep(d9 - 0.3, d9e - 1.5, T);
      if (!inFlight) {
        rig.apply(catKeys, T);
        vol.update(cam, T, { mode: 1, light: 1, ambient: 1, eyeGlow: 1.2, gas: 1, cat: [0, 0, 0, 1], eyePos: vol.eyeFromCat([0, 0, 0, 1]), steps: ctx.quality.steps, seed: 0.37 });
        stars.update(T, { spike: 1, gain: 1, focus: 11 });
        vol.drawGas(rd, cam); rd.render(sBg, cam); vol.drawVolume(rd, cam);
        p.exposure = 1.05; p.bloom1 = 0.55; p.bloom2 = 0.45; p.vignette = 0.5;
        const s2 = d8.sentences[1] || d8.sentences[d8.sentences.length - 1];
        const prog = smootherstep(s2.start + 1.0, s2.end - 0.4, T);
        const x0 = ctx.portrait ? 7 : 8, w = ctx.portrait ? 86 : 52;
        it.push({ kind: 'bar', x: x0, y: ctx.portrait ? 72 : 80, w, fill: 1, text: 'Hubble’s view of the Cat’s Head: about 5.5 light-years across', a: window01(T, M + 2, d9 - 0.2, 1.0, 0.6), color: 'rgba(255,255,255,.35)', glow: 'rgba(255,255,255,.2)' });
        it.push({ kind: 'bar', x: x0, y: ctx.portrait ? 72 : 80, w, fill: prog, text: ' ', a: window01(T, M + 2, d9 - 0.2, 1.0, 0.6) });
        it.push({ kind: 'stat', x: x0, y: ctx.portrait ? 60 : 62, text: `${(prog * 5.5).toFixed(1)} years`, sub: 'Light crossing the scene', size: ctx.portrait ? 6 : 4.2, a: window01(T, M + 2, d9 - 0.2, 1.0, 0.6) });
        it.push({ kind: 'tag', text: 'Illustrative 3-D visualisation', a: 0.85 });
        return it;
      }
      // flight: pull straight back from the nebula; the pillar shrinks to a point while light "travels" 7,500 years
      const z = lerp(8, 240, Math.pow(k, 1.7));
      const camSpec = { pos: [[0, [0, 0.3, z]]], look: [[0, [0, 0, 0]]], fov: [[0, ctx.portrait ? 40 : 34]] };
      rig.apply({ pos: [[0, [0, 0.4, z]], [1, [0, 0.4, z]]], look: [[0, [0, 0, 0]], [1, [0, 0, 0]]], fov: [[0, ctx.portrait ? 40 : 34]] }, 0.5);
      vol.update(cam, T, { mode: 1, light: 1, ambient: 1, eyeGlow: 1.5, eyeSize: 0.09 + 0.002 * z, gas: 0.6 * (1 - 0.6 * k), cat: [0, 0, 0, 1], eyePos: vol.eyeFromCat([0, 0, 0, 1]), bound: [0, -0.25, 0, 3.6], steps: ctx.quality.steps, seed: 0.37 });
      stars.update(T, { spike: 1, gain: 1, focus: 300 });
      vol.drawGas(rd, cam); rd.render(sBg, cam); vol.drawVolume(rd, cam);
      const speed = 60 * Math.pow(k, 1.1) + 4;
      for (let i = 0; i < NS; i++) {
        const o = SS[i], zz = z - (((o.z0 - (T - d9) * speed * 0.9) % 260) + 260) % 260 + 0.0;
        for (let j = 0; j < 6; j++) streaks.set(i * 6 + j, o.x, o.y, zz + j * (0.6 + speed * 0.05) , o.c[0], o.c[1], o.c[2], (j === 0 ? 0.85 : 0.6 - j * 0.09) * smoothstep(0.05, 0.4, k), 0.09);
      }
      streaks.commit(cam); earth.position.set(0, 0.4, z + 40 * (1 - k) * 0 + 0.0); earth.scale.set(0.001, 0.001, 1);
      rd.render(pS, cam);
      p.exposure = 1.05; p.bloom1 = 0.7; p.bloom2 = 0.5; p.vignette = 0.6; p.chroma = 0.003 + 0.01 * k;
      const yr = lerp(-5474, 2026, smootherstep(d9 + 0.5, d9e - 1.0, T)), disp = yr < 0 ? `${Math.round(-yr / 10) * 10} BCE` : `${Math.round(yr)} CE`;
      const a = window01(T, d9 + 0.3, END - 0.4, 0.8, 0.8);
      it.push({ kind: 'stat', x: 50, y: ctx.portrait ? 34 : 38, text: yr > 1990 ? '2026' : disp, sub: 'The light leaves the Cat’s Head', align: 'center', size: ctx.portrait ? 9 : 7, a });
      it.push({ kind: 'bar', x: ctx.portrait ? 7 : 25, y: ctx.portrait ? 70 : 76, w: ctx.portrait ? 86 : 50, fill: smootherstep(d9 + 0.5, d9e - 1.0, T), text: 'About 7,500 years of travel to reach us', a });
      it.push({ kind: 'tag', text: 'Illustrative · distance approximate', a: 0.85 });
      return it;
    },
  };
}
