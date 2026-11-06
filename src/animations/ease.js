// Small deterministic animation toolkit: every value is a pure function of time,
// so any frame can be rendered independently (required for parallel chunk rendering).

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const smootherstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeInOut = (t) => t * t * (3 - 2 * t);
export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInCubic = (t) => Math.pow(clamp(t), 3);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Deterministic hash / PRNG (mulberry32)
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Piecewise value track with per-interval easing. keys: [[t, v], ...]; v number
export function track(keys, t, ease = easeInOut) {
  if (t <= keys[0][0]) return keys[0][1];
  const n = keys.length;
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  for (let i = 0; i < n - 1; i++) {
    if (t < keys[i + 1][0]) {
      const u = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
      return lerp(keys[i][1], keys[i + 1][1], ease(u));
    }
  }
  return keys[n - 1][1];
}

// Catmull-Rom path through keyframes for vectors (arrays). Smooth through the keys,
// no stop-start at each key. keys: [[t, [x,y,z]], ...]
export function path(keys, t) {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][1].slice();
  if (t >= keys[n - 1][0]) return keys[n - 1][1].slice();
  let i = 0;
  while (i < n - 2 && t >= keys[i + 1][0]) i++;
  const p0 = keys[Math.max(i - 1, 0)][1], p1 = keys[i][1], p2 = keys[i + 1][1], p3 = keys[Math.min(i + 2, n - 1)][1];
  const u = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
  // ease the parameter very slightly at the very first / last interval to avoid snaps
  const s = u, s2 = s * s, s3 = s2 * s;
  return p1.map((_, k) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * s + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * s2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * s3));
}

// 1D value noise for handheld camera feel
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const r = (k) => { const q = Math.sin((k + seed * 17.13) * 127.1) * 43758.5453; return q - Math.floor(q); };
  const u = f * f * (3 - 2 * f);
  return lerp(r(i), r(i + 1), u) * 2 - 1;
}

export function fmtYear(y) { return y < 0 ? `${Math.abs(Math.round(y))} BCE` : `${Math.round(y)} CE`; }
