#!/usr/bin/env bash
# relocate.sh — prove this directory can be moved on the host, and repair a move
# that happened before that was true.
#
# The engine is path-agnostic (relative hooks, relative scripts, address-keyed
# indexes). What is NOT path-agnostic lives outside the repo and is keyed by the
# repo's path *inside the container*:
#
#   1. ~/.claude/projects/<slug>/   — session transcripts + auto-memory, where
#      <slug> is that path with "/" turned into "-".
#   2. ~/.claude.json "projects" entry — bypass mode, prompt history, MCP wiring.
#   3. .devcontainer named volumes — Claude login, container settings, shell history.
#
# .devcontainer pins the container path and the volume names to a fixed project
# id, so none of the three can see a host move or rename. This script verifies
# that pinning still holds (and repairs state left over from an unpinned move).
#
# Usage:
#   bash bin/relocate.sh                         # audit: is a host move free?
#   bash bin/relocate.sh --fix --from /old/path  # repair, run from the new location
#   bash bin/relocate.sh --fix --from /old/path --dry-run
#
# Exit: 0 always in audit mode; read the OK/NOTE/ACT lines.

set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

CFG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
PROJECTS="$CFG/projects"
CFG_JSON="$CFG/.claude.json"
VENV=".vault-meta/transcribe-venv"
DC=".devcontainer/devcontainer.json"

MODE=check; FROM=""; DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --check)   MODE=check ;;
    --fix)     MODE=fix ;;
    --from)    FROM="${2:-}"; shift ;;
    --dry-run) DRY=1 ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

slug() { printf '%s' "$1" | tr '/' '-'; }

ok()   { printf '  \033[32mOK\033[0m    %s\n' "$1"; }
warn() { printf '  \033[33mNOTE\033[0m  %s\n' "$1"; }
act()  { printf '  \033[31mACT\033[0m   %s\n' "$1"; ISSUES=$((ISSUES+1)); }
ISSUES=0

# Reads .devcontainer/devcontainer.json (jsonc) and prints:
#   "<pinned_path 0|1> <pinned_volumes 0|1> <workspaceFolder>"
read_pinning() {
  python3 - "$DC" <<'PYEOF' 2>/dev/null || true
import json, re, sys
try:
    src = open(sys.argv[1]).read()
except OSError:
    sys.exit(0)
try:
    d = json.loads(re.sub(r"^\s*//.*$", "", src, flags=re.M))
except ValueError:
    sys.exit(0)
wf = d.get("workspaceFolder", "")
mounts = " ".join(d.get("mounts", [])) + d.get("workspaceMount", "")
print(int(bool(wf) and "${" not in wf),
      int("${localWorkspaceFolderBasename}" not in mounts),
      wf)
PYEOF
}

