#!/usr/bin/env bash
# setup-embeddings.sh — enable LOCAL semantic reranking for /wiki-retrieve.
#
# The retrieve pipeline (bin/setup-retrieve.sh) already builds a BM25 index that
# works with zero dependencies. Its cosine-rerank stage is a no-op until a local
# embedding model is reachable. This script provisions that model — fully local,
# no data leaves the machine.
#
# Stack: ollama (local model server) + nomic-embed-text (embedding model).
#
# Usage:
#   bash bin/setup-embeddings.sh          # install ollama if missing, pull model, verify
#   bash bin/setup-embeddings.sh --check  # diagnostics only, no install
#
# After this succeeds, re-run:  bash bin/setup-retrieve.sh   (rerank stage activates)

set -euo pipefail
CHECK_ONLY=false
[ "${1:-}" = "--check" ] && CHECK_ONLY=true

say()  { printf '%s\n' "$@"; }
warn() { printf 'WARN: %s\n' "$@" >&2; }

say "═══ setup-embeddings (local semantic rerank) ═══"

OLLAMA_URL="${OLLAMA_HOST:-http://127.0.0.1:11434}"

reachable() { curl -s -m 2 "$OLLAMA_URL/api/tags" >/dev/null 2>&1; }

# ── 1. ollama binary ────────────────────────────────────────────────────────
if command -v ollama >/dev/null 2>&1; then
  say "✓ ollama installed: $(command -v ollama)"
else
  if $CHECK_ONLY; then
    warn "ollama NOT installed."
  else
    say "• ollama not found — installing (official script)…"
    if command -v curl >/dev/null 2>&1; then
      curl -fsSL https://ollama.com/install.sh | sh || {
        warn "Automatic install failed. Install manually: https://ollama.com/download"
        warn "On macOS host: 'brew install ollama'. This is a HOST-level daemon; a"
        warn "restricted container may not be able to run it — install on the host."
        exit 3
      }
    else
      warn "curl missing; install ollama manually: https://ollama.com/download"; exit 3
    fi
  fi
fi

# ── 2. server reachable ─────────────────────────────────────────────────────
if reachable; then
  say "✓ ollama server reachable at $OLLAMA_URL"
else
  if $CHECK_ONLY; then
    warn "ollama server not reachable at $OLLAMA_URL (start it with: ollama serve)"
  else
    say "• starting ollama server in background…"
    (ollama serve >/dev/null 2>&1 &) || true
    for i in 1 2 3 4 5 6 7 8; do reachable && break; sleep 1; done
    if reachable; then say "✓ ollama server up"; else
      warn "Could not reach ollama server. In a sandboxed container the daemon"
      warn "often cannot bind — run this script on the HOST, then point the container"
      warn "at it via OLLAMA_HOST if needed. BM25 retrieval keeps working meanwhile."
    fi
  fi
fi

# ── 3. embedding model ──────────────────────────────────────────────────────
MODEL="nomic-embed-text"
if reachable; then
  if curl -s -m 3 "$OLLAMA_URL/api/tags" | grep -q "$MODEL"; then
    say "✓ model '$MODEL' present"
  elif $CHECK_ONLY; then
    warn "model '$MODEL' not pulled yet (run without --check to pull)"
  else
    say "• pulling '$MODEL' (~275MB, one time)…"
    ollama pull "$MODEL" && say "✓ pulled '$MODEL'" || warn "pull failed; retry: ollama pull $MODEL"
  fi
fi

# ── 4. next step ────────────────────────────────────────────────────────────
say ""
if reachable && curl -s -m 3 "$OLLAMA_URL/api/tags" | grep -q "$MODEL"; then
  say "✅ Local embeddings ready. Activate rerank now:"
  say "     bash bin/setup-retrieve.sh"
  say "   Then /wiki-retrieve returns BM25 + cosine-reranked results — fully local."
else
  say "ℹ️  Embeddings not fully ready. /wiki-retrieve still works in BM25-only mode."
  say "   Most common cause: ollama is a host daemon and this is a container —"
  say "   run this script on the host (or install Ollama.app), then re-run setup-retrieve."
fi
