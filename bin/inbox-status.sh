#!/usr/bin/env bash
# inbox-status.sh — show which raw notes in the inbox still need processing.
#
# Compares every file in the read-only inbox against the ingest manifest
# (.raw/.manifest.json, by content hash). Files whose hash is already recorded
# are DONE; the rest are PENDING and will be picked up next time you say
# "process inbox" to Claude.
#
# Usage:
#   bash bin/inbox-status.sh          # human-readable summary
#   bash bin/inbox-status.sh --pending # print only pending file paths (for scripts/Claude)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INBOX="${INBOX_DIR:-$ROOT/inbox}"
MANIFEST="$ROOT/.raw/.manifest.json"
MODE="${1:-}"

[ -d "$INBOX" ] || { echo "ERR: inbox not found at $INBOX (create inbox/ in the repo root)" >&2; exit 1; }

python3 - "$INBOX" "$MANIFEST" "$MODE" <<'PY'
import sys, os, json, hashlib

inbox, manifest_path, mode = sys.argv[1], sys.argv[2], sys.argv[3]

# collect every content hash the manifest already knows (md5 and sha1 tolerated)
known = set()
if os.path.exists(manifest_path):
    try:
        m = json.load(open(manifest_path))
        for s in m.get("sources", {}).values():
            h = s.get("hash")
            if h: known.add(h)
    except Exception:
        pass

def md5(p):
    h = hashlib.md5()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()

pending, done = [], []
for root, _, files in os.walk(inbox):
    for fn in files:
        if fn.startswith("."):        # skip .DS_Store etc.
            continue
        p = os.path.join(root, fn)
        rel = os.path.relpath(p, inbox)
        (done if md5(p) in known else pending).append(rel)

if mode == "--pending":
    for p in sorted(pending):
        print(p)
    sys.exit(0)

print(f"Inbox: {inbox}")
print(f"  ✓ already processed: {len(done)}")
print(f"  ● PENDING (need processing): {len(pending)}")
if pending:
    print()
    for p in sorted(pending):
        print(f"    ● {p}")
    print()
    print('  → Tell Claude: "process inbox"  (or /wiki-ingest)')
else:
    print("  Nothing to process — inbox is fully ingested. ✅")
PY
