#!/usr/bin/env bash
# Rebuild narration.wav (48 kHz, 16-bit) from the lossless narration.flac shipped in the narration ZIP.
set -euo pipefail
cd "$(dirname "$0")/../audio/narration"
ffmpeg -y -loglevel error -i narration.flac -ar 48000 -c:a pcm_s16le narration.wav && echo "narration.wav restored"