# ── audit ────────────────────────────────────────────────────────────────────
if [ "$MODE" = check ]; then
  echo "Move-safety audit for: $ROOT"
  echo

  # Read the container pin FIRST: whether the path is pinned decides how to read
  # every path reference found below. A reference to the pinned container path is
  # stable by construction; a reference to a host-derived path is not.
  set -- $(read_pinning)
  PINNED_PATH="${1:-0}"; PINNED_VOLS="${2:-0}"; WF="${3:-}"
  PINNED=0
  [ "$PINNED_PATH" = 1 ] && [ "$WF" = "$ROOT" ] && PINNED=1

  echo "Inside the repo"

  # devcontainer.json is the one place the path is written on purpose — it is
  # the pin that makes the container path independent of the host folder.
  hits=$(git grep -lI -F -- "$ROOT" -- . 2>/dev/null \
         | grep -Ev '^(bin/relocate\.sh|\.devcontainer/devcontainer\.json)$' || true)
  # Prose that names the pinned container path documents the pin; it is not
  # coupling to the host. The container path is fixed, so the text stays true
  # wherever the folder moves. Only executable/config files must stay relative.
  dochits=$(echo "$hits" | grep -Ei '\.(md|txt|rst)$' || true)
  codehits=$(echo "$hits" | grep -Eiv '\.(md|txt|rst)$' || true)
  if [ -z "$codehits" ]; then
    ok "no committed code hardcodes this path except the deliberate devcontainer pin (hooks + scripts are all relative)"
  else
    act "committed code hardcodes this path: $(echo "$codehits" | tr '\n' ' ')"
  fi
  if [ -n "$dochits" ]; then
    if [ "$PINNED" = 1 ]; then
      ok "docs name the pinned container path — documentation of the pin, still true after a move: $(echo "$dochits" | tr '\n' ' ')"
    else
      act "docs name this path but it is NOT pinned, so the text goes stale on a move: $(echo "$dochits" | tr '\n' ' ')"
    fi
  fi

  statehits=$(grep -rlI --exclude-dir=transcribe-venv -F -- "$ROOT" .vault-meta 2>/dev/null || true)
  if [ -z "$statehits" ]; then
    ok "vault state (.vault-meta indexes, locks, export state) is path-free"
  else
    act "vault state references this path: $(echo "$statehits" | tr '\n' ' ')"
  fi

  if [ -f .vault-meta/session-export-state.json ]; then
    if grep -q '\.jsonl"' .vault-meta/session-export-state.json; then
      act "session-export state is keyed by absolute path — a move re-exports every session into inbox/ as duplicates; run scripts/export-sessions.sh once to migrate it"
    else
      ok "session-export state is keyed by session id (survives any move)"
    fi
  fi

  if [ -d "$VENV" ]; then
    if [ -L "$VENV/bin/python3" ] \
       && case "$(readlink "$VENV/bin/python3")" in /*) true;; *) false;; esac \
       && "$VENV/bin/python" -c 'import faster_whisper' >/dev/null 2>&1; then
      ok "transcribe venv is relocatable (bin/python3 -> $(readlink "$VENV/bin/python3"); scripts call \$VENV/bin/python directly)"
      if [ "$PINNED" = 1 ]; then
        ok "its console shebangs (bin/pip, bin/ct2-*) point at the pinned container path, so they survive a host move too"
      else
        warn "its console shebangs (bin/pip, bin/ct2-*) hardcode this path — unused by the engine; --fix rewrites them"
      fi
    else
      act "transcribe venv is broken — rebuild: rm -rf $VENV && bash bin/setup-transcribe.sh"
    fi
  fi

  echo
  echo "Container binding ($DC)"
  if [ "$PINNED" = 1 ]; then
    ok "workspaceFolder is pinned to $WF — the repo lands on this exact path inside the container wherever it sits on the host and whatever the folder is called"
  elif [ "$PINNED_PATH" = 1 ]; then
    act "workspaceFolder pins $WF but this container runs at $ROOT — rebuild the container, or align the pin"
  else
    act "workspaceFolder is not pinned: the container path follows the host folder BASENAME, so a rename orphans everything below"
  fi
  if [ "$PINNED_VOLS" = 1 ]; then
    ok "named volumes use a fixed project id — Claude login, container settings and shell history survive a host move or rename"
  else
    act "volumes are named from the host folder basename — a rename hands you empty volumes (fresh Claude login, lost shell history)"
  fi

  # The pin protects a move only as long as it is on disk when the folder is
  # reopened. If it lives solely in the working tree, `git checkout`, a stash, or
  # a fresh clone silently restores the basename-derived config — and the audit
  # would still read green from the working tree. So check HEAD, not just disk.
  if [ "$PINNED" = 1 ] && git rev-parse --git-dir >/dev/null 2>&1; then
    if ! git diff --quiet HEAD -- "$DC" 2>/dev/null; then
      act "the pin is UNCOMMITTED — $DC differs from HEAD, so a fresh clone or 'git checkout' restores the unpinned config; commit it"
    else
      ok "the pin is committed — it survives a fresh clone, a stash or a checkout"
    fi
    if [ -n "$(git ls-files --others --exclude-standard -- bin/relocate.sh 2>/dev/null)" ]; then
      warn "bin/relocate.sh is untracked — a fresh clone gets no way to re-audit; git add it"
    fi
  fi

  echo
  echo "State keyed to the container path"
  s="$(slug "$ROOT")"
  if [ -d "$PROJECTS/$s" ]; then
    n=$(find "$PROJECTS/$s" -maxdepth 1 -name '*.jsonl' | wc -l | tr -d ' ')
    sz=$(du -sh "$PROJECTS/$s" 2>/dev/null | cut -f1)
    mem=""; [ -d "$PROJECTS/$s/memory" ] && mem=", auto-memory"
    sub=""
    for d in "$PROJECTS/$s"-*; do [ -d "$d" ] && sub="$sub $(basename "$d")"; done
    if [ "$PINNED" = 1 ]; then
      ok "$PROJECTS/$s — $n transcripts, $sz$mem: stays valid (the host path never enters this slug)"
      [ -n "$sub" ] && ok "sub-project sessions stay valid too:$sub"
    else
      act "$PROJECTS/$s — $n transcripts, $sz$mem: --fix must rename it after a move"
      [ -n "$sub" ] && act "sub-project sessions too:$sub"
    fi
  else
    ok "no session directory keyed to this path"
  fi

  if [ -f "$CFG_JSON" ] && ROOT="$ROOT" CFG_JSON="$CFG_JSON" python3 -c '
import json, os, sys
d = json.load(open(os.environ["CFG_JSON"]))
sys.exit(0 if os.environ["ROOT"] in d.get("projects", {}) else 1)' 2>/dev/null; then
    if [ "$PINNED" = 1 ]; then
      ok "$CFG_JSON project entry (bypass mode, prompt history) stays valid for the same reason"
    else
      act "$CFG_JSON holds a projects entry for this path (bypass mode, prompt history); --fix re-keys it"
    fi
  else
    ok "no per-project entry in $CFG_JSON"
  fi

  echo
  if [ "$ISSUES" -eq 0 ]; then
    echo "Free to move or rename on the host. Reopen the folder in the devcontainer:"
    echo "VS Code builds a container against the new host path, mounts it back at $ROOT,"
    echo "and reattaches the same volumes — history, memory and settings all intact."
    echo "(The container bound to the old host path lingers stopped; docker rm it at will.)"
  else
    echo "Fix the ACT lines above. If the move already happened, run from the NEW location:"
    echo "  bash bin/relocate.sh --fix --from /old/path"
  fi
  exit 0
fi

# ── repair ───────────────────────────────────────────────────────────────────
[ -n "$FROM" ] || { echo "--fix needs --from <old-absolute-path>" >&2; exit 2; }
case "$FROM" in /*) ;; *) echo "--from must be absolute: $FROM" >&2; exit 2 ;; esac
FROM="${FROM%/}"
[ "$FROM" != "$ROOT" ] || { echo "--from equals the current path ($ROOT) — nothing to repair" >&2; exit 2; }

run() { if [ "$DRY" = 1 ]; then echo "  would: $*"; else eval "$@"; fi; }
echo "Repairing after move: $FROM  ->  $ROOT"
[ "$DRY" = 1 ] && echo "(dry run)"

OS="$(slug "$FROM")"; NS="$(slug "$ROOT")"
moved=0
for d in "$PROJECTS/$OS" "$PROJECTS/$OS"-*; do
  [ -d "$d" ] || continue
  tgt="$PROJECTS/$NS$(basename "$d" | sed "s|^$OS||")"
  if [ -e "$tgt" ]; then
    echo "  SKIP  $(basename "$d") -> $(basename "$tgt") already exists; merge by hand"
    continue
  fi
  run "mv '$d' '$tgt'"
  [ "$DRY" = 1 ] || echo "  moved $(basename "$d") -> $(basename "$tgt")"
  moved=$((moved+1))
done
[ "$moved" -gt 0 ] || echo "  no session directory for the old path (already migrated, or a different HOME)"

if [ -f "$CFG_JSON" ]; then
  DRY="$DRY" FROM="$FROM" ROOT="$ROOT" CFG_JSON="$CFG_JSON" python3 - <<'PYEOF'
import json, os, shutil
f, root, cfg = os.environ["FROM"], os.environ["ROOT"], os.environ["CFG_JSON"]
d = json.load(open(cfg))
projects = d.get("projects", {})
if f not in projects:
    print("  no .claude.json entry for the old path")
elif root in projects:
    print("  SKIP  .claude.json already has an entry for the new path")
elif os.environ["DRY"] == "1":
    print(f"  would: re-key .claude.json projects[{f}] -> [{root}]")
else:
    shutil.copy2(cfg, cfg + ".relocate-bak")
    projects[root] = projects.pop(f)
    json.dump(d, open(cfg, "w"), indent=2)
    print(f"  re-keyed .claude.json projects entry (backup: {os.path.basename(cfg)}.relocate-bak)")
PYEOF
fi

if [ -d "$VENV" ]; then
  if "$VENV/bin/python" -c 'import faster_whisper' >/dev/null 2>&1; then
    run "grep -rlI -F -- '$FROM' '$VENV/bin' '$VENV/pyvenv.cfg' 2>/dev/null | xargs -r sed -i 's|$FROM|$ROOT|g'"
    [ "$DRY" = 1 ] || echo "  rewrote stale paths in venv scripts (transcription itself already worked)"
  else
    echo "  ACT   transcribe venv does not import — rebuild: rm -rf $VENV && bash bin/setup-transcribe.sh"
  fi
fi

run "bash scripts/wiki-lock.sh clear-stale --max-age 0 >/dev/null 2>&1 || true"
[ "$DRY" = 1 ] || echo "  cleared stale wiki locks"

if [ "$(basename "$FROM")" != "$(basename "$ROOT")" ]; then
  echo
  echo "  NOTE  folder renamed ($(basename "$FROM") -> $(basename "$ROOT")). With volumes pinned"
  echo "        to a project id this is a no-op; if they were still basename-derived, carry"
  echo "        the old ones over on the HOST:"
  echo "          docker run --rm -v $(basename "$FROM")-claude-config:/from -v $(basename "$ROOT")-claude-config:/to alpine cp -a /from/. /to/"
fi

echo
echo "Done. Re-audit with: bash bin/relocate.sh"
