// Entry point. The page exposes:
//   window.__init()            -> prepares renderer, textures, timeline (sets window.__ready)
//   window.__renderFrame(T)    -> renders the frame at absolute video time T seconds (deterministic)
// Query params: w, h, format (4k|1080p|shorts), quality (high|medium|low), scale (internal render scale), burn (0|1)
import * as THREE from 'three';
import { Post } from './post/composer.js';
import { Overlay } from './ui/overlay.js';
import { makeNoise3D, glowTexture, spikeTexture } from './simulation/textures.js';
import { clamp, smoothstep, easeInOut } from './animations/ease.js';
import { parseSRT } from './ui/srt.js';

const qs = new URLSearchParams(location.search);
const W = parseInt(qs.get('w') || '1920', 10), H = parseInt(qs.get('h') || '1080', 10);
const FORMAT = qs.get('format') || (H > W ? 'shorts' : '1080p');
const QUALITY = qs.get('quality') || 'high';
const SCALE = parseFloat(qs.get('scale') || '1');
const BURN = (qs.get('burn') ?? (H > W ? '1' : '0')) === '1';

const QUALITY_TIERS = {
  high:   { steps: 44, stars: 3600, spikes: 56, particles: 1.0, name: 'high' },
  medium: { steps: 32, stars: 2400, spikes: 38, particles: 0.65, name: 'medium' },
  low:    { steps: 22, stars: 1400, spikes: 24, particles: 0.4, name: 'low' },
};

// Scene groups: scenes that share one 3-D world and continue seamlessly. Boundaries BETWEEN groups
// get a dip-to-black or flash-to-white transition; boundaries inside a group are continuous.
const GROUPS = [
  { id: 'hook',      scenes: ['hook'],                               load: () => import('./scenes/hook.js') },
  { id: 'carina',    scenes: ['carina', 'carina2'],                  load: () => import('./scenes/carina.js') },
  { id: 'starbirth', scenes: ['starbirth'],                          load: () => import('./scenes/starbirth.js') },
  { id: 'telescopes',scenes: ['telescopes'],                         load: () => import('./scenes/telescopes.js') },
  { id: 'dustdemo',  scenes: ['dustdemo'],                           load: () => import('./scenes/dustdemo.js') },
  { id: 'catviews',  scenes: ['hubbleview', 'nircamview', 'miriview'], load: () => import('./scenes/catviews.js') },
  { id: 'protostar', scenes: ['eye', 'jet'],                         load: () => import('./scenes/protostar.js') },
  { id: 'galaxy',    scenes: ['galaxymap', 'scale'],                 load: () => import('./scenes/galaxy.js') },
  { id: 'erosion',   scenes: ['erosion', 'erosion2'],                load: () => import('./scenes/erosion.js') },
  { id: 'outro',     scenes: ['outro'],                              load: () => import('./scenes/outro.js') },
];
const FLASH = new Set(['hook>carina', 'erosion>outro']);

let ctx = null, timeline = null, cues = [], groupInst = {}, post = null, overlay = null;

window.__ready = false;
window.__init = async function () {
  const canvas = document.getElementById('gl');
  canvas.width = W; canvas.height = H;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true, stencil: false });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.autoClear = false;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const rendererName = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown';
  const maxPoint = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];
  timeline = await (await fetch('/public/data/timeline.json')).json();
  try { cues = parseSRT(await (await fetch('/subtitles/subtitles.srt')).text()); } catch (e) { cues = []; }
  post = new Post(renderer, W, H, { renderScale: SCALE });
  overlay = new Overlay(document.getElementById('overlay'), W, H);
  const aspect = W / H, portrait = H > W;
  const sceneRange = {}; for (const s of timeline.scenes) sceneRange[s.id] = s;
  const segMap = {}; for (const s of timeline.segments) segMap[s.id] = s;
  ctx = {
    THREE, renderer, post, W, H, aspect, portrait, format: FORMAT, burn: BURN, timeline,
    unit: Math.min(1, Math.max(0.5, Math.min(W, H) / 1080)) * Math.max(1, Math.min(W, H) / 1080) * SCALE, maxPoint,
    quality: QUALITY_TIERS[QUALITY] || QUALITY_TIERS.high, rendererName,
    noise3D: makeNoise3D(64),
    tex: { glow: glowTexture(128), spikeH: spikeTexture('hubble', 256), spikeW: spikeTexture('webb', 256) },
    sceneRange, segMap,
    start: (id) => sceneRange[id].start, end: (id) => sceneRange[id].end,
    segStart: (id) => segMap[id].start, segEnd: (id) => segMap[id].end,
    duration: timeline.duration,
  };
  window.__info = { renderer: rendererName, maxPoint, quality: ctx.quality.name, W, H, scale: SCALE, format: FORMAT, duration: timeline.duration, fps: timeline.fps };
  window.__ready = true;
  return window.__info;
};

function groupAt(T) {
  let sid = timeline.scenes[0].id;
  for (const s of timeline.scenes) if (T >= s.start) sid = s.id;
  return { sid, group: GROUPS.find((g) => g.scenes.includes(sid)) };
}

async function getGroup(g) {
  if (!groupInst[g.id]) { const mod = await g.load(); groupInst[g.id] = mod.create(ctx); }
  return groupInst[g.id];
}

// Fade amount (0..1) and colour for scene transitions + start/end fades.
function transitionFade(T) {
  let fade = 0, color = [0, 0, 0];
  fade = Math.max(fade, 1 - smoothstep(0.0, 1.4, T));
  fade = Math.max(fade, smoothstep(timeline.duration - 1.6, timeline.duration, T));
  for (let i = 1; i < timeline.scenes.length; i++) {
    const a = groupAt(timeline.scenes[i - 1].start + 0.01).group, b = groupAt(timeline.scenes[i].start + 0.01).group;
    if (a.id === b.id) continue;
    const key = `${a.id}>${b.id}`, flash = FLASH.has(key), hw = flash ? 0.5 : 0.55;
    const d = Math.abs(T - timeline.scenes[i].start);
    const f = 1 - smoothstep(0, hw, d);
    if (f > fade) { fade = f; color = flash ? [1, 1, 1] : [0, 0, 0]; }
  }
  return { fade: easeInOut(clamp(fade)), color };
}

window.__renderFrame = async function (T) {
  const { sid, group } = groupAt(T);
  const inst = await getGroup(group);
  const p = post.params;
  Object.assign(p, { exposure: 1, bloom1: 0.55, bloom2: 0.45, threshold: 0.9, vignette: 0.55, grain: 0.035, chroma: 0.0035, sat: 1.08, contrast: 1.04, fade: 0, fadeColor: [0, 0, 0], tint: [1, 1, 1] });
  let items = [];
  const tf = transitionFade(T);
  // Scenes may adjust post.params during draw(); the composite reads them afterwards, and the
  // transition fade is applied last so it always wins.
  post.render(() => { items = inst.draw(T, sid) || []; p.fade = Math.max(p.fade, tf.fade); p.fadeColor = tf.fade > 0.0005 ? tf.color : p.fadeColor; }, T);
  if (BURN) {
    const cue = cues.find((c) => T >= c.start && T <= c.end);
    if (cue) { const a = Math.min(1, (T - cue.start) / 0.12, (cue.end - T) / 0.12); items.push({ kind: 'subtitle', text: cue.text, a }); }
  }
  overlay.set(items.map((it) => (tf.fade > 0 && it.kind !== 'subtitle' ? { ...it, a: (it.a ?? 1) * (1 - tf.fade) } : it)));
  return sid;
};
