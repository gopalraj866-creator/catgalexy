// 02:30-04:30  The discovery: the same illustrative 3-D pillar seen in three wavelength regimes.
//   hubbleview  - visible light: dust is opaque, ionised rim, red eye, blue->orange gas
//   nircamview  - near-infrared: dust becomes translucent, dense stars, faint background galaxies, yellow eye
//   miriview    - mid-infrared: warm dust + PAH emission glows, red background, white eye
// The wavelength morph is continuous (uMode 0 -> 1 -> 2) so the audience literally watches the dust turn transparent.
import * as THREE from 'three';
import { CatVolume } from '../simulation/catVolume.js';
import { StarField } from '../simulation/starfield.js';
import { Rig } from '../camera/rig.js';
import { rigSpec, makeCamera, window01, labelAt, CREDIT } from './common.js';
import { track, smoothstep, clamp, rng } from '../animations/ease.js';

export function create(ctx) {
  const cam = makeCamera(ctx, 36), rig = new Rig(cam);
  const vol = new CatVolume(ctx);
  const starsBack = new StarField(ctx, { count: Math.round(ctx.quality.stars * 1.15), spikeCount: ctx.quality.spikes, rMin: 40, rMax: 110, seed: 21, focus: 11, aperture: 0.35 });
  const sBack = new THREE.Scene(); sBack.add(starsBack.group);
  // a thin foreground layer of near stars (drawn over the dust)
  const starsFront = new StarField(ctx, { count: Math.round(ctx.quality.stars * 0.08), spikeCount: 7, rMin: 2.5, rMax: 6.5, seed: 33, focus: 11, aperture: 1.6, order: 20 });
  const sFront = new THREE.Scene(); sFront.add(starsFront.group);
  // faint background galaxies (elliptical glows): visible only in the near-infrared regime
  const gal = new THREE.Group(), r = rng(8);
  for (let i = 0; i < 16; i++) {
    const m = new THREE.SpriteMaterial({ map: ctx.tex.glow, color: new THREE.Color().setHSL(0.08 + r() * 0.1, 0.5, 0.55), blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false, rotation: r() * 3.14, opacity: 0 });
    const s = new THREE.Sprite(m); const th = r() * 6.283, ph = (r() - 0.5) * 1.2, R = 70;
    s.position.set(Math.cos(th) * Math.cos(ph) * R, Math.sin(ph) * R * 0.9 - 5, Math.sin(th) * Math.cos(ph) * R - 20);
    const sz = 1.6 + r() * 3.2; s.scale.set(sz * 1.7, sz * 0.7, 1); s.userData = { base: 0.35 + r() * 0.5 }; gal.add(s);
  }
  const sGal = new THREE.Scene(); sGal.add(gal);

  const S0 = ctx.start('hubbleview'), S1 = ctx.start('nircamview'), S2 = ctx.start('miriview'), END = ctx.end('miriview');
  const sg = (id, o = 0) => ctx.segStart(id) + o;
  const full = { cy: 0.0, fill: 0.80, shift: 1.2 };
  const keys = [
    [S0, { ...full, az: 22, el: 4, fill: 0.62 }],
    [sg('m2'), { cx: 0.5, cy: 0.5, w: 2.2, h: 3.2, fill: 0.78, az: 38, el: 6, shift: 0.6 }],         // right-hand rim
    [sg('m3', 0.2), { cx: 0.55, cy: 1.12, w: 1.6, h: 1.4, fill: 0.75, az: 12, el: 2, shift: 0.3 }],   // eye close-up
    [sg('m4'), { ...full, az: 0, el: 0, fill: 0.84 }],                                                  // pull back: gas gradient
    [S1, { ...full, az: -4, el: 0, fill: 0.84 }],
    [sg('m6'), { cx: 0.1, cy: 0.1, w: 2.0, h: 3.4, fill: 0.80, az: -26, el: 5, shift: 0.6 }],         // surface structure + parallax
    [sg('m7'), { ...full, cy: 0.6, az: -8, el: 8, fill: 0.62 }],
    [sg('m8'), { cx: 0.55, cy: 1.12, w: 1.6, h: 1.4, fill: 0.72, az: 6, el: 2, shift: 0.3 }],
    [S2, { ...full, az: 14, el: 2, fill: 0.80 }],
    [sg('m10'), { cx: -0.8, cy: 0.1, w: 2.4, h: 3.4, fill: 0.80, az: -34, el: 3, shift: -0.2 }],       // left-hand wisps
    [sg('m11'), { ...full, az: -10, el: 0, fill: 0.84 }],
    [END, { ...full, az: 0, el: 0, fill: 0.82 }],
  ];

  return {
    draw(T) {
      const rd = ctx.renderer, p = ctx.post.params;
      rig.apply(rigSpec(ctx, keys, { shake: 0.01 }), T);
      const mode = track([[S1 - 0.2, 0], [S1 + 3.6, 1]], T) + track([[S2 - 0.2, 0], [S2 + 3.6, 1]], T);   // 0..2
      const m1 = clamp(mode), m2 = clamp(mode - 1);
      const eyePulse = 1 + 0.08 * Math.sin(T * 2.4);
      vol.update(cam, T, { mode, light: 1, ambient: 1.0, eyeGlow: (1.15 + 0.2 * m1) * eyePulse, gas: 1.0, cat: [0, 0, 0, 1], eyePos: vol.eyeFromCat([0, 0, 0, 1]), steps: ctx.quality.steps, seed: 0.37 });
      const starGain = 0.55 + 0.95 * m1 - 0.55 * m2;
      starsBack.update(T, { spike: m1, gain: starGain, focus: 11 });
      starsFront.update(T, { spike: m1, gain: 0.8, focus: 11 });
      for (const s of gal.children) s.material.opacity = s.userData.base * (m1 * (1 - m2 * 0.7)) * 0.9;
      vol.drawGas(rd, cam); rd.render(sBack, cam); rd.render(sGal, cam); vol.drawVolume(rd, cam); rd.render(sFront, cam);
      p.exposure = 1.05; p.bloom1 = 0.5 + 0.2 * m2; p.bloom2 = 0.4; p.vignette = 0.5; p.sat = 1.1;

      // --- annotations -------------------------------------------------------------------------
      const items = [];
      const inst = T < S1 ? ['HUBBLE · WFC3', 'Visible light'] : T < S2 ? ['WEBB · NIRCam', 'Near-infrared'] : ['WEBB · MIRI', 'Mid-infrared · 7.7, 11 and 15 µm → blue, green, red'];
      const phase = T < S1 ? [S0, S1] : T < S2 ? [S1, S2] : [S2, END];
      items.push({ kind: 'lower', title: inst[0], sub: inst[1], a: window01(T, phase[0] + 0.8, phase[1] - 0.5, 0.8, 0.6) });
      const eye = vol.eyeFromCat([0, 0, 0, 1]);
      const L = (v, text, a0, a1, sub, dx, dy) => labelAt(cam, v, text, window01(T, a0, a1, 0.7, 0.7), { sub, dx, dy });
      const pushIf = (x) => x && items.push(x);
      pushIf(L([0.78, 0.5, 0.1], 'Ionised rim', sg('m2', 3.0), sg('m3', 0.5), 'UV-lit gas · photoevaporation?', 8, -6));
      pushIf(L(eye, T < S1 ? 'Red "eye"' : T < S2 ? 'Yellow "eye"' : 'White "eye"', sg('m3', 3.5), sg('m4', -0.5), 'Likely a young star, partly buried in dust', 8, -7));
      pushIf(L([-1.15, 0.9, 0.1], 'Ghostly dust wisps', sg('m10', 1.0), sg('m11', 0.4), 'Exposed to radiation from massive stars', -8, -6));
      pushIf(L([0.4, -0.2, 0], 'Dust turns translucent', sg('m5', 2.0), sg('m6', 6), 'Surface structure appears', 8, -6));
      items.push({ kind: 'tag', text: 'Illustrative 3-D visualisation', a: 0.85 });
      items.push({ kind: 'credit', text: CREDIT, a: smoothstep(S0 + 1.5, S0 + 3, T) });
      return items;
    },
  };
}
