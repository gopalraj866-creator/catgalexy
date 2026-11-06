#!/usr/bin/env python3
"""Procedural score, ambience and sound effects (numpy only, fully deterministic, no samples / no licences).
Outputs (48 kHz stereo):
  audio/music/background_music.mp3   evolving ambient score, 8:00, chord per act, swell at the revelation
  audio/sound-effects/*.wav          individual SFX (whoosh, riser, impact, shimmer, click, sub_drop, ping)
  audio/sound-effects/sfx_track.wav  all SFX placed on the timeline from public/data/timeline.json
  audio/sound-effects/ambience.wav   deep-space drone + faint noise bed
  audio/sound-effects/cues.json      cue sheet (time, file, gain)
"""
import json, subprocess, sys, wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
tl = json.loads((ROOT / 'public/data/timeline.json').read_text())
DUR = tl['duration']
N = int(DUR * SR)
rng = np.random.default_rng(2026)
t_full = np.arange(N) / SR

def write_wav(path, x):
    x = np.clip(x, -1, 1)
    if x.ndim == 1: x = np.stack([x, x], 1)
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype('<i2').tobytes())

def env(n, a, r):
    e = np.ones(n); na, nr = int(a * SR), int(r * SR)
    if na: e[:na] = np.linspace(0, 1, na) ** 2
    if nr: e[-nr:] = np.linspace(1, 0, nr) ** 2
    return e

def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.zeros_like(x); s = 0.0
    for i in range(len(x)): s = (1 - a) * x[i] + a * s; y[i] = s
    return y

def fast_lp(x, fc):  # FFT brick-wall-ish lowpass, quick for long arrays
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (f / fc) ** 4); return np.fft.irfft(X, len(x))

def stereo(x, width=0.4):
    d = int(0.012 * SR); r = np.roll(x, d)
    return np.stack([x * (1 - width / 2) + r * width / 2, r * (1 - width / 2) + x * width / 2], 1)

# ------------------------------------------------------------------ SFX
def whoosh(dur=2.2):
    n = int(dur * SR); x = rng.standard_normal(n); out = np.zeros(n)
    for fc, g in ((300, 1.0), (1200, 0.6), (4000, 0.3)):
        out += fast_lp(x, fc) * g
    sweep = np.sin(np.pi * np.linspace(0, 1, n)) ** 2
    return stereo(out * sweep * 0.5 / (np.abs(out).max() + 1e-9), 0.8)

def riser(dur=4.0):
    n = int(dur * SR); t = np.arange(n) / SR; k = t / dur
    f = 80 * (2 ** (k * 4.2)); ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * 0.5 + np.sin(ph * 1.5) * 0.25 + fast_lp(rng.standard_normal(n), 2500) * 0.25 * k
    return stereo(x * k ** 2 * 0.7, 0.6)

def impact(dur=3.0):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 55 * np.exp(-t * 1.4) + 28; ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * 1.6) + fast_lp(rng.standard_normal(n), 400) * np.exp(-t * 6) * 0.6
    return stereo(x * 0.9, 0.3)

def shimmer(dur=3.5):
    n = int(dur * SR); t = np.arange(n) / SR; x = np.zeros(n)
    for f in (880, 1318.5, 1760, 2637, 3520):
        x += np.sin(2 * np.pi * f * t + rng.random() * 6.28) * rng.uniform(.4, 1) * (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(.3, 1.2) * t))
    return stereo(x * env(n, 0.6, 1.8) * 0.12, 0.9)

def click(dur=0.25):
    n = int(dur * SR); t = np.arange(n) / SR
    return stereo(np.sin(2 * np.pi * 1900 * t) * np.exp(-t * 60) * 0.5, 0.2)

def sub_drop(dur=2.5):
    n = int(dur * SR); t = np.arange(n) / SR; f = 90 * np.exp(-t * 1.2) + 24
    return stereo(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .02, 1.0) * 0.8, 0.2)

def ping(dur=2.0):
    n = int(dur * SR); t = np.arange(n) / SR
    return stereo((np.sin(2 * np.pi * 1568 * t) + 0.4 * np.sin(2 * np.pi * 2349 * t)) * np.exp(-t * 2.2) * 0.35, 0.5)

SFX = dict(whoosh=whoosh, riser=riser, impact=impact, shimmer=shimmer, click=click, sub_drop=sub_drop, ping=ping)
out_sfx = ROOT / 'audio/sound-effects'; out_sfx.mkdir(parents=True, exist_ok=True)
(ROOT / 'audio/music').mkdir(parents=True, exist_ok=True)
bank = {k: f() for k, f in SFX.items()}
for k, v in bank.items(): write_wav(out_sfx / f'{k}.wav', v)

# ------------------------------------------------------------------ cue sheet from the timeline
sc = {s['id']: s for s in tl['scenes']}
seg = {s['id']: s for s in tl['segments']}
cues = []
def cue(t, name, gain=1.0, pre=0.0): cues.append(dict(time=round(max(t - pre, 0), 3), file=f'{name}.wav', gain=gain))
cue(0.2, 'sub_drop', 0.9)
for s in tl['scenes']:
    if s['start'] > 1: cue(s['start'], 'whoosh', 0.55, pre=0.9)
