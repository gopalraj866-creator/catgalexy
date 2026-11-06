// Minimal SRT parser (used for burned-in subtitles in the Shorts format)
export function parseSRT(text) {
  const cues = [];
  const blocks = text.replace(/\r/g, '').trim().split(/\n\n+/);
  const ts = (s) => { const m = s.match(/(\d+):(\d+):(\d+)[,.](\d+)/); return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000; };
  for (const b of blocks) {
    const lines = b.split('\n');
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const [a, c] = lines[i].split('-->');
    cues.push({ start: ts(a), end: ts(c), text: lines.slice(i + 1).join('\n') });
  }
  return cues;
}
