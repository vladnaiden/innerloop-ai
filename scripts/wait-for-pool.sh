#!/usr/bin/env bash
# wait-for-pool.sh — poll anonfetch every 60s and run a command the moment the
# proxy pool is healthy again, instead of guessing a long sleep.
#
# NordVPN rate-limits how many distinct exits one account authenticates against
# in a short window; once tripped every exit answers 407 (the server reports
# PROXY_AUTH_REJECTED) for several minutes — measured 25.08.2026: >5 min after a
# burst of ~80 cold-exit authentications. Recovery time is not predictable, so a
# fixed sleep is either too short (the run fails) or too long (dead waiting).
# Polling costs two cheap requests a minute on ONE sticky exit — a per-request
# probe would authenticate two fresh exits per poll and prolong the lockout.
#
#   bash scripts/wait-for-pool.sh [--max-minutes N] -- <command...>
set -uo pipefail

MAX=20
ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --max-minutes) MAX="${2:?}"; shift 2 ;;
    --) shift; ARGS=("$@"); break ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done
[ ${#ARGS[@]} -gt 0 ] || { echo "nothing to run; use -- <command>" >&2; exit 2; }

cd "$(dirname "${BASH_SOURCE[0]}")/.."

probe() {
  python3 - <<'PY'
import os, sys
sys.path.insert(0, os.path.join(os.getcwd(), 'scripts'))
import anonfetch_client as af
try:
    url, token = af.discover_anonfetch()
    af.set_client(af.AnonFetch(url, token, rotation="sticky", client_name="pool-probe",
                               throttle_backoff=()))   # the loop below is the backoff
    # Two different hosts: one alone can be down for its own reasons, and a
    # single failure would then read as a throttle that isn't there.
    af.fetch_json("https://hn.algolia.com/api/v1/search?query=test&hitsPerPage=1")
    af.fetch_json("https://api.openalex.org/works?per_page=1")
except Exception as e:
    print(str(e)[:80], file=sys.stderr)
    sys.exit(1)
PY
}

for i in $(seq 1 "$MAX"); do
  if probe 2>/dev/null; then
    echo "[$(date +%H:%M:%S)] pool healthy on attempt $i — starting" >&2
    exec "${ARGS[@]}"
  fi
  echo "[$(date +%H:%M:%S)] attempt $i/$MAX: still throttled, retry in 60s" >&2
  sleep 60
done
echo "pool never recovered in ${MAX} minutes — not starting" >&2
exit 1
