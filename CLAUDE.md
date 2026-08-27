# InnerLoop AI — your self-development mentor for Claude Code

A memory that learns you. This repo is both the **engine** (committed) and the
**brain** (personal data, gitignored, lives right here). Nothing is linked at
the system level — clone, open in the devcontainer, and everything is local.

## Engine vs brain

```
ENGINE (committed)                  BRAIN (gitignored, in-repo)
  .claude/skills/  4 core skills     wiki/     the vault (open in Obsidian)
  .claude/settings.json  hooks       inbox/    raw dumps to process (read-only)
  scripts/   retrieval, locks        .raw/     ingested source documents
  bin/       setup helpers           .vault-meta/  indexes, locks, mode
  templates/ empty brain seed
  .devcontainer/
```

## Session loop (the inner loop)

1. **SessionStart hook** loads `wiki/about-me.md` (who the user is) →
   `wiki/LESSONS.md` (how to work with them) → `wiki/hot.md` (recent context).
2. Work happens; new facts get filed via `ingest` / `/save`.
3. **Stop hook** nudges `/reflect` after substantive sessions.
4. `/reflect` consolidates the session into LESSONS (process lessons, with
   provenance + outcome signal + corroboration + time-decay) and the vault (facts).

That capture → structure → retrieve → reflect loop is the product.

## Skills

| Skill | Purpose |
|---|---|
| `ingest [source]` (`wiki-ingest`) | Structure raw material from `inbox/` into wiki pages + MOCs |
| `/save` | File the current conversation as a structured wiki note |
| `/wiki-retrieve` | Hybrid BM25 + contextual + cosine-rerank retrieval over the vault |
| `/reflect` | Self-learning loop → `wiki/LESSONS.md` + vault facts |
| `inbox-audit` | "What's left / are you sure 100%?" → per-file reconciliation (`scripts/inbox-audit.py`), then process by type |
| `session-sweep` | Export all containers' sessions, fan out readers, surface repeats/corrections → skills + reflect |
| `career-map` | "Knowing me, where do I fit / what value / which path" — fixed vault read set + one number from his data |
| `job-scan` | Live Djinni/DOU/remote-board scan → CSV in inbox → fit table → bare apply URLs |
| `reddit-leads` | Fresh low-competition posts by non-technical people who need him → bare https list |
| `anonfetch-scrape` | Every scrape: pool check, throttle triage, probe → selectors → small batches |
| `site-adapter-pipeline` | Per-site scraper: catalog → probe → adapter → raw HTML → DB → XLSX |
| `trend-gap-scan` | Run the existing gap/trend scanners and verify sources — never rebuild |
| `api-connector` | Add an API + credential to api-mcp as YAML, test via CLI, no secret echo |
| `site-ops` | Build/deploy/verify blog + affiliate site on Vercel; DNS, analytics, SEO, redirects |
| `expose-local` | Cloudflare quick tunnel + QR for phone testing; verify; tear down |
| `checkpoint-refactor` | Git checkpoint + tag before any refactor/fix; regression run; clean rollback |
| `cc-defaults` | Bypass mode + Remote Control off in any container (`bin/setup-claude-defaults.sh`); port check |
| `verify-before-claim` | No "done/works/100%" without fresh evidence; "are you sure?" → verified vs unverified |
| `design-loop` | Screenshot → critique → fix → redeploy loop for any site (desktop + mobile) |

Skills were derived from a sweep of 60+ sessions (25.08.2026, `session-sweep`); their
`description` fields carry his actual trigger wording, including Ukrainian.

## Rules for Claude

- Read `wiki/about-me.md` first when you need to know the user; follow its
  read-order contract. Do not load the whole vault.
- `inbox/` is read-only source material — never modify it.
- `wiki/LESSONS.md` is updated only through `/reflect`; never append raw notes.
- Guard wiki page writes with `scripts/wiki-lock.sh acquire <path>`/`release <path>` (per-file; a bare `acquire` errors).
- Personal data (`wiki/`, `inbox/`, `.raw/`) is gitignored — never `git add -f` it.
- The same prompt arriving 5–13× within minutes is a 529 storm, not insistence —
  say once "N identical prompts, treating as one", run the work detached with
  resumable state, and never redo a harvest.
