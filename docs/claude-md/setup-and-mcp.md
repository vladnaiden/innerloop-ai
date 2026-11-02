## Setup

- Fresh clone: post-create seeds an empty brain from `templates/`.
- Semantic rerank (optional, local, no egress): `bash bin/setup-embeddings.sh`.
- Audio→text (optional, local, no egress): `bash bin/setup-transcribe.sh`, then
  `bash scripts/transcribe.sh [--outdir DIR] <audio…>` (faster-whisper large-v3-turbo int8).
- Image→text (local, no egress): `bash scripts/ocr-images.sh [--ext jpg,png,dat]
  [--path-glob '*/photos/*'] [--jobs N] [--auto-rotate] <src-dir> <out-dir>` (tesseract
  eng+rus+ukr, mirrors the source tree, resumable). Use `--auto-rotate` for photographed
  pages — it OCRs all four orientations and keeps the best by stopword hits; without it a
  sideways scan silently yields mirror-text garbage that looks like output. `scripts/ocr-dataexport.sh <export-dir> <out-dir>`
  is the Telegram-DataExport wrapper.
- Retrieval index: `bash bin/setup-retrieve.sh`.
- **Pharmacy / supplement / biomedical data (added 09.10.2026).** Two MCP servers registered at
  user scope in this container (`claude mcp list` → `api`, `biomcp`), both stdio, no keys:
  - `api` = api-mcp (`repositories/mcp/api-mcp`, `node dist/index.js`, `API_MCP_HOME=~/.claude/api-mcp`;
    the host `:7100` service is usually down, so stdio is the live path). New connectors:
    `dsld.search` → `dsld.label` (NIH supplement labels: every ingredient + dose per serving — "what is
    actually in this bottle"), `dsld.ingredient_groups`; `openfda.label` (FDA drug labels: dosage,
    warnings, interactions), `openfda.event_counts` / `events` (FAERS reports — *reports*, never "risk"),
    `openfda.supplement_events` (CAERS, dietary supplements), `openfda.recalls`. CLI test path:
    `node repositories/mcp/api-mcp/dist/cli.js call dsld.search q="lion's mane"`.
  - `biomcp` = genomoncology BioMCP (PubMed/Europe PMC, ClinicalTrials.gov, DrugBank via MyChem, genes,
    variants). Installed as a uv tool inside the persistent `.claude` volume
    (`~/.claude/uv/bin/biomcp`, `~/.claude/bin/uv`); `post-create.sh` reinstalls if missing. CLI:
    `biomcp article search -k "vitamin B12" -k memory`, `biomcp drug get metformin`.
  - **Державний реєстр лікарських засобів** (МОЗ, data.gov.ua) is a cp1251 CSV, not an API → loaded
    into pg-app as `ua_drug_registry` (16,463 rows, resource 2026-01-21). Query:
    `python3 scripts/ua-drugs.py search|inn|atc <term> [--json] [--expired]` (the DB collation is C, so the script folds
    Cyrillic case itself — never query the table with a bare ILIKE on trade names); refresh:
    `bash scripts/ua-drug-registry-load.sh` (picks the newest CSV on data.gov.ua, replaces the table).
  - Rejected: NIH ODS fact-sheet API (Cloudflare 403 from here and through every anonfetch exit — use
    `biomcp article search` for the evidence instead); Examine / ConsumerLab / Labdoor (paid, no API);
    tabletki.ua / apteka911 (scrape-only). Details and rejections: `connectors/SOURCES.md`.
- **mcp-hub (added 11.10.2026) — the local stdio MCP servers run behind ONE HTTP endpoint, on demand.** Claude Code starts
  every configured stdio server per session and never stops it; 7 sessions × 12 local servers = 91 processes / 3.9 GB and the
  container swapped itself to load 20. `repositories/mcp/mcp-hub` (same skeleton as anonfetch-mcp) is registered once at user
  scope as `hub` (`http://127.0.0.1:7200/mcp`, bearer token in `~/.claude/mcp-hub/token`); the registry is data
  (`servers.json`: github, api, biomcp, dataforseo, google-analytics, search-console, clarity, google-ads, yahoo-finance,
  sec-edgar, bybit, binance, backlink-guard). A child starts on the first tool call and stops after 10 idle minutes; tool lists are cached
  (`--warm`), so `tools/list` spawns nothing. Tools are `mcp__hub__<server>__<tool>` (e.g. `hub__search-console__list_properties`
  → `search-console__list_properties`); `hub_status` / `hub_refresh` / `hub_stop` are the hub's own. Control:
  `bash bin/mcp-hub.sh ensure|status|restart|warm|logs|enroll` (SessionStart hook runs `ensure`). **Do not re-add those 12 as
  stdio servers** — add a new local server to `servers.json` instead, then `restart` + `warm <name>`. Another container:
  `curl -s http://127.0.0.1:7200/enroll | sh` (it also removes the stdio duplicates there). Host mode (hub on the Mac beside
  anonfetch, reached as `host.docker.internal:7200`) is the next step and is not done yet — see the package README.
