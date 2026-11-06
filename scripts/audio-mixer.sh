#!/usr/bin/env bash
# Final mix:  narration + music (auto-ducked under the voice) + SFX + ambience  ->  AAC, 48 kHz, stereo, -16 LUFS, -1.5 dBTP
# Stems stay separate in audio/ ; outputs go to build/audio/ :
#   mix.m4a (the master) and mix.wav (lossless, pre-AAC)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
A="$ROOT/audio"; OUT="$ROOT/build/audio"; mkdir -p "$OUT/stems"
NAR="$A/narration/narration.wav"; MUS="$A/music/background_music.mp3"
SFX="$A/sound-effects/sfx_track.flac"; AMB="$A/sound-effects/ambience.flac"
LOG() { echo "[audio $(date +%T)] $*"; }
# --- self-healing inputs: the big lossless files may not be in the repo ---
if [ ! -f "$NAR" ]; then
  for alt in "$A/narration/narration.flac" "$A/narration/narration.mp3"; do
    if [ -f "$alt" ]; then LOG "narration.wav missing - rebuilding from $(basename "$alt")"; ffmpeg -y -loglevel error -i "$alt" -ar 48000 -c:a pcm_s16le "$NAR"; break; fi
  done
fi
if [ ! -f "$SFX" ] || [ ! -f "$AMB" ]; then LOG "SFX/ambience stems missing - synthesising (needs python3-numpy)"; python3 "$ROOT/scripts/synth-audio.py"; fi
for f in "$NAR" "$MUS" "$SFX" "$AMB"; do [ -f "$f" ] || { echo "missing $f (need audio/narration/narration.wav|.flac|.mp3 and audio/music/background_music.mp3)" >&2; exit 1; }; done
LOG "mixing (duck music under narration with sidechain compression)"
GRAPH="
[0:a]aresample=48000,aformat=channel_layouts=stereo,asplit=2[nar][nsc];
[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=-9dB[mus0];
[mus0][nsc]sidechaincompress=threshold=0.02:ratio=9:attack=60:release=900:makeup=1[mus];
[2:a]aresample=48000,aformat=channel_layouts=stereo,volume=-8dB[sfx];
[3:a]aresample=48000,aformat=channel_layouts=stereo,volume=-24dB[amb];
[nar]highpass=f=70,acompressor=threshold=-20dB:ratio=2.2:attack=8:release=140:makeup=3[narp];
[narp][mus][sfx][amb]amix=inputs=4:normalize=0:duration=longest,alimiter=limit=0.89:level=disabled[mix]"
ffmpeg -y -hide_banner -loglevel error -i "$NAR" -i "$MUS" -i "$SFX" -i "$AMB" -filter_complex "$GRAPH" -map "[mix]" -ar 48000 -c:a pcm_s16le "$OUT/premix.wav"

LOG "loudnorm pass 1 (measure)"
STATS=$(ffmpeg -hide_banner -nostats -i "$OUT/premix.wav" -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g() { echo "$STATS" | grep "\"$1\"" | sed 's/[^0-9.-]*\([-0-9.]*\).*/\1/'; }
MI=$(g input_i); MTP=$(g input_tp); MLRA=$(g input_lra); MTH=$(g input_thresh); MOFF=$(g target_offset)
LOG "measured I=$MI TP=$MTP LRA=$MLRA"

LOG "loudnorm pass 2 (apply, linear) -> AAC"
ffmpeg -y -hide_banner -loglevel error -i "$OUT/premix.wav" \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=$MI:measured_TP=$MTP:measured_LRA=$MLRA:measured_thresh=$MTH:offset=$MOFF:linear=true,alimiter=limit=0.84:level=disabled,aresample=48000" \
  -ar 48000 -ac 2 -c:a pcm_s16le "$OUT/mix.wav"
ffmpeg -y -hide_banner -loglevel error -i "$OUT/mix.wav" -c:a aac -b:a 256k -ar 48000 -ac 2 "$OUT/mix.tmp.m4a" && mv "$OUT/mix.tmp.m4a" "$OUT/mix.m4a"
rm -f "$OUT/premix.wav"

LOG "verify"
ffmpeg -hide_banner -nostats -i "$OUT/mix.m4a" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I:|LRA:|Peak:)" | tail -3
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels,duration -of default=nw=1 "$OUT/mix.m4a"
LOG "done -> $OUT/mix.m4a"