cue(sc['carina']['start'], 'shimmer', 0.6)
cue(sc['telescopes']['start'], 'ping', 0.5)
cue(sc['dustdemo']['start'], 'shimmer', 0.5)
cue(sc['hubbleview']['start'], 'click', 0.7); cue(sc['nircamview']['start'], 'click', 0.7); cue(sc['miriview']['start'], 'click', 0.7)
cue(sc['eye']['start'], 'riser', 0.7, pre=3.6); cue(sc['eye']['start'], 'impact', 0.55)
cue(sc['erosion']['start'], 'riser', 0.8, pre=3.8); cue(sc['erosion']['start'], 'impact', 0.9)
if 'r6' in seg: cue(seg['r6']['start'] + 1.0, 'shimmer', 0.8)
cue(sc['outro']['start'], 'shimmer', 0.6); cue(sc['outro']['start'] + 14, 'ping', 0.5)
cues.sort(key=lambda c: c['time'])
(out_sfx / 'cues.json').write_text(json.dumps(cues, indent=1))
track = np.zeros((N, 2))
for c in cues:
    x = bank[c['file'][:-4]] * c['gain']; i = int(c['time'] * SR); j = min(i + len(x), N)
    track[i:j] += x[:j - i]
write_wav(out_sfx / 'sfx_track.wav', track * 0.9)

# ------------------------------------------------------------------ ambience: sub drone + filtered noise
amb = np.zeros(N)
for f, g in ((43.65, .5), (65.4, .35), (87.3, .2)):
    amb += np.sin(2 * np.pi * f * t_full + 0.3 * np.sin(2 * np.pi * 0.05 * t_full)) * g * (0.7 + 0.3 * np.sin(2 * np.pi * 0.021 * t_full + f))
noise = fast_lp(rng.standard_normal(N), 900) * 0.6
amb = amb * 0.5 + noise * 0.25
write_wav(out_sfx / 'ambience.wav', stereo(amb * 0.5, 0.9))

# ------------------------------------------------------------------ music: slow pad chords per act
chords = {  # MIDI roots; mood follows the narrative (wonder -> mystery -> awe -> revelation -> calm)
    'hook': [50, 57, 62, 65], 'intro': [45, 52, 57, 60], 'background': [48, 55, 60, 64], 'main': [43, 50, 55, 59],
    'details': [46, 53, 58, 62], 'revelation': [41, 48, 53, 56], 'conclusion': [48, 55, 60, 67], 'outro': [48, 55, 60, 67],
}
mf = lambda m: 440 * 2 ** ((m - 69) / 12)
music = np.zeros((N, 2))
acts = tl['acts']
for a in acts:
    ch = chords.get(a.get('id') or a.get('name'), chords['background'])
    i0, i1 = int(a['start'] * SR), int(min(a['end'] + 3, DUR) * SR); n = i1 - i0; t = np.arange(n) / SR
    pad = np.zeros((n, 2))
    for k, m in enumerate(ch):
        for det, side in ((-0.15, 0), (0.0, 0), (0.15, 1)):
            f = mf(m) * 2 ** (det / 12)
            lfo = 0.6 + 0.4 * np.sin(2 * np.pi * (0.05 + 0.013 * k) * t + k)
            x = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.15 * np.sin(2 * np.pi * 3 * f * t)) * lfo / (1 + k * .3)
            pad[:, 0] += x * (1 - 0.35 * side); pad[:, 1] += x * (0.65 + 0.35 * side)
    bassf = mf(ch[0] - 12); bass = np.sin(2 * np.pi * bassf * t) * 0.6
    pad[:, 0] += bass; pad[:, 1] += bass
    e = env(n, 3.0, 3.0)
    if (a.get('id') or a.get('name')) == 'revelation':
        e = e * (0.75 + 0.5 * np.linspace(0, 1, n) ** 1.5)
    music[i0:i1] += pad * e[:, None]
# slow sparkle arpeggio over the top (very quiet)
for k in range(int(DUR / 5.3)):
    tt = 4 + k * 5.3; m = [74, 77, 81, 69, 79][k % 5]; i = int(tt * SR); n = int(4 * SR)
    if i + n >= N: break
    x = np.sin(2 * np.pi * mf(m) * np.arange(n) / SR) * np.exp(-np.arange(n) / SR * 1.1) * 0.06
    music[i:i + n, k % 2] += x; music[i:i + n, (k + 1) % 2] += x * 0.4
music = np.stack([fast_lp(music[:, 0], 5000), fast_lp(music[:, 1], 5000)], 1)
music *= 0.8 / (np.abs(music).max() + 1e-9)
fade = np.minimum(1, np.minimum(t_full / 3, (DUR - t_full) / 5))
music *= fade[:, None]
tmp = ROOT / 'audio/music/_music.wav'; write_wav(tmp, music)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(tmp), '-ar', '48000', '-ac', '2', '-b:a', '192k', str(ROOT / 'audio/music/background_music.mp3')], check=True)
tmp.rename(ROOT / 'audio/music/background_music.wav')
print('audio synthesised:', len(cues), 'SFX cues,', f'{DUR:.1f}s')

# long stems are stored as FLAC (lossless, ~10x smaller than WAV)
for nm in ('sfx_track', 'ambience'):
    w = out_sfx / f'{nm}.wav'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(w), str(out_sfx / f'{nm}.flac')], check=True); w.unlink()
(ROOT / 'audio/music/background_music.wav').unlink(missing_ok=True)
