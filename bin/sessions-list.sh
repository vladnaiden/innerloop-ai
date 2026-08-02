#!/usr/bin/env bash
# sessions-list.sh — dated overview of every Claude Code session in the shared
# base (~/.claude/projects), newest first: when, which project, what it was about.
#
#   bash bin/sessions-list.sh            # 30 most recent across all projects
#   bash bin/sessions-list.sh -a         # everything
#   bash bin/sessions-list.sh obsidian   # only projects matching a substring
set -euo pipefail

LIMIT=30
FILTER=""
for arg in "$@"; do
  case "$arg" in
    -a|--all) LIMIT=0 ;;
    -h|--help) sed -n 's/^# \{0,1\}//p' "$0" | sed -n '2,7p'; exit 0 ;;
    *) FILTER="$arg" ;;
  esac
done

BASE="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects"
[ -d "$BASE" ] || { echo "no session base at $BASE" >&2; exit 1; }

BASE="$BASE" LIMIT="$LIMIT" FILTER="$FILTER" python3 - <<'PY'
import json, os, sys, time

base, limit, flt = os.environ["BASE"], int(os.environ["LIMIT"]), os.environ["FILTER"].lower()

def first_user_message(path):
    try:
        with open(path, errors="replace") as f:
            for line in f:
                try:
                    obj = json.loads(line)
                except ValueError:
                    continue
                if obj.get("type") != "user":
                    continue
                content = (obj.get("message") or {}).get("content")
                if isinstance(content, list):
                    content = next((c.get("text") for c in content
                                    if isinstance(c, dict) and c.get("type") == "text"), None)
                if not isinstance(content, str):
                    continue
                text = " ".join(content.split())
                # skip harness-generated entries (slash-command wrappers, caveats)
                if not text or text.startswith("<") or text.startswith("Caveat:"):
                    continue
                return text
    except OSError:
        pass
    return "(no user message)"

rows = []
for project in sorted(os.listdir(base)):
    pdir = os.path.join(base, project)
    if not os.path.isdir(pdir):
        continue
    name = project
    home_prefix = os.path.expanduser("~").replace("/", "-")
    for prefix in ("-workspaces-", home_prefix + "-"):
        if name.startswith(prefix):
            name = name[len(prefix):]
    if flt and flt not in name.lower():
        continue
    for f in os.listdir(pdir):
        if not f.endswith(".jsonl"):
            continue
        path = os.path.join(pdir, f)
        rows.append((os.path.getmtime(path), name, f[:8], path))

rows.sort(reverse=True)
dropped = 0
if limit and len(rows) > limit:
    dropped = len(rows) - limit
    rows = rows[:limit]

wname = max((len(r[1]) for r in rows), default=7)
for mtime, name, sid, path in rows:
    when = time.strftime("%Y-%m-%d %H:%M", time.localtime(mtime))
    snippet = first_user_message(path)
    if len(snippet) > 70:
        snippet = snippet[:69] + "…"
    print(f"{when}  {name:<{wname}}  {sid}  {snippet}")

if dropped:
    print(f"… and {dropped} older (use -a to show all)")
PY
