#!/usr/bin/env bash
# Never stops. Cycles the sources, syncs the site, then starts over.
#
# Previously each pass ended and nothing restarted it, so scraping only ran
# between check-ins. This keeps working regardless of whether anyone is looking:
# a finished pass rolls straight into the next source, and a crashed one is
# restarted on the next cycle rather than leaving the pipeline dead.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="${LOG:-/tmp/queue}"; mkdir -p "$LOG"
say() { echo "[$(date +%H:%M:%S)] $*" >> "$LOG/supervisor.log"; }

cycle=0
while true; do
  cycle=$((cycle+1))
  say "=== cycle $cycle start ==="

  # 1. offervault, partitioned by network — the bulk of the remaining catalogue
  node "$DIR/crawl_ov_networks.js" --delay 2500 --max-networks 12 >>"$LOG/networks.log" 2>&1
  say "networks pass exit=$?"
  # anything a bug dropped is still in the stored responses — put it back every cycle
  node "$DIR/repair_from_raw.js" >>"$LOG/networks.log" 2>&1

  # 1b. new listings on affpaying (resumable; a few pages per cycle keeps up with additions)
  node "$DIR/discover_affpaying.js" --pages 6 --delay 2500 >>"$LOG/discover.log" 2>&1

  # 2. the directory detail pages that carry fields the APIs do not publish
  node "$DIR/refetch_affpaying.js" --limit 800 --delay 2500 --shard 0/6 >>"$LOG/affpaying.log" 2>&1
  say "affpaying exit=$?"
  # parser improvements reach rows read before they existed — no fetch needed
  node "$DIR/requeue_stale.js" >>"$LOG/affpaying.log" 2>&1
  node "$DIR/reparse_stored.js" >>"$LOG/affpaying.log" 2>&1
  node "$DIR/scrape_reviews.js" --limit 150 --delay 2500 --max-pages 46 --shard 0/2 >>"$LOG/reviews.log" 2>&1
  say "reviews exit=$?"

  # 2b. the other directories (DACH, SaaS, UA): new pages plus anything older than 14 days
  bash "$DIR/sites_cycle.sh" >>"$LOG/sites.log" 2>&1; say "sites exit=$?"

  # 3. logos: one detail fetch per offervault network, then bytes from the CDN
  node "$DIR/ov_network_logos.js" --limit 40 --delay 3000 >>"$LOG/logos.log" 2>&1
  node "$DIR/fetch_logos.js" --limit 400 --delay 250      >>"$LOG/logos.log" 2>&1
  node "$DIR/ov_network_details.js" --limit 30 --delay 2500 >>"$LOG/logos.log" 2>&1
  node "$DIR/sync_logos.js"                               >>"$LOG/logos.log" 2>&1
  # 4. did the pipeline drop anything the pages publish? (stored pages, no fetch)
  node "$DIR/validate_page.js" --sample 15 >>"$LOG/validate.log" 2>&1; say "validate pages exit=$? (2 = misses logged)"
  node "$DIR/validate_ov.js" --sample 8 >>"$LOG/validate.log" 2>&1; say "validate offervault exit=$?"

  # publishing runs in publisher.sh on its own 15-min clock

  # a completed sweep means the easy slices are done; re-running finds the tail
  # that random ordering missed, so there is always useful work
  say "=== cycle $cycle done ==="
  sleep 20
done
