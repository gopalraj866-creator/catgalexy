#!/usr/bin/env node
/**
 * Frame renderer: drives the Three.js documentary in headless Chromium (software WebGL via
 * ANGLE/SwiftShader, no GPU required), captures each frame and streams it straight into FFmpeg
 * (no frames are stored on disk, so memory/disk use stays flat).
 *
 * Usage
 *   node scripts/render.js --format 1080p                       render the whole video (video only)
 *   node scripts/render.js --format 4k --start 120 --end 150    render a time range (used by CI chunks)
 *   node scripts/render.js --plan --format 1080p --chunk-seconds 30   print the chunk matrix as JSON
 *   node scripts/render.js --stills 5,60,200 --format shorts    write JPEG stills to build/stills/
 *
 * Options
 *   --format    4k | 1080p | shorts           (3840x2160 | 1920x1080 | 1080x1920)
 *   --fps       frames per second             (default 30)
 *   --quality   high | medium | low           (ray-march steps / star counts, default high)
 *   --scale     internal render scale 0.5-1   (renders smaller and upsamples; default 1)
 *   --crf       x264 quality                  (default 17)
 *   --out       output file                   (default build/video_<format>.mp4)
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); if (i < 0) return d; const v = argv[i + 1]; return v === undefined || v.startsWith('--') ? true : v; };

const FORMATS = { '4k': [3840, 2160], '1080p': [1920, 1080], 'shorts': [1080, 1920] };
const format = String(arg('format', '1080p')).toLowerCase();
if (!FORMATS[format]) { console.error(`Unknown --format "${format}". Use 4k | 1080p | shorts`); process.exit(2); }
const [W, H] = FORMATS[format];
const fps = parseInt(arg('fps', '30'), 10);
const quality = String(arg('quality', 'high'));
const scale = parseFloat(arg('scale', '1'));
const crf = String(arg('crf', '17'));
const timeline = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/timeline.json'), 'utf8'));
const duration = timeline.duration;
const t0 = parseFloat(arg('start', '0')), t1 = Math.min(parseFloat(arg('end', String(duration))), duration);
const log = (...a) => console.log(`[render ${new Date().toISOString().slice(11, 19)}]`, ...a);

// ---- plan mode: emit chunk ranges for a CI matrix ------------------------------------------------
if (arg('plan', false)) {
  const len = parseFloat(arg('chunk-seconds', '30'));
  const out = [];
  for (let s = 0, i = 0; s < duration - 1e-6; s += len, i++) out.push({ index: i, name: String(i).padStart(3, '0'), start: s, end: Math.min(s + len, duration) });
  console.log(JSON.stringify(out));
  process.exit(0);
}

// ---- static file server ---------------------------------------------------------------------------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.srt': 'text/plain', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = decodeURIComponent(req.url.split('?')[0]);
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(f).pipe(res);
    }).listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// ---- browser launch with WebGL fallback strategy ---------------------------------------------------
function findChrome() {
  const cands = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  for (const c of cands) if (fs.existsSync(c)) return c;
  console.error('No Chrome/Chromium found. Set CHROME_PATH or install google-chrome / chromium.'); process.exit(3);
}
const BASE_FLAGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--force-color-profile=srgb', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--mute-audio', '--autoplay-policy=no-user-gesture-required'];
// Strategy 1: ANGLE + SwiftShader (software Vulkan CPU rasteriser) - works on any GitHub-hosted runner.
// Strategy 2: same via the legacy flag set. Strategy 3: let Chrome decide (uses a real GPU if one exists).
const GL_STRATEGIES = [
  { name: 'angle-swiftshader', flags: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  { name: 'swiftshader-legacy', flags: ['--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] },
  { name: 'chrome-default', flags: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] },
];

async function openPage(baseUrl, strategies) {
  const exe = findChrome();
  let lastErr;
  for (const s of strategies) {
    let browser;
    try {
      browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: [...BASE_FLAGS, ...s.flags, `--window-size=${W},${H}`], protocolTimeout: 600000, defaultViewport: { width: W, height: H, deviceScaleFactor: 1 } });
      const page = await browser.newPage();
      await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
      page.on('console', (m) => { const t = m.text(); if (/error|warn/i.test(m.type()) || /THREE\.WebGLProgram|shader/i.test(t)) log('[page]', m.type(), t.slice(0, 400)); });
      page.on('pageerror', (e) => log('[page error]', String(e).slice(0, 600)));
      const url = `${baseUrl}/public/index.html?w=${W}&h=${H}&format=${format}&quality=${quality}&scale=${scale}${arg('burn', null) !== null ? '&burn=' + (arg('burn') === true ? 1 : arg('burn')) : ''}`;
      await page.goto(url, { waitUntil: 'load', timeout: 120000 });
      const info = await page.evaluate(() => window.__init());
      log(`WebGL ready via "${s.name}": ${info.renderer} | ${info.W}x${info.H} scale ${info.scale} quality ${info.quality} maxPoint ${info.maxPoint}`);
      return { browser, page, info };
    } catch (e) { lastErr = e; log(`strategy "${s.name}" failed: ${String(e).slice(0, 300)}`); try { await browser?.close(); } catch {} }
  }
  throw new Error('No WebGL strategy worked: ' + lastErr);
}

// ---- main -------------------------------------------------------------------------------------------
const srv = await serve();
const baseUrl = `http://127.0.0.1:${srv.address().port}`;
let session = await openPage(baseUrl, GL_STRATEGIES);

const jpegOpts = { type: 'jpeg', quality: 93, optimizeForSpeed: true, captureBeyondViewport: false };

if (arg('stills', false)) {
  const dir = path.join(ROOT, 'build', 'stills'); fs.mkdirSync(dir, { recursive: true });
  for (const tt of String(arg('stills')).split(',').map(Number)) {
    const t = Date.now(); const sid = await session.page.evaluate((x) => window.__renderFrame(x), tt);
    const f = path.join(dir, `${format}_t${String(tt).padStart(6, '0')}_${sid}.jpg`);
    fs.writeFileSync(f, await session.page.screenshot(jpegOpts));
    log(`still t=${tt}s (${sid}) -> ${f}  [${((Date.now() - t) / 1000).toFixed(1)}s]`);
  }
  await session.browser.close(); srv.close(); process.exit(0);
}

const outFile = path.resolve(String(arg('out', path.join(ROOT, 'build', `video_${format}.mp4`))));
fs.mkdirSync(path.dirname(outFile), { recursive: true });
const tmpOut = outFile.replace(/\.mp4$/, '') + '.partial.mp4';
const f0 = Math.round(t0 * fps), f1 = Math.round(t1 * fps), total = f1 - f0;
log(`Rendering ${format} ${W}x${H} @${fps}fps, frames ${f0}..${f1 - 1} (${total} frames, ${t0}s..${t1}s) -> ${outFile}`);

const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', 'pipe:0',
  '-vf', 'format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', crf, '-profile:v', 'high', '-level', W >= 3840 ? '5.1' : '4.2', '-g', String(fps), '-bf', '2',
  '-r', String(fps), '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', '-an', '-f', 'mp4', tmpOut],
  { stdio: ['pipe', 'inherit', 'inherit'] });
let ffDone = new Promise((res, rej) => { ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))); ff.on('error', rej); });
ff.stdin.on('error', () => {});

const started = Date.now(); let restarts = 0;
for (let f = f0; f < f1;) {
  const T = f / fps;
  try {
    await session.page.evaluate((x) => window.__renderFrame(x), T);
    const buf = await session.page.screenshot(jpegOpts);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    f++;
    const done = f - f0;
    if (done % Math.max(1, Math.round(fps * 2)) === 0 || done === total) {
      const el = (Date.now() - started) / 1000, rate = done / el, eta = (total - done) / rate;
      log(`frame ${done}/${total} (${(100 * done / total).toFixed(1)}%)  T=${T.toFixed(2)}s  ${(1 / rate).toFixed(2)} s/frame  ETA ${(eta / 60).toFixed(1)} min  rss ${(process.memoryUsage().rss / 1048576).toFixed(0)} MB`);
    }
  } catch (e) {
    restarts++; log(`frame ${f} failed (${String(e).slice(0, 200)}), restart ${restarts}/4`);
    if (restarts > 4) { ff.stdin.destroy(); try { fs.unlinkSync(tmpOut); } catch {} process.exit(1); }
    try { await session.browser.close(); } catch {}
    session = await openPage(baseUrl, GL_STRATEGIES);
  }
}
ff.stdin.end();
await ffDone;
fs.renameSync(tmpOut, outFile);            // only a fully finished file gets its final name
await session.browser.close(); srv.close();
log(`Done: ${outFile}  (${((Date.now() - started) / 1000 / 60).toFixed(1)} min, ${(fs.statSync(outFile).size / 1048576).toFixed(1)} MB)`);
