#!/usr/bin/env bash
# transcribe.sh — local audio→text via faster-whisper (large-v3-turbo, int8, CPU).
#
# Feature-gated on bin/setup-transcribe.sh having been run. Audio never leaves
# the machine; the model is cached under ~/.cache/huggingface after first use.
#
# Usage:
#   bash scripts/transcribe.sh <audio-file> [<audio-file>…]
#   bash scripts/transcribe.sh --outdir DIR <audio-file>…
#
# Output: one Markdown transcript per input, with frontmatter
# (source_type: audio-transcript, language, duration, model). Default outdir
# is the current directory; ingest flows typically pass --outdir under .raw/.
# Empty/unreadable inputs are reported and skipped (exit stays 0 unless ALL fail).

set -euo pipefail
cd "$(dirname "$0")/.."

VENV=.vault-meta/transcribe-venv
if [ ! -x "$VENV/bin/python" ]; then
  echo "transcribe: not provisioned — run: bash bin/setup-transcribe.sh" >&2
  exit 1
fi

OUTDIR=.
if [ "${1:-}" = "--outdir" ]; then OUTDIR=$2; shift 2; fi
[ $# -ge 1 ] || { echo "usage: transcribe.sh [--outdir DIR] <audio>…" >&2; exit 2; }
mkdir -p "$OUTDIR"

OUTDIR="$OUTDIR" "$VENV/bin/python" - "$@" <<'EOF'
import os, sys
from faster_whisper import WhisperModel

outdir = os.environ["OUTDIR"]
ok = fail = 0
model = None
for f in sys.argv[1:]:
    if not os.path.isfile(f) or os.path.getsize(f) == 0:
        print(f"SKIP (missing/empty): {f}", file=sys.stderr); fail += 1; continue
    if model is None:
        model = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8")
    try:
        segments, info = model.transcribe(f, vad_filter=True)
        name = os.path.splitext(os.path.basename(f))[0]
        out = os.path.join(outdir, f"audio-{name}.md")
        with open(out, "w") as w:
            w.write(f"---\nsource_type: audio-transcript\noriginal_file: {f}\n"
                    f"language: {info.language} (p={info.language_probability:.2f})\n"
                    f"duration_sec: {info.duration:.0f}\n"
                    f"model: faster-whisper large-v3-turbo int8\n---\n\n")
            for s in segments:
                w.write(f"[{s.start:7.1f}] {s.text.strip()}\n")
        print(f"OK {out} ({info.language}, {info.duration:.0f}s)")
        ok += 1
    except Exception as e:
        print(f"FAIL {f}: {e}", file=sys.stderr); fail += 1
sys.exit(0 if ok or not fail else 1)
EOF
