#!/usr/bin/env node
// Builds subtitles/subtitles.srt from public/data/timeline.json (the same sentence timings that drive the video).
// Rules: <= 42 chars/line, <= 2 lines, <= 17 chars/s reading speed (split into cues when needed), min 1.0 s, no overlaps.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tl = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/timeline.json'), 'utf8'));
const MAXC = 42, MAXCPS = 17, GAP = 0.04;
const ts = (t) => { const ms = Math.round(t * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };

function wrap(text) {              // balanced 1-2 line wrap
  if (text.length <= MAXC) return [text];
  const w = text.split(' '); let best = null;
  for (let i = 1; i < w.length; i++) {
    const a = w.slice(0, i).join(' '), b = w.slice(i).join(' ');
    if (a.length > MAXC || b.length > MAXC) continue;
    const score = Math.abs(a.length - b.length); if (!best || score < best.score) best = { score, lines: [a, b] };
  }
  return best ? best.lines : null;
}
function chunks(text) {            // split into pieces that each wrap to <= 2 lines
  if (wrap(text)) return [text];
  const w = text.split(' '), out = []; let cur = [];
  const parts = text.split(/(?<=[,;:—])\s+/); let buf = '';
  for (const p of parts) { if (wrap((buf + ' ' + p).trim())) buf = (buf + ' ' + p).trim(); else { if (buf) out.push(buf); buf = p; } }
  if (buf) out.push(buf);
  return out.flatMap((o) => (wrap(o) ? [o] : (() => { const m = Math.ceil(o.split(' ').length / 2), ws = o.split(' '); return [ws.slice(0, m).join(' '), ws.slice(m).join(' ')]; })()));
}

const cues = [];
for (const seg of tl.segments) for (const s of seg.sentences) {
  const text = (s.show || s.say).replace(/\s+/g, ' ').trim(); const parts = chunks(text);
  const total = parts.reduce((a, p) => a + p.length, 0); let t = s.start;
  parts.forEach((p, i) => { const d = (s.end - s.start) * p.length / total; cues.push({ start: t, end: t + d, text: p }); t += d; });
}
// enforce min duration (stretch into silence after the cue where possible), no overlap
for (let i = 0; i < cues.length; i++) {
  const c = cues[i], nxt = cues[i + 1], limit = nxt ? nxt.start - GAP : tl.duration;
  const need = Math.max(1.0, c.text.length / MAXCPS);
  c.end = Math.min(Math.max(c.end + 0.15, c.start + need), limit); if (c.end <= c.start) c.end = c.start + 0.2;
}
let srt = '';
cues.forEach((c, i) => { srt += `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${wrap(c.text).join('\n')}\n\n`; });
fs.mkdirSync(path.join(ROOT, 'subtitles'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'subtitles/subtitles.srt'), srt);
const worst = cues.reduce((m, c) => Math.max(m, c.text.length / (c.end - c.start)), 0);
console.log(`subtitles.srt: ${cues.length} cues, worst reading speed ${worst.toFixed(1)} chars/s`);
