#!/usr/bin/env bash
# stop-hook.sh — the single Stop hook for InnerLoop.
#
# Replaces two hooks in .claude/settings.json that were both silently broken:
#
#   1. A `command` hook that did `echo 'WIKI_CHANGED: ...'` and exited 0.
#      Plain stdout from a command hook never reaches the model — only the
#      transcript UI. It had never once fired as intended.
#
#   2. A `prompt` hook carrying `"once": true` plus a "STEP 1: scan the
#      transcript for a prior /reflect offer" instruction. Both are no-ops:
#      `once` is honored only in skill frontmatter and is silently ignored in
#      settings files, and a prompt hook receives just the Stop event JSON —
#      never the transcript. So the judging model was asked to inspect
#      something it cannot see, and answered anyway. Observed result: the
#      reflect nudge fired on two consecutive turns of one session.
#
# The mechanism that actually reaches the model is a JSON object on stdout:
#   {"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"..."}}
# Nothing else may be printed to stdout.
#
# Once-per-session is enforced with a marker file keyed on session_id, which
# is the only deterministic option for a settings-declared hook.

set -uo pipefail

command -v jq >/dev/null 2>&1 || exit 0

payload=$(cat)
[ -n "$payload" ] || exit 0

session_id=$(printf '%s' "$payload" | jq -r '.session_id // empty')
transcript=$(printf '%s' "$payload" | jq -r '.transcript_path // empty')
stop_active=$(printf '%s' "$payload" | jq -r '.stop_hook_active // false')

# Already continuing because of a Stop hook — never re-fire into that loop.
[ "$stop_active" = "true" ] && exit 0

messages=()

# --- hot cache staleness -----------------------------------------------------
# Self-clearing: writing hot.md makes it the newest file, so this goes quiet on
# its own. No marker needed.
if [ -d wiki ] && [ -f wiki/hot.md ]; then
  stale=$(find wiki -name '*.md' ! -name 'hot.md' -newer wiki/hot.md 2>/dev/null | head -5)
  if [ -n "$stale" ]; then
    messages+=("These wiki pages are newer than wiki/hot.md (mtime check — the edits may be from a previous session): ${stale//$'\n'/, }. First check whether hot.md already covers their content; if it does, just run 'touch wiki/hot.md' to mark the cache fresh. Only if hot.md is actually out of date, rewrite it with a brief summary of what changed (under 500 words), using the hot cache format: Last Updated, Key Recent Facts, Recent Changes, Active Threads. Overwrite the file completely — it is a cache, not a journal.")
  fi
fi

# --- reflect nudge, at most once per session ---------------------------------
if [ -f wiki/LESSONS.md ] && [ -n "$session_id" ]; then
  marker_dir=".vault-meta/stop-nudge"
  marker="$marker_dir/$session_id"
  if [ ! -e "$marker" ]; then
    # Substantive proxy: count genuinely typed user turns. Tool results also
    # carry type "user" but their content is an array, not a string.
    turns=0
    if [ -n "$transcript" ] && [ -f "$transcript" ]; then
      turns=$(jq -s '[.[] | select(.type == "user")
                          | select(.message.content | type == "string")] | length' \
              "$transcript" 2>/dev/null || echo 0)
    fi
    if [ "${turns:-0}" -ge 2 ]; then
      mkdir -p "$marker_dir" 2>/dev/null && : > "$marker"
      find "$marker_dir" -type f -mtime +7 -delete 2>/dev/null
      messages+=("If this session produced a durable lesson about how to work with the user, or a new fact about them, offer /reflect once before the session ends. Offer only — never run it. If you have already offered it in this session, say nothing.")
    fi
  fi
fi

[ ${#messages[@]} -eq 0 ] && exit 0

printf '%s\n' "${messages[@]}" \
  | jq -Rs '{hookSpecificOutput: {hookEventName: "Stop", additionalContext: .}}'