- No `sleep` longer than 5 minutes; poll with `scripts/wait-for-pool.sh` or a
  `Monitor`. He reads long silent waits as idle. Never `pkill -f <pattern that
  appears in your own command line>` — it killed its own shell four times.
- Any refactor / "make it agnostic" / "fix without breaking" starts with a git
  checkpoint (`checkpoint-refactor`); any "done" ends with fresh evidence
  (`verify-before-claim`).
- This repo is its own testbed: when a session surfaces friction, a gap, or a
  bug in the engine, fix it (or propose the fix) as part of that session —
  the product improves through use.


## Directory sources (added 27.08.2026) — `.devtools/crawl_sites.js`

One runner, one module per site in `.devtools/sites/<name>.js` (`{name, lang, region,
list(af), parse(html, url)}`; `parse` may return an array for table pages). The runner
owns pacing, raw HTML (`raw_pages/<site>/<slug>.html.gz`), resumable state + per-site
lock (`.sites-state/`), provenance (`extra.provenance`, `source_url`, `parser_version`
= hash of the module, `parsed_at`) and the upsert (slug `<site>-<slug>`; a brand that
already exists from another source is *filled*, never duplicated — `extra.also_on`).
`sites_cycle.sh` runs a bounded pass per site inside the supervisor; `--reparse`
replays stored pages offline; `--max-age-days` re-fetches old ones.

| module | source | what | size |
|---|---|---|---|
| `pp100` | 100partnerprogramme.de | DACH programmes: rate, model, cookie, network, categories, products table, SEM rules | ~2,100 |
| `affililist` | affililist.com | SaaS/creator programmes (JSON-LD Organization + tiles) | ~1,000 |
| `palai` / `palai_offers` | palai.media | UA networks (managers, payouts) / iGaming offers with conditions | 79 / ~1,900 |
| `uaff` | uaff.media | UA networks (terms, EST year, ratings) | ~170 |
| `cpad` / `cpad_offers` | cpad.pro | CIS network monitor (offer counts, payouts, 3 ratings) / offers with per-network goal rows | 58 / ~5,200 |
| `affdays` | affdays.com | comparison tables per niche (one record per row) | ~24 pages |
| `partnerkin` | partnerkin.com | RU networks: params, criteria ratings, reviews count, awards, rep | ~860 |
| `tradedoubler` | directory.tradedoubler.com | EU programmes per market: commissions per segment, cookie, currency, traffic rules | ~2,700 |
| `leads_su` | leads.su | RU finance offers: payouts per action, EPC/CR/AR, hold | ~720 |
| `postaffiliatepro` | postaffiliatepro.com/affiliate-program-directory | ~2,300 programmes: industry, model, cookie, traffic, payouts, tracking software, named manager | ~2,300 |
| `conversion_im` | conversion.im | RU CPA-network rating: verticals, payout terms, methods, review tone counts | 232 |
| `affhub` | affhub.media | UA media catalogue of programmes: profile, site, Telegram | 226 |
| `affiliate_marketing_de` | affiliate-marketing.de | DACH merchants: one row per network programme (commission span, SEM, tracking, feeds, territories) | thousands |
| `clubaffiliation` | clubaffiliation.com | FR programmes: CPC/CPS/CPA terms, start date, diffusion rules (ISO-8859-1 source) | ~1,700 |
| `cpa_rip` | cpa.rip | EN/RU network catalogue: payouts, payout systems, socials, user rating | ~480 |
| `gdeslon` | gdeslon.ru/offers | RU network offers: commission span, 6-month conversion/EPC/AOV, coupons | ~220 |
| `epn` | epn.bz/ru/offers | ePN's curated programmes: rate, approval, conversion, payment term, cookie, legal entity | 15 |
| `cpainform_offers` | cpainform.ru/programs | RU offer monitor: per-network goal rows (rating, action, access, GEO, payout in RUB) | ~6,100 |
| `affiliatekatalog` | affiliatekatalog.com | CZ/SK programmes: commission %, cookie days, sign-up + product links | ~900 |
| `ehub` | ehub.cz catalogues (7 markets) | eHUB campaigns table: brand, category, PPS %, attribution window, market | ~750+ |
| `affiliateprograms_com` | affiliateprograms.com/p | editorial directory: base commission, payment frequency/type, countries | ~310 |
| `tradetracker` | tradetracker.com/<cc>/campaigns | 25 markets × categories: brand, logo, blurb, network — **first 12 per category only** (load-more is client-side), no commissions | partial |

