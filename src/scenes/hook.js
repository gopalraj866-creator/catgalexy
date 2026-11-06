// 00:00-00:20  Cinematic hook: from near-black, a pillar silhouette is revealed by the rim light of unseen
// massive stars, then a single eye ignites.
import * as THREE from 'three';
import { CatVolume } from '../simulation/catVolume.js';
import { StarField } from '../simulation/starfield.js';
import { Rig } from '../camera/rig.js';
import { rigSpec, makeCamera, CREDIT } from './common.js';
import { track, smoothstep, easeInOut, easeOutCubic } from '../animations/ease.js';

export function create(ctx) {
  const cam = makeCamera(ctx, 36), rig = new Rig(cam);
  const vol = new CatVolume(ctx);
  const stars = new StarField(ctx, { count: ctx.quality.stars, spikeCount: Math.round(ctx.quality.spikes * 0.7), rMin: 50, rMax: 120, seed: 11, focus: 14, aperture: 0.45 });
  const sStars = new THREE.Scene(); sStars.add(stars.group);
  const end = ctx.end('hook');
  const eyeT = ctx.segStart('h2') + 2.4;

  return {
    draw(T) {
      const r = ctx.renderer, p = ctx.post.params;
      const spec = rigSpec(ctx, [
        [0, { cy: 0.1, fill: 0.34, az: 24, el: 6, shift: -1.6 }],
        [8, { cy: 0.1, fill: 0.50, az: 12, el: 3, shift: -1.4 }],
        [end - 6, { cy: 0.15, fill: 0.72, az: 4, el: 1, shift: -1.0 }],
        [end, { cy: 0.45, fill: 0.9, az: 0, el: 0, shift: -0.9 }],
      ], { shake: 0.012 });
      rig.apply(spec, T);
      const light = smoothstep(1.0, 11.5, T) * 0.9 + 0.1 * smoothstep(0, 3, T);
      const eye = smoothstep(eyeT, eyeT + 1.6, T) * (1 + 0.12 * Math.sin(T * 3.1));
      vol.update(cam, T, { mode: 0, light: light, ambient: 0.35 + 0.4 * smoothstep(4, 18, T), eyeGlow: eye * 1.25, gas: 0.12 + 0.5 * smoothstep(2, 16, T), cat: [0, 0, 0, 1], eyePos: vol.eyeFromCat([0, 0, 0, 1]), steps: ctx.quality.steps });
      stars.update(T, { spike: 0, gain: 0.35 + 0.5 * smoothstep(0, 10, T), focus: 14 });
      vol.drawGas(r, cam); r.render(sStars, cam); vol.drawVolume(r, cam);
      p.exposure = 0.9 + 0.35 * smoothstep(8, 20, T); p.bloom1 = 0.75; p.bloom2 = 0.65; p.vignette = 0.7;
      const items = [{ kind: 'title', small: 'Technical Talk India', text: "Webb Just Revealed a Terrifying Cosmic Cat's Head", y: ctx.portrait ? 12 : 10.5, size: ctx.portrait ? 5.4 : 3.5, a: smoothstep(eyeT + 1.5, eyeT + 3.5, T) * (1 - smoothstep(end - 1.6, end - 0.6, T)) }];
      return items;
    },
  };
}
