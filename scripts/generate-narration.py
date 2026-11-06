#!/usr/bin/env python3
"""
Generate documentary narration with Kokoro (open-source neural TTS, runs offline on CPU).

Reads  audio/narration/script.json
Writes audio/narration/seg_<id>.wav   (one file per narration segment, 48 kHz mono)
       audio/narration/narration.wav  (full timeline, 48 kHz mono, 16-bit)
       audio/narration/narration.mp3
       public/data/timeline.json      (exact timings for every act, scene, segment and sentence)

Every act starts at the time requested in the brief (00:00, 00:20, 01:00, 02:30, 04:30,
06:30, 07:40). Silence is padded so the act structure is exact; the script fails loudly if
an act's narration overruns its slot.

Model files (about 350 MB) are downloaded once from the kokoro-onnx GitHub release.
"""
import json, os, re, subprocess, sys, urllib.request
import numpy as np
from scipy.signal import resample_poly
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "audio", "narration", "script.json")
OUT_DIR = os.path.join(ROOT, "audio", "narration")
TIMELINE = os.path.join(ROOT, "public", "data", "timeline.json")
CACHE = os.environ.get("KOKORO_CACHE", os.path.expanduser("~/.cache/kokoro-onnx"))
BASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
SR_TTS, SR_OUT = 24000, 48000

def ensure_model():
    os.makedirs(CACHE, exist_ok=True)
    for f in ("kokoro-v1.0.onnx", "voices-v1.0.bin"):
        p = os.path.join(CACHE, f)
        if not os.path.exists(p) or os.path.getsize(p) < 1_000_000:
            print(f"[narration] downloading {f} ...", flush=True)
            urllib.request.urlretrieve(BASE + f, p)
    return os.path.join(CACHE, "kokoro-v1.0.onnx"), os.path.join(CACHE, "voices-v1.0.bin")

def parse_markup(text):
    """'{spoken|shown}' -> (spoken_text, shown_text)"""
    say = re.sub(r"\{([^|}]*)\|([^}]*)\}", r"\1", text)
    show = re.sub(r"\{([^|}]*)\|([^}]*)\}", r"\2", text)
    return say, show

def split_sentences(s):
    parts = re.split(r"(?<=[.!?])\s+", s.strip())
    return [p for p in parts if p]

def tidy(x):
    x = x.astype(np.float32)
    n = int(0.006 * SR_TTS)
    if len(x) > 2 * n:
        x[:n] *= np.linspace(0, 1, n); x[-n:] *= np.linspace(1, 0, n)
    return x

def main():
    from kokoro_onnx import Kokoro
    cfg = json.load(open(SCRIPT))
    model, voices = ensure_model()
    tts = Kokoro(model, voices)
    gap = cfg["sentence_gap"]
    total = cfg["total_duration"]
    timeline = {"title": cfg["title"], "channel": cfg["channel"], "duration": total, "fps": 30,
                "acts": [], "segments": [], "scenes": []}
    out = np.zeros(int(total * SR_OUT), dtype=np.float32)
    acts = cfg["acts"]
    scene_first = {}
    for ai, act in enumerate(acts):
        a_start = act["start"]
        a_end = acts[ai + 1]["start"] if ai + 1 < len(acts) else total
        t = a_start + (cfg["lead_in"] if a_start > 0 else 0.5)
        timeline["acts"].append({"id": act["id"], "title": act["title"], "start": a_start, "end": a_end})
        first_in_act = True
        for seg in act["segments"]:
            say, show = parse_markup(seg["text"])
            says, shows = split_sentences(say), split_sentences(show)
            assert len(says) == len(shows), f"sentence mismatch in {seg['id']}"
            seg_audio, sents, cursor = [], [], 0.0
            for s_say, s_show in zip(says, shows):
                samples, sr = tts.create(s_say, voice=cfg["voice"], speed=cfg["speed"], lang=cfg["lang"])
                assert sr == SR_TTS
                samples = tidy(samples)
                dur = len(samples) / SR_TTS
                sents.append({"start": round(t + cursor, 3), "end": round(t + cursor + dur, 3), "say": s_say, "show": s_show})
                seg_audio.append(samples)
                seg_audio.append(np.zeros(int(gap * SR_TTS), dtype=np.float32))
                cursor += dur + gap
            audio = np.concatenate(seg_audio[:-1])
            audio48 = resample_poly(audio, 2, 1).astype(np.float32)
            seg_end = t + len(audio) / SR_TTS
            i0 = int(round(t * SR_OUT))
            if i0 + len(audio48) > len(out):
                sys.exit(f"[narration] ERROR: {seg['id']} runs past the end of the video")
            out[i0:i0 + len(audio48)] += audio48
            sf.write(os.path.join(OUT_DIR, f"seg_{seg['id']}.wav"), audio48, SR_OUT, subtype="PCM_16")
            timeline["segments"].append({"id": seg["id"], "act": act["id"], "scene": seg["scene"],
                "start": round(t, 3), "end": round(seg_end, 3), "text": show, "sentences": sents})
            if seg["scene"] not in scene_first:
                scene_first[seg["scene"]] = a_start if first_in_act else max(a_start, round(t - 0.35, 3))
            first_in_act = False
            print(f"[narration] {seg['id']:>4} {t:7.2f} -> {seg_end:7.2f}  ({seg_end - t:5.2f}s)", flush=True)
            t = seg_end + seg["pause"]
        if t > a_end + 0.01:
            sys.exit(f"[narration] ERROR: act '{act['id']}' narration ends at {t:.2f}s but its slot ends at {a_end}s. Shorten the text or speed up.")
        print(f"[narration] act {act['id']:<11} ends {t:6.2f}s (slot ends {a_end}s, spare {a_end - t:5.2f}s)", flush=True)
    # scenes: start at first segment (or act start), end at the next scene's start
    order = sorted(scene_first.items(), key=lambda kv: kv[1])
    for i, (sid, st) in enumerate(order):
        en = order[i + 1][1] if i + 1 < len(order) else total
        timeline["scenes"].append({"id": sid, "start": st, "end": en})
    # light peak management then write files
    peak = float(np.max(np.abs(out))) or 1.0
    out = out / peak * 0.89
    wav = os.path.join(OUT_DIR, "narration.wav")
    sf.write(wav, out, SR_OUT, subtype="PCM_16")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libmp3lame", "-b:a", "192k",
                    os.path.join(OUT_DIR, "narration.mp3")], check=True)
    os.makedirs(os.path.dirname(TIMELINE), exist_ok=True)
    json.dump(timeline, open(TIMELINE, "w"), indent=1)
    words = sum(len(s["text"].split()) for s in timeline["segments"])
    print(f"[narration] done: {words} words, wrote narration.wav/mp3 and timeline.json", flush=True)

if __name__ == "__main__":
    main()
