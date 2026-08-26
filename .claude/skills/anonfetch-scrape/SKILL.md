---
name: anonfetch-scrape
description: Fetch or crawl anything through the anonfetch anonymiser with throttle discipline — pool check first, probe one page, confirm selectors, small batches, and correct diagnosis when every exit aborts. Triggers on: use anonfetch, use the anonymiser, proxify, rotate headers/proxies, scrape/crawl/parse thousands of URLs, "check whether it works okay and you can use different proxies", anonfetch doctor, "stream has been aborted", "maybe I need to regenerate token".
allowed-tools: Bash Read Write Edit ToolSearch ReadMcpResourceTool mcp__anonfetch__anonfetch_status mcp__anonfetch__check_anonymity mcp__anonfetch__fetch_url mcp__anonfetch__fetch_batch mcp__anonfetch__job_status mcp__anonfetch__job_results mcp__anonfetch__job_cancel mcp__anonfetch__extract_html mcp__anonfetch__new_identity
---

# anonfetch-scrape — every scrape starts here

anonfetch is the only channel for Reddit and for anything that must not come from
this IP. It is an MCP server on the host (`http://host.docker.internal:8765/mcp`);
never add a direct fallback (plain reddit.com, mirrors, RSS proxies).

## 0. Is the chain alive? (30 s, do it every time)

```bash
curl -s -m 5 http://host.docker.internal:8765/health          # service up?
grep -c anonfetch ~/.claude/CLAUDE.md                          # block installed?
python3 -c "import json;print('anonfetch' in json.load(open('/home/node/.claude/.claude.json'))['mcpServers'])"
```
Missing → `curl -s http://host.docker.internal:8765/enroll | sh`, then tell the
user to restart Claude Code (tools are not live until restart).

In-session: `ReadMcpResourceTool anonfetch://guide` (generated live — the real
pool, countries, defaults) → `anonfetch_status {}`: `proxy.resolved` must not be
`direct`; read `diagnosis`, `proxy.warm` (exits with a proven auth) and
`proxy.authThrottledForMs` (must be 0 before you start). Rotation proof:
`python3 scripts/reddit-signals.py --check` or `check_anonymity` — **fewer distinct
IPs than samples is correct**: the pool reuses warm exits on purpose (below).

## 1. Throttle triage — it is the provider's *session cap*, not a request rate

Measured 25.08.2026 (curl straight at the Nord exits, bypassing anonfetch):
- The failure is **HTTP 407 on CONNECT** from the proxy itself. Older anonfetch
  showed it as `ERR_BAD_RESPONSE: stream has been aborted`; since the warm-exit
  build it is reported as `PROXY_AUTH_REJECTED`.
- The 407 carries `X-Proxy-Error: session_limit_reached`: **each distinct exit the
  account authenticates against holds a session slot for a while**, and the account
  has ~10. Not requests/second: a warm exit took 10 back-to-back requests (10/10),
  while 80 fresh-exit authentications in ~3 min filled the slots — after which
  *every* exit, including ones that worked minutes earlier, answered 407 for 20+ min.
  Other tools using the same credentials (the host's production server) share the cap.
- So **per-request rotation across 6,714 cold exits is the cause**, and "rotate
  harder / mint more identities" deepens it. The server now serves warm exits first,
  adds a cold one at most every 15 s up to `warmTarget` (6), and adds none while
  407s arrive. Any strategy is safe again; still prefer `sticky`/`pooled` and never
  `new_identity {count: N}` in bulk.
- Bad credentials fail from the very first request; a rate limit hits exits that
  just worked. Don't "regenerate the token" for a 407 storm.
- Test **two hosts at the same moment** (e.g. OpenAlex + the target). One OK, one
  failing → the target refuses datacenter IPs: route it direct (Adzuna, GDELT, arXiv
  are like this). Both failing → provider limit.
- Recover with `bash scripts/wait-for-pool.sh --max-minutes 12 -- <cmd>` (60 s polls
  on one sticky exit). **Never `sleep 1500`** — the user forbade long breaks
  ("maximum 5 minutes, or check every minute"). `anonfetch_client.py` backs off
  15/30/60/105 s on the same exit by itself before raising.
- Sporadic aborts on a healthy pool are normal (no TLS/JA3 spoofing); built-in retries absorb them.

## 2. Probe one page, then confirm selectors

```
fetch_url {url, saveToFile:"/data/<name>.html", extract:{...}}
extract_html {file:"/data/<name>.html", extract:{rowSelector:"...", fields:{title:"h2", url:{selector:"a", attr:"href"}}}}
```
- `saveToFile` paths live on the **anonfetch host** (`/data/…`), readable only via
  `extract_html` / `job_results` — not from this container.
- Body arrives under `html` / `text`, **not** `body`; `truncated: true` means cut at `maxChars`.
- Always pass `extract`; never pull raw HTML into the conversation.
- Run the drift watcher on ≥2 saved pages before trusting a field list
  (`node .devtools/schema_watch.js learn <source> p1.html p2.html`).

## 3. Batch small, page results, re-run misses

```
fetch_batch {urls:[≤20], concurrency:2, delayMs:2000, retries:2, strategy:"sticky", extract, saveToFile}
→ sleep 45–90 → job_status → job_results {includeExtracted:true, limit:5, offset:N}   (paged — output is big)
```
- Disable the `empty-body` block rule for tiny JSON responses (Reddit token ≈150 B).
- `job_cancel` on throttle; re-run only the misses in the next healthy window.
- Success ≈100 % in a clean window, 20–50 % while throttled — report `N/M captured, missing: […]`.

## 4. From code (not the MCP tools)

`scripts/anonfetch_client.py` (`AnonFetch`, `discover_anonfetch()` reads endpoint+token
from `~/.claude/.claude.json`; overrides `ANONFETCH_URL` / `ANONFETCH_TOKEN`;
throttle-aware: `THROTTLE_RE` + `THROTTLE_BACKOFF_S`, keeps the identity while backing off).
Server source: `repositories/mcp/anonfetch-mcp` (warm-first pool in `src/proxy/pool.ts`,
offline test `node scripts/test-pool-warm.js`; redeploy on the host with
`docker compose up -d --build`).
Node: `repositories/mcp/repositories/money-radar/tools/af.js` + `fetcher.js`
(THROTTLE regex `stream has been aborted|ECONNREFUSED|socket hang up|Proxy connection ended|ETIMEDOUT`,
BACKOFF `[45s,120s,240s,420s]`, sticky).

## 5. JS-rendered / CAPTCHA sites

Fall back to Playwright: `npx playwright install chromium && sudo npx playwright install-deps chromium`,
`chromium.launch({channel:'chromium', args:['--no-sandbox']})`, `TMPDIR=/workspaces/<proj>/tmp`
when `/tmp` is small (disk hit 100 % once). See `money-radar/tools/browse.js`.

## Reddit specifics
Only `.rss` works unauthenticated: `/r/X/new/.rss`, `/r/X/top/.rss?t=week`, `<post-url>.rss`
(body + comments). `/new.json` → 403, `www` HTML → JS shell, `old.reddit` → 403.
OAuth host `oauth.reddit.com` answers; creds live in `repositories/mcp/api-mcp/.env`.

## Output
Status line (pool green / throttled + diagnosis) · N/M URLs fetched · rows saved to `<path>` · misses to retry.