- **Internet Archive / Wayback Machine MCPs (added 19.10.2026), behind mcp-hub** (`servers.json`: `wayback`, `internet-archive`;
  packages in the persistent `~/.claude/npm` prefix, reinstalled by `post-create.sh`; no keys). Use them when a live page is
  Cloudflare-walled, gone, or when the question is "what did this page say on <date>". `wayback__*` = Mearman/mcp-wayback-machine
  3.7.1 (59★, 5k dl/mo, CC BY-NC-SA 4.0 — personal/research use, not for the commercial site): `check_archive_status`,
  `search_archives` (CDX; `filter: "statuscode:200"`, `limit`), `get_archived_url` (snapshot body nearest a `timestamp`),
  `compare_snapshots`, `list_screenshots`, `save_url` (SPN2). `internet-archive__*` = cyanheads/internet-archive-mcp-server 0.4.0
  (Apache-2.0): `ia_find_snapshots` / `ia_get_snapshot` (Wayback), `ia_search_items` (40M+ library items), `ia_get_item`,
  `ia_get_text` (OCR text of books). Gotchas: archive.org's `/wayback/available` endpoint 429s often — the CDX tools are the
  reliable path (`ia_find_snapshots` with `mode: "history"`, not `closest`); `check_archive_status` fails on a zod schema
  error in 3.7.1 (the sparkline API now returns arrays) — use `search_archives` instead; `search_archives.filter` is an
  array; a burst of raw curl calls gets the container IP 429'd for a few minutes on every endpoint; a raw `id_` snapshot fetched with curl may arrive gzip-encoded (gunzip before parsing); the archive is
  volunteer-run — no batches, no polling. Rejected: pl974/mcp-wayback-machine (0★, fork-like, one commit), wayback-mcp on npm
  (mrfentmen/premium-mcps, 675 dl, no track record), lakshyamehta03 / sisilet / Dthen / smeet666 (1–4★ Python/TS duplicates of
  the same six public endpoints), waybackpy (library, not an MCP). No official Internet Archive MCP exists. Re-add in another
  container: the hub enroll line (`curl -s http://127.0.0.1:7200/enroll | sh`) carries them; standalone fallback:
  `claude mcp add --scope user wayback -- ~/.claude/npm/node_modules/.bin/mcp-wayback-machine`.
