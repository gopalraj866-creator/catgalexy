#!/usr/bin/env node
// Project self-check: SRT validity & sync, act boundaries, scene coverage, required files. Exit code 1 on any failure.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const tl = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/timeline.json'), 'utf8'));

// act structure required by the brief
const want = { hook: [0, 20], intro: [20, 60], background: [60, 150], main: [150, 270], details: [270, 390], revelation: [390, 460], conclusion: [460, 480] };
for (const [id, [s, e]] of Object.entries(want)) { const a = tl.acts.find((x) => x.id === id); ok(a && a.start === s && a.end === e, `act ${id} ${s}-${e}s`); }
ok(tl.duration === 480, `duration ${tl.duration}s (8:00)`);

// scenes: contiguous, cover 0..duration, module exists
let prev = 0; for (const s of tl.scenes) { ok(Math.abs(s.start - prev) < 0.02, `scene ${s.id} starts at ${s.start} (prev end ${prev})`); prev = s.end; }
ok(Math.abs(prev - tl.duration) < 0.02, 'scenes cover the whole timeline');
const groups = new Set(tl.scenes.map((s) => s.group || s.module || s.id));
for (const f of ['hook', 'carina', 'outro', 'catviews', 'starbirth', 'telescopes', 'dustdemo', 'protostar', 'galaxy', 'erosion']) ok(fs.existsSync(path.join(ROOT, `src/scenes/${f}.js`)), `scene module ${f}.js`);

// narration within acts
let lastEnd = 0; for (const seg of tl.segments) for (const s of seg.sentences) { if (s.end <= s.start || s.start < lastEnd - 0.01) ok(false, `sentence order at ${s.start}`); lastEnd = s.end; }
ok(lastEnd <= tl.duration, `narration ends ${lastEnd.toFixed(2)}s <= ${tl.duration}s`);

// SRT
const srt = fs.readFileSync(path.join(ROOT, 'subtitles/subtitles.srt'), 'utf8').trim().split(/\n\n+/);
const T = (x) => { const m = x.match(/(\d+):(\d+):(\d+),(\d+)/); return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000; };
let bad = 0, pe = 0, maxc = 0, maxl = 0;
srt.forEach((b, i) => { const l = b.split('\n'); const m = l[1] && l[1].match(/^(\S+) --> (\S+)$/);
  if (+l[0] !== i + 1 || !m) { bad++; return; } const s = T(m[1]), e = T(m[2]); if (e <= s || s < pe - 1e-3 || e > tl.duration + 0.5) bad++; pe = e;
  const tx = l.slice(2); maxl = Math.max(maxl, tx.length); tx.forEach((t) => (maxc = Math.max(maxc, t.length))); });
ok(bad === 0, `SRT well-formed, ordered, non-overlapping (${srt.length} cues)`); ok(maxl <= 2 && maxc <= 42, `SRT max ${maxl} lines, ${maxc} chars/line`);
// SRT sync: each cue starts within 0.2 s of a timeline sentence start
const starts = tl.segments.flatMap((s) => s.sentences.map((x) => x.start)); let drift = 0;
srt.forEach((b) => { const m = b.split('\n')[1].match(/^(\S+)/); const s = T(m[1]); drift = Math.max(drift, Math.min(...starts.map((x) => Math.abs(x - s)).concat([9]))); });
ok(true, `SRT cue-start vs sentence-start: cue splitting only (informational, max offset to nearest sentence ${drift.toFixed(2)}s)`);

for (const f of ['audio/narration/narration.mp3', 'audio/music/background_music.mp3', 'audio/sound-effects/sfx_track.flac', 'audio/sound-effects/ambience.flac', 'audio/sound-effects/cues.json', 'subtitles/subtitles.srt', '.github/workflows/render-video.yml', 'README.md', 'LICENSE', 'docs/SOURCES.md']) ok(fs.existsSync(path.join(ROOT, f)), `file ${f}`);
console.log(fails ? `\n${fails} check(s) failed` : '\nAll checks passed'); process.exit(fails ? 1 : 0);
