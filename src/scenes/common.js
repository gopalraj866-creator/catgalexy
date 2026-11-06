// Shared helpers for scene modules
import * as THREE from 'three';
import { fitDistance, project } from '../camera/rig.js';
import { smoothstep, clamp } from '../animations/ease.js';

export const CREDIT = 'Source imagery: NASA, ESA, CSA, STScI (Hubble WFC3 · Webb NIRCam, MIRI) · 3-D visualisation is illustrative';

// Camera spec for framing something of size (w x h) centred at (cx, cy, cz) with orbit angles.
// Landscape frames put the subject left of centre (rule of thirds) via `shift`; portrait stays centred.
export function view(ctx, { cx = 0, cy = 0, cz = 0, w = 2.2, h = 5.2, fill = 0.8, az = 0, el = 0, fov = 36, shift = 0 }) {
  const f = ctx.portrait ? fov + 10 : fov;
  const d = fitDistance(h, w, f, ctx.aspect, fill);
  const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
  const sx = ctx.portrait ? 0 : shift;
  return {
    pos: [cx + Math.sin(a) * Math.cos(e) * d + sx * 0, cy + Math.sin(e) * d, cz + Math.cos(a) * Math.cos(e) * d],
    look: [cx + sx, cy, cz], fov: f,
  };
}

// Build a rig spec from a list of [time, viewOpts]
export function rigSpec(ctx, keys, extra = {}) {
  const vs = keys.map(([t, o]) => [t, view(ctx, o)]);
  return {
    pos: vs.map(([t, v]) => [t, v.pos]), look: vs.map(([t, v]) => [t, v.look]),
    fov: vs.map(([t, v]) => [t, v.fov]), ...extra,
  };
}

// 0..1 pulse that is 1 between a and b with fades fi, fo
export function window01(T, a, b, fi = 0.6, fo = 0.6) {
  return smoothstep(a, a + fi, T) * (1 - smoothstep(b - fo, b, T));
}

// Project a world point to an overlay label
export function labelAt(camera, v, text, a, opts = {}) {
  const p = project(camera, new THREE.Vector3(...v));
  if (!p || a <= 0.001 || p.x < 0.04 || p.x > 0.96 || p.y < 0.05 || p.y > 0.92) return null;
  return { kind: 'label', x: p.x, y: p.y, text, a, ...opts };
}

export function makeCamera(ctx, fov = 36) {
  const c = new THREE.PerspectiveCamera(fov, ctx.aspect, 0.05, 2000);
  return c;
}

// Wide scenes need the camera pulled back in portrait (Shorts) so the composition is re-framed, not cropped.
export function wideK(ctx, k = 1.7) { return ctx.portrait ? k : 1; }
export function farKeys(ctx, keys, k = 1.7) {
  const f = wideK(ctx, k);
  return { pos: keys.pos.map(([t, p], i) => { const l = keys.look[Math.min(i, keys.look.length - 1)][1]; return [t, [l[0] + (p[0] - l[0]) * f, l[1] + (p[1] - l[1]) * f, l[2] + (p[2] - l[2]) * f]]; }), look: keys.look, fov: keys.fov };
}