- **LinkedIn via MCP (added 26.10.2026), behind mcp-hub as `linkedin`** — stickerdaniel/linkedin-mcp-server 4.28 (Apache-2.0, 4k★),
  the owner's own browser session, installed as a uv tool in `~/.claude/uv` and launched by `bin/linkedin-mcp.sh` (headed Chromium on
  `Xvfb :99`, `LINKEDIN_MCP_CONTAINER=true`, profile in `~/.claude/linkedin-mcp/profile`, browsers in `~/.claude/patchright-browsers`).
  Tools `mcp__hub__linkedin__*`: `get_my_profile` (`sections=experience,education,skills,projects,certifications,languages,honors,interests,contact_info,posts`),
  `get_person_profile`, `get_inbox`, `get_conversation`, `search_conversations`, `get_saved_jobs`, `search_jobs`, `get_job_details`,
  `get_company_profile`, `search_people`, `get_feed`, `search_posts`. **Read-only by policy: never `send_message` or `connect_with_person`;
  few calls, one process at a time (a parallel start makes the other report "No valid LinkedIn session"), never through Nord** — LinkedIn
  forbids automation and scores the login IP, so the session was created on the home IP. Re-login when tools ask for authentication:
  `bash bin/linkedin-mcp.sh --login` → open the printed `http://127.0.0.1:6080/vnc_lite.html#…token=…` URL (port 6080 is forwarded), sign in.
  `--status` checks the session. First dump: `input/26.10.2026/linkedin/`. Djinni/DOU have no API; MCP candidates found 27.10.2026 (all 0★, MIT unless noted, fork-and-improve material): `Propsi4/salary-mcp` (PyPI `salary-mcp`, Djinni+DOU salary stats only), `kaidashova/job-assistant-mcp` (DOU+Djinni RSS search, scoring, SQLite tracker, MCP SDK v2, Docker/HTTP), `dvoichuck/ai-job-hunt-kit-public` (Playwright on your session: djinni-mcp 15 tools incl. input/apply/send_message, dou-mcp with external-ATS apply; no licence, Cursor-oriented), `xsponenta/jobs_helper_MCP` (course project: DOU/Djinni/Happy Monday RSS + Playwright apply with submit policy); code review 27.10.2026 + safety audit 28.10.2026 in `docs/reviews/djinni-dou-mcp-review-27.10.2026.md`. **Djinni/DOU inboxes (28.10.2026), behind mcp-hub as `jobboards`:** our own package `repositories/mcp/jobboards-inbox-mcp` (a rewrite after auditing dvoichuck's kit — not malicious, but arbitrary-URL navigation with the session, input screenshots on every call, apply tools, no tests), editable uv tool, launcher `bin/jobboards-mcp.sh`, patchright headed on Xvfb `:99`, sessions in `~/.claude/jobboards-inbox/<site>/profile` created with `bash bin/jobboards-mcp.sh --login djinni|dou` (noVNC :6080). Tools `mcp__hub__jobboards__*`: `session_status`, `list_inbox`, `read_thread`, `my_applications` (Djinni), `send_message`, `policy_status`. Hosts pinned to djinni.co / dou.ua (https only, checked before and after navigation). **Send policy `JOBBOARDS_SEND_POLICY` = `draft` (default, never sends) | `confirm` (Claude registers a draft, **the owner runs `bash bin/jobboards-mcp.sh --approve <id>` himself**, then a second call with `pending_id` sends once; `--pending` / `--reject`) | `auto`; daily cap `JOBBOARDS_DAILY_SEND_CAP`=10; every attempt logged to `~/.claude/jobboards-inbox/sent.jsonl`.** Both sites forbid automation: few calls, human pace, never via Nord; no apply, no profile edits. Tests: `uv run --extra test -- pytest` in the package. Djinni's candidate side is behind login, but his own public card `/q/<id>/` is open (anonfetch) — saved pages into the input are the other route.
- **GitHub via MCP** (`github` server, user scope, added 27.09.2026): `bin/github-mcp.sh` installs the
  official `github/github-mcp-server` binary into `~/.local/bin` and feeds it the token from `gh auth token`
  (no token in any config file). Tools `mcp__github__*` (issues, PRs, actions, code search, releases…).
  Re-register in another container: `claude mcp add --scope user github -- bash <repo>/bin/github-mcp.sh`.
- **SEO / traffic MCPs (added 10.10.2026), user scope.** Local stdio via `bin/traffic-mcp.sh <name>`
  (keys read at launch from `repositories/mcp/api-mcp/.env` + `~/.api-mcp/secrets.json`, never written to config;
  the GCP service-account JSON is materialised to `~/.config/innerloop/gcp-sa.json` 0600):
  `dataforseo` (official, prepaid credit), `google-analytics` (official; `run_report` works with property
  `551309693`, the Admin-API tools need analyticsadmin.googleapis.com enabled on GCP project 885657052575 —
  the service account cannot enable it), `search-console` (community `mcp-search-console`, service account),
  `clarity` (official Microsoft), `google-ads` (official; starts, but needs a developer token + Ads OAuth).
  Remote OAuth, log in via `/mcp`: `ahrefs` (`https://api.ahrefs.com/mcp/mcp`; old npm `@ahrefs/mcp` is
  archived), `semrush` (`https://mcp.semrush.com/v1/mcp`), `similarweb` (`https://mcp.similarweb.com`),
  `seranking` (`https://api.seranking.com/mcp`), `cloudflare-radar` (`https://radar.mcp.cloudflare.com/mcp`).
  **SE Ranking (19.10.2026):** the MCP login fails with "Data API access not set up" until a Data-type API key exists (SE Ranking → API →
  Create key); that key is in `secrets.json` as `seranking_api_key` and drives the api-mcp connector `seranking` (`subscription` free,
  `keyword_metrics` = volume + CPC + competition + difficulty 0-100 + intents + 12-month history, up to 5,000 keywords a call, 100 credits
  per call whatever the count — always batch). 14-day trial, 100k credits, expires **02.11.2026** — no PAYG, let it lapse. The hosted MCP `seranking` is logged in too (OAuth, 19.10.2026): DATA_* keyword/domain/backlink/SERP tools, PROJECT_* tracking. Ahrefs and Semrush MCPs are paid-plan only.
  **Sweep 19.10.2026 (`connectors/SOURCES.md` → "SEO data sources sweep"):** nothing else free with an API is missing — Bing Webmaster
  keyword volume, OpenPageRank, Cloudflare Radar, CrUX, BigQuery Google Trends and IndexNow are already connectors; `pagespeed.audit` is
  written but waits for the Google API key's restrictions to include PageSpeed Insights (403 "blocked"); Similarweb/Ahrefs/Semrush/Serpstat
  are paid-plan only; Keywords Everywhere (~$7/mo annual) is the cheapest paid fallback for volume; Serper/SerpApi free SERP quotas and the
  Nightwatch 14-day MCP trial need an account in his name and overlap SE Ranking.
  Re-add in another container: `claude mcp add --scope user <name> -- bash <repo>/bin/traffic-mcp.sh <name>` /
  `claude mcp add --scope user --transport http <name> <url>`. api-mcp still carries the same own-site data.
- **Crypto MCPs (added 10.10.2026), user scope, all remote HTTP and read-only.** No key: `coingecko`, `crypto-com`
  (exchange market data), `coinpaprika`, `dexpaprika` (DEX pools), `blockscout` (multi-chain explorer), `pyth` (oracle
  prices), `nansen`, `zerion`, `chainstack`, `avalanche`, `across` / `lifi` (bridge quotes; unsigned tx only).
  OAuth via `/mcp`: `santiment`, `glassnode`, `messari`, `token-terminal`, `coinstats`, `lunarcrush`, `dune`, `quicknode`,
  `defillama` (its MCP may need a paid Pro plan, so don't upgrade: no PAYG). Deliberately not added: wallet/signing/trading
  servers (private keys), etherscan (BYOK header, no key on disk), CoinMarketCap (x402 pay-per-call), the npm `defillama-mcp`
  (single unknown maintainer, no repo). Re-add: `claude mcp add --scope user --transport http <name> <url>`
  (URLs: `claude mcp get <name>`).
- **Exchange account MCPs (added 11.10.2026), user scope, local stdio via `bin/exchange-mcp.sh <name>`** (keys read at
  launch from `~/.api-mcp/secrets.json`, never written to config; without keys both serve public market data only).
  `bybit` = Bybit's **official** `bybit-exchange/trading-mcp` (npm `bybit-official-trading-server`, 392 tools: tickers,
  wallet balance, fee rates, deposit addresses, fiat-convert, P2P ads/orders/payment methods, tax reports, plus trading).
  `binance` = community `trustxai/binance-mcp` (PyPI `amazing-binance-mcp`, Apache-2.0, 83 tools; **no withdrawal tool
  exists**, trading refused unless `BINANCE_ALLOW_TRADING=1`, which the launcher unsets). Binance publishes no official
  MCP. **Policy:** API keys are READ-ONLY (Bybit: System-generated, read-only, IP allowlist; Binance: "Enable Reading"
  only, Ed25519 preferred) — orders and withdrawals stay in the apps. Secrets keys: `bybit_api_key`, `bybit_api_secret`,
  `binance_api_key`, `binance_api_secret` (or `binance_private_key_path`). Rejected: TermiX-official/binance-mcp (wants a
  BSC wallet private key, ungated market orders), nirholas/Binance-MCP (unverified 150-KB tool surface incl. P2P writes).
  Note: neither exchange's public API lets a taker place a P2P order — P2P buying is in-app; the MCPs give balances,
  limits, payment methods, order status and the live ad book. Re-add in another container:
  `claude mcp add --scope user bybit -- bash <repo>/bin/exchange-mcp.sh bybit` (same for `binance`).
- **Stocks / ETF / macro MCPs (added 10.10.2026), user scope, remote HTTP, read-only.** No key: `fxmacrodata` (policy
  rates, inflation, GDP, release calendar). OAuth via `/mcp` (free tiers): `eodhd` (72 tools: prices, fundamentals, macro),
  `financial-datasets` (statements, SEC filings, news), `twelvedata` (prices, indicators, ETF holdings), `morningstar`,
  `tradingview` (screener, technicals). Rejected: `finnhub` (no dynamic client registration), `alphavantage`
  (needs a free key — sign up with his email is his step), Alpaca (trading). Already in api-mcp for the same purpose:
  `fred` (US yields: DGS3MO/DGS10), `ecb` (deposit rate, euro yield curve, EUR/USD), `worldbank`, `eurostat`, and the new
  `nbu` connector (official UAH rates, latest ОВДП auction yields, reserves — `connectors/nbu.yaml`).
- **Interactive Brokers via MCP** (`ibkr`, user scope, added 10.10.2026): IBKR's own remote server
  `https://api.ibkr.com/v1/api/mcp-public` (OAuth with dynamic client registration). **Not `/v1/api/mcp`** —
  that one is allowlisted to IBKR's partner clients (claude.ai etc.): login succeeds, then every call returns
  `400 {"error":"Unsupported client"}` whatever the clientInfo; the same token works on `/mcp-public`.
  42 tools: positions, balances, trades, PortfolioAnalyst performance/allocation, OHLCV `get_price_history`,
  snapshots, option chains, futures ladders, alerts, watchlists, order instructions. Log in via `/mcp`.
  `get_flow_type` = `REVIEW_AND_APPROVE` for this login, so `submit_order`/`modify_order`/`cancel_order` are refused.
  Gotcha: a `/mcp` login made straight against `/mcp-public` reported "Got new credentials, but ibkr rejected
  them" and left an empty entry (probably because that resource also offers `mcp.orders.submit`; unconfirmed).
  What worked: log in once against `/v1/api/mcp` (scope `mcp.read mcp.write`), refresh that token at
  `https://api.ibkr.com/oauth2/token` with `resource=…/mcp-public`, and store it in the `ibkr|…` entry for
  `/mcp-public` in `~/.claude/.credentials.json`. Back up the file first. Orders are only *instructions*: each one waits in Client Portal →
  Trade → Orders and Trades → AI Instructions until he clicks Review & Submit. Revoke access under Settings →
  Manage Third-Party Consents. Re-add: `claude mcp add --scope user --transport http ibkr https://api.ibkr.com/v1/api/mcp-public`.
- **Investing data (added 10.10.2026).** Key-free, user scope:
  `yahoo-finance` (Alex2Yang97/yahoo-finance-mcp @b9c1765, MIT — global prices incl. `.DE`/`.PA`/`.AS` tickers,
  financial statements, holders, options, news, analyst recommendations; Yahoo data is unofficial, cross-check) and
  `sec-edgar` (stefanoamorelli/sec-edgar-mcp 1.1.0, AGPL — US filings, XBRL financials, segments, insider Form 4;
  env `SEC_EDGAR_USER_AGENT` = the ops mailbox). Both are uv tools in `~/.claude/uv/bin` (same pattern as biomcp):
  `UV_TOOL_DIR=~/.claude/uv/tools UV_TOOL_BIN_DIR=~/.claude/uv/bin ~/.claude/bin/uv tool install <pkg>`.
  api-mcp connectors `ecb` (policy rates, €STR, Euribor, euro yield curve, FX; no UAH) and `eurostat` (GDP,
  unemployment, debt, house prices) — SDMX XML, no key; the old HICP keys stop at 2025-12. FRED/World Bank already there.
  Skipped: `yfinance-mcp` on PyPI (claims ranaroussi/yfinance as home, which has no MCP), OpenBB (repo now redirects to
  an unverified `openbq-org` created 11.09.2026 — re-check before installing). Optional with a free key he must claim:
  Alpha Vantage remote `https://mcp.alphavantage.co/mcp?apikey=…` (25 calls/day), FMP (250/day).
  ETF universe: `.devtools/etf/` — `justetf_universe.py` (3,742 UCITS ETFs, EUR returns/risk/TER via justETF's DataTables
  callback, needs `etfsParams=search=ETF&productGroup=…`), `ibkr_resolve.py` (ISIN → IBKR listings, paced to the
  connector's **30 requests/minute**), `build_report.py` → `eur_etfs.csv` + shortlist tables.
- **Deye home inverter via MCP (added 31.10.2026), user scope `deye`** — official Deye Open MCP (`https://developer.deyecloud.com/openmcp/mcp`, 51 tools, Streamable HTTP, no install). Station "6kw" id 62718350 (6 kW hybrid, 2 battery modules, EU data center). Credentials in `~/.api-mcp/secrets.json` (`deye_app_id/secret/email/access_token`), token lasts 60 days → `bash scripts/deye-token.sh` in a real terminal. **Read-only by policy:** 21 deny rules in `~/.claude/settings.json` (`mcp__deye__order_*`, `strategy_dynamic_control`, `device_register`, `device_add/delete_logger`, `station_create`, `call_deye_api`, `get_access_token`, `account_token`) — never lift them. Gotchas: every session must call `get_skill_info(client_skill_version="1.2.0")` first or business tools return `SKILL_VERSION_REQUIRED`; convenience tools take snake_case (`station_id`, `device_list`), `*_wrapper` tools take `body={camelCase}`. Skill: `.claude/skills/deye-station/`. Re-add: `claude mcp add --scope user --transport http deye https://developer.deyecloud.com/openmcp/mcp`.
- **Gmail (added 17.10.2026) — `scripts/gmail/`.** Access reuses the site's Google OAuth client (project
  `primeval-melody-275512`, id/secret in `.env.d/affiliate-site.env`); redirect URI `http://localhost:3000/gmail-oauth/callback`
  is registered on it and the consent screen is in Testing with his addresses as test users. Refresh tokens (scope
  `gmail.modify`) live in `~/.api-mcp/gmail_token.json`, one per mailbox — `oauth.py` adds a mailbox (prints a URL, he
  approves, port 3000 is forwarded). `gmail_api.py` = stdlib client (list, batch metadata, batchModify); `scan.py` caches
  headers to `~/.api-mcp/gmail/<account>/meta.jsonl` (quota: 15,000 units/min per user — in-batch 403s must be counted,
  the first run dropped 80% silently); `report.py` = dry-run tables; `apply.py` = archive/trash by rule, dry run unless
  `--go`, no permanent delete. 17.10.2026: archived 27,383 Inbox messages older than 3 months (ids in `applied.jsonl`).
- Vault methodology mode (LYT / PARA / Zettelkasten / generic): `bash bin/setup-mode.sh`.
- **Moving this directory on the host is free** — move it, rename it, reopen it in
  the devcontainer. `.devcontainer/devcontainer.json` pins `workspaceFolder` to
  `/workspaces/innerloop-ai` and names its volumes from that fixed project id, so
  the container path never follows the host folder — and everything keyed to that
  path (`~/.claude/projects/<slug>` sessions + auto-memory, the `~/.claude.json`
  project entry, Claude login, shell history) stays valid. Keep the folder under a
  Docker-shared path (`/Users/…` on macOS by default) or the bind mount fails.
  Verify with `bash bin/relocate.sh` (all-green = free to move). Copying this
  `.devcontainer` into another repo: change the `innerloop-ai` id in it.
  `bash bin/relocate.sh --fix --from /old/path` repairs state left over from a move
  made *before* the pin existed (renames the session dir, re-keys `.claude.json`).
- Dated overview of all Claude sessions across projects: `bash bin/sessions-list.sh`
  (`-a` = all, or a substring to filter by project).
- Archive session transcripts as ingestable source: `bash scripts/export-sessions.sh`
  (`--since YYYY-MM-DD`, `--all`, `--list`, `--outdir DIR`). Renders every
  `~/.claude/projects/**/*.jsonl` to markdown under
  `input/<DD.MM.YYYY>/claude-sessions/`, resumable via
  `.vault-meta/session-export-state.json`, skipping the live session. **It redacts
  credentials on the way out** (name=value secrets, `curl -u user:pass`, vendor
  token prefixes, long opaque mixed-case runs) — the vault must never receive them.
  Run it before a session scan: without it, history exists only as raw jsonl.
  **It already covers every devcontainer**: `~/.claude/projects` is a bind mount
  from the host, so all containers write their transcripts to one shared
  directory — no per-container pass is needed. It also drops harness chatter
  (`<task-notification>`, slash-command wrappers) that otherwise counts as fake
  user turns.
- Reddit people-finder — scores buying-intent signals and returns a contact
  shortlist, not posts: `python3 scripts/reddit-signals.py` (presets: money,
  igaming, rag; `--self-test` validates the classifier offline, no network).
  **The anonymizer is `anonfetch`, and all Reddit traffic goes exclusively
  through it.** anonfetch is an MCP server on the host
  (`http://host.docker.internal:8765/mcp`) that fetches through rotating
  NordVPN exits — a fresh browser fingerprint per identity, soft-block
  detection (Cloudflare / CAPTCHA / access-denied / empty 200s) and automatic
  retry through a different exit. Enroll a container once with
  `curl -s http://host.docker.internal:8765/enroll | sh`; that writes the
  endpoint + token into `~/.claude/.claude.json`, which the script reads
  directly — no `.env` entry needed (override with `ANONFETCH_URL` /
  `ANONFETCH_TOKEN`). The script speaks MCP itself, so the only socket it
  opens is to anonfetch: there is no direct mode and no fallback channel
  (plain reddit.com, RSS, mirrors) may be added.
  - `--check` proves the pool works and the exits really differ before you
    spend a run; `--rotation sticky|per-request|pooled` (default **sticky** —
    one bearer token surfacing from six countries in a minute is what a stolen
    token looks like), `--country US` pins the pool.
  - The `empty-body` block rule is deliberately **off** here: Reddit's token
    response is ~150 bytes and the detector reads anything that small as a
    dropped exit. The other four rules stay on.
  - The response payload arrives under `html` / `text`, **not** `body`, and
    `truncated: true` means the JSON is cut at `maxChars` — parse that and you
    get a crash instead of an empty result.
  - **The "throttle" is Nord's per-account *session cap*, not a request rate
    (measured 25.08.2026 with curl straight at the exits: `407` +
    `X-Proxy-Error: session_limit_reached`).** Every distinct proxy server the
    account authenticates against holds a session slot for a while after use;
    once the ~10 slots are full, *every* exit — including ones that worked a
    minute earlier — answers 407 until sessions expire (observed 20+ min); a
    warm exit meanwhile takes 10 back-to-back requests without complaint.
    Old builds showed it as `ERR_BAD_RESPONSE: stream has been aborted`; the
    server now reports `PROXY_AUTH_REJECTED`, serves warm exits first,
    introduces a cold one at most every 15 s (`warmTarget` 6 — keep it under
    the device limit; other tools on the same creds share it) and none while 407s arrive
    (`anonfetch_status` → `proxy.warm`, `proxy.authThrottledForMs`,
    `diagnosis`). Never fight it by rotating harder or minting identities in
    bulk; back off on the same exit (`anonfetch_client.py` does: 15/30/60/105 s).
    Aborted streams also show up sporadically on healthy pools (anonfetch does
    not spoof TLS/JA3); the built-in retries absorb them.
  - **Verified 2026-08-22:** exits rotate (`--check` → 3/3 distinct exit IPs
    out of the pool; dozens of distinct exits across runs), the token POST
    reaches Reddit (dummy creds → clean HTTP 401), `oauth.reddit.com` answers
    (invalid bearer → 403), and `www.reddit.com` returns 200 bodies. Public
    `/r/*/new.json` returns **403** through these exits — Reddit refuses
    datacenter IPs there — but the script only uses the OAuth host. Not yet
    proven: an authenticated scan, which needs real
    `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` (no `.env` exists yet).
  - **Reachability is intermittent even on a healthy pool.** In one window all
    the probes above passed; twenty minutes later 4 of 5 exits aborted mid-
    stream with `anonfetch_status` reporting no systemic failure — in hindsight
    the auth limit above. Run `--check` until it comes back green *before*
    spending a scan, and keep the default `--rotation sticky` so a working exit
    gets reused instead of re-gambling every request. Fewer distinct exit IPs
    than samples in `--check` is now expected, not a defect.
  - **Unauthenticated Reddit through these exits (verified 2026-08-22): only
    `.rss` works.** `/r/X/new.json` → 403; `www.reddit.com` HTML search → 200
    but a JS shell with zero content (shreddit renders client-side);
    `old.reddit.com` → 403. **`/r/X/new/.rss`, `/r/X/top/.rss?t=week` → 200
    Atom** with title/link/date/author per entry (extract with
    `rowSelector: "entry"`); an individual post's URL + `.rss` serves the post
    body and comments. `search.rss` untested-inconclusive (attempts hit
    provider aborts, not Reddit refusals). Success rate on a throttle-free
    window ≈ 100%, during throttle ≈ 20–50% — batch small (≤20 URLs,
    concurrency 2, delay ≥2s) and re-run the misses in the next window.
    `saveToFile` paths are on the anonfetch host (`/data/…`), not in this
    container — readable only via `extract_html`/`job_results`.
