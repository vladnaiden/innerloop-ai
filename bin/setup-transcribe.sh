#!/usr/bin/env bash
# setup-transcribe.sh — opt-in bootstrap for local audio→text transcription.
#
# Provisions faster-whisper (large-v3-turbo, int8, CPU) in a private venv so
# audio dropped into inbox/ can be transcribed fully locally — no egress of
# audio content. The only network use is the one-time model download from
# Hugging Face (~1.6 GB) on first transcription.
#
# What this does (in order):
#   1. Ensure python3 + venv + pip are available (apt-installs python3-pip
#      python3-venv via sudo if missing).
#   2. Create .vault-meta/transcribe-venv/ and `pip install faster-whisper`.
#   3. Smoke-check: import faster_whisper.
#
# After completion, callers feature-detect transcription by checking for
# .vault-meta/transcribe-venv/bin/python and use scripts/transcribe.sh.
#
# Fully opt-in. Doing nothing leaves the engine unchanged.
#
# Usage:
#   bash bin/setup-transcribe.sh
#   bash bin/setup-transcribe.sh --check   # diagnostics only; no provisioning

set -euo pipefail
cd "$(dirname "$0")/.."

VENV=.vault-meta/transcribe-venv

if [ "${1:-}" = "--check" ]; then
  if [ -x "$VENV/bin/python" ] && "$VENV/bin/python" -c 'import faster_whisper' 2>/dev/null; then
    echo "OK: faster-whisper ready ($VENV)"
  else
    echo "NOT PROVISIONED: run bash bin/setup-transcribe.sh"
    exit 1
  fi
  exit 0
fi

if ! python3 -m venv --help >/dev/null 2>&1 || ! python3 -m pip --version >/dev/null 2>&1; then
  echo "Installing python3-pip/python3-venv (requires sudo)…"
  sudo apt-get update -qq
  sudo apt-get install -y -qq python3-pip python3-venv
fi

[ -d "$VENV" ] || python3 -m venv "$VENV"
"$VENV/bin/pip" install -q --upgrade faster-whisper

"$VENV/bin/python" -c 'import faster_whisper' \
  && echo "OK: faster-whisper installed. Transcribe with: bash scripts/transcribe.sh <audio…>" \
  || { echo "FAILED: faster_whisper import"; exit 1; }