Rejected after probing: getlasso.co / affiliateprogramdb.com (403 on every exit),
gdetraffic.com (article feed, not a catalogue), theaffiliateslist (paywalled),
Chinese CPS networks (duomai / yiqifa / linktech are login-only JS shells — no public
advertiser list exists to parse), adtraction (brand cards load via /ajax/, no HTML),
daisycon (JS-rendered list), admitad (no public catalogue any more), mylead (404),
webepartners (≈15 programmes).

## Parsing — drift watch (mandatory before and during any scrape)

Extractors built from the schema go blind to whatever the schema lacks. Run the
watcher instead of trusting a fixed field list. Global rule in `~/.claude/CLAUDE.md`.

```bash
# teach it a source (needs >=2 saved pages, so boilerplate can be found by diff)
node .devtools/schema_watch.js learn <source> page1.html page2.html

# what does this page publish that no rule claims?
node .devtools/schema_watch.js check <source> page.html   # exit 2 = needs review

# current label -> column map
node .devtools/schema_watch.js rules [source]

# sample live pages for every profiled source and report drift
bash .devtools/watch_sources.sh
```

- Rules live in `.devtools/extract_rules.json` (`label -> column`; `null` = ignore
  deliberately). Adding a rule is a data edit.
- Profiles in `.devtools/.schema-profiles/<source>.json`.
- `unmapped_check.js <page.html>` is the quick one-page version: it reports apply
  links, socials, emails, prose and other content a rate-focused parser skips.
- **Staleness is explicit.** Every parsed row carries `parser_version` (a hash of the
  parser code, see `.devtools/parser_version.js`) and `parsed_at`. A row whose version
  differs from the current parser was produced by older code; `reparse_stored.js`
  fixes those offline when the raw page is stored, and `requeue_stale.js` re-fetches
  the ones it cannot (no stored page, or older than `--max-age-days`, default 14).
  `node .devtools/requeue_stale.js --report` shows the distribution.
- **The program page must render every stored, non-internal field as explicit, labelled
  rows.** The owner asked for "show everything" AND (to the web session) to remove the
  generic "All stored fields / completeness %" block — so new columns get explicit `kv()`
  rows in `app/[lang]/affiliate-program/[slug]/page.tsx`, never a dumped list. Before
  aliasing a build to the domain, run the site's Playwright gate (`npm run test:e2e`).
- Novelty >=20% means stop and look. It found `Affiliate Managers` on a live page
  that existed in no other sample.
- A rebuild that only changes class hashes must score ~0%: build-generated classes
  are stripped and boilerplate is keyed on text. Verify this still holds after
  editing the fingerprint.

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
- **Data catalog — що в нас уже є з даних**: `wiki/sources/data-catalog.md` —
  авто-згенерований реєстр усіх датасетів (Postgres `host.docker.internal:5432/app`
  з Reddit-корпусом `rd_*` ~940k постів, скрейпи djinni/dou/work.ua, sqlite-бази
  радарів, корпуси розмов, tech-horizon CSV). Оновлюється на кожному SessionStart
  (`scripts/data-catalog.py scan --quiet`). **Перед тим як щось скрейпити або
  збирати — перевір каталог: дані, можливо, вже є.** Схема будь-якого файлу:
  `python3 scripts/data-catalog.py describe <path>`; опис/refresh-команда:
  `... set <path> description|refresh_cmd|refresh_days <value>`; прострочені:
  `... refresh --stale`. Каталог зберігає лише структуру (шляхи, таблиці,
  колонки, лічильники) — ніколи вміст рядків і ніколи креденшили.
- Dated overview of all Claude sessions across projects: `bash bin/sessions-list.sh`
  (`-a` = all, or a substring to filter by project).
- Archive session transcripts as ingestable source: `bash scripts/export-sessions.sh`
  (`--since YYYY-MM-DD`, `--all`, `--list`, `--outdir DIR`). Renders every
  `~/.claude/projects/**/*.jsonl` to markdown under
  `inbox/to-process/<DD.MM.YYYY>/claude-sessions/`, resumable via
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
