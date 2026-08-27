#!/usr/bin/env bash
# One bounded pass over every directory site module. A site whose initial crawl is
# still running is skipped by the per-site lock (exit 3), not raced.
DIR="$(cd "$(dirname "$0")" && pwd)"
for f in "$DIR"/sites/[a-z]*.js; do
  s=$(basename "$f" .js)
  echo "[$(date +%H:%M:%S)] $s"
  node "$DIR/crawl_sites.js" --site "$s" --limit 150 --max-age-days 14
  echo "[$(date +%H:%M:%S)] $s exit=$?"
done
