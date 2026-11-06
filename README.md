# Webb Just Revealed a Terrifying Cosmic Cat's Head
8-minute cinematic science documentary for **Technical Talk India**, rendered entirely from real-time Three.js / WebGL2 scenes
(raymarched volumetric nebula, PBR Hubble and Webb models with shadows, HDR bloom / grain / chromatic post, procedural stars with
diffraction spikes, particle systems, cinematic camera rig). Every frame is a pure function of time, so chunks render in parallel.

## What you get
| Path | What |
|---|---|
| `audio/narration/` | `narration.wav` / `.mp3` (Kokoro TTS, voice `bm_george`), `script.json` (timestamped script), per-segment WAVs |
| `audio/music/background_music.mp3` | procedural ambient score (no samples, no licences) |
| `audio/sound-effects/` | individual SFX WAVs, `sfx_track.flac` (placed on the timeline), `ambience.flac`, `cues.json` |
| `subtitles/subtitles.srt` | 128 cues generated from the same timeline that drives the video |
| `src/` | scenes, camera rig, lighting/post, simulation (volume, stars, particles), UI overlays |
| `scripts/` | `render.js`, `audio-mixer.sh`, `generate-subtitles.js`, `generate-narration.py`, `synth-audio.py`, `validate.js` |
| `.github/workflows/render-video.yml` | one-click render: dropdown 4K / 1080p / Shorts |
| `docs/SOURCES.md` | NASA / ESA / STScI references and the real-vs-illustrative statement |

## Act structure (public/data/timeline.json)
0:00 hook, 0:20 mystery, 1:00 background, 2:30 discovery in 3D (Hubble / NIRCam / MIRI views), 4:30 details, 6:30 the revelation (the cat is temporary), 7:40 conclusion. Narration ends 7:55.

## Render on GitHub (recommended)
1. Push this folder to a GitHub repo. 2. Actions -> **Render documentary** -> Run workflow. 3. Pick **4K**, **1080p** or **Shorts** (and quality).
The workflow plans time chunks, renders them in parallel on headless Chromium (software WebGL via SwiftShader, no GPU needed), concatenates
with `-c copy`, muxes the mixed audio and uploads `webb_cats_head_<format>.mp4` plus SRT and audio files as an artifact.
Shorts is a true vertical recomposition (1080x1920) with large burned-in subtitles, not a crop.

**Expect long runs.** Software rendering measured ~9 s/frame at 1080p (low quality, 2-core sandbox); the video is 14,400 frames at 30 fps. The workflow
splits it into 10 s chunks (5 s for 4K) so each job stays under GitHub's 6 h limit; wall time depends on your runner concurrency
(`max_parallel`). If it is too slow use `quality: medium` or `low`.

## Local usage
```bash
npm ci
node scripts/render.js --stills 50,170,400 --format 1080p --quality medium   # check frames in build/stills/
node scripts/render.js --format 1080p --start 0 --end 10 --out build/test.mp4
bash scripts/audio-mixer.sh                 # -> build/audio/mix.m4a (-16 LUFS, <= -1.5 dBTP, AAC 48 kHz stereo)
node scripts/generate-subtitles.js && node scripts/validate.js
```
Needs Node 20+, FFmpeg, and Chrome/Chromium (`CHROME_PATH` if not in a standard location).

## Re-generating audio
- Music / SFX / ambience: `python3 scripts/synth-audio.py` (numpy + ffmpeg).
- Narration: `python3 scripts/generate-narration.py` needs `pip install kokoro-onnx soundfile` and the model files
  (`kokoro-v1.0.onnx`, `voices-v1.0.bin` from the `thewh1teagle/kokoro-onnx` release `model-files-v1.0`) in `~/.cache/kokoro-onnx`.
  Narration is committed, so CI does not need this. Swap in a human or other TTS voice by replacing `narration.wav` only if timings match `timeline.json`.

## Verified vs not verified
Verified here: all 16 scenes render stills in 1080p; Shorts layout checked; 12-frame H.264 test (1920x1080, 30 fps); audio mix measured at -16.0 LUFS, 48 kHz stereo AAC, 480 s; SRT validated; workflow YAML parses.
**Not** run here: a full-length render, a 4K render, or the workflow on GitHub (the sandbox is too slow). First CI run may need small fixes.
Known visual limits: faint stippling in the dense nebula at `low` quality, and a faint disc around the cat in wide Carina shots. Use `high` quality for finals.

## Science and honesty
The 3-D shapes are illustrative, not measurements; scenes carry on-screen tags saying so. No erosion timescale is claimed. See `docs/SOURCES.md`.
Imagery credit: NASA, ESA, CSA, STScI. Licence: MIT (code); see LICENSE note.

## Archive layout (upload size limits)
The delivery is 3 ZIPs that unpack into the same folder:
1. `webb-cats-head-1-project.zip` - everything except the big lossless audio.
2. `webb-cats-head-2-narration.zip` - `audio/narration/narration.flac`. Run `bash scripts/restore-audio.sh` to create `narration.wav`.
3. `webb-cats-head-3-sfx-stems.zip` - `sfx_track.flac`, `ambience.flac` (or just run `python3 scripts/synth-audio.py` to rebuild them).
