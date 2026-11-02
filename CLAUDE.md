# InnerLoop AI — your self-development mentor for Claude Code

A memory that learns you. This repo is both the **engine** (committed) and the
**brain** (personal data, gitignored, lives right here). Nothing is linked at
the system level — clone, open in the devcontainer, and everything is local.

## Engine vs brain

```
ENGINE (committed)                  BRAIN (gitignored, in-repo)
  .claude/skills/  4 core skills     wiki/     the vault (open in Obsidian)
  .claude/settings.json  hooks       input/    raw dumps to process (read-only)
  scripts/   retrieval, locks        output/   generated deliverables, by date
  bin/       setup helpers           .raw/     ingested source documents
  templates/ empty brain seed        .vault-meta/  indexes, locks, mode
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
| `ingest [source]` (`wiki-ingest`) | Structure raw material from `input/` into wiki pages + MOCs |
| `/save` | File the current conversation as a structured wiki note |
| `/wiki-retrieve` | Hybrid BM25 + contextual + cosine-rerank retrieval over the vault |
| `/reflect` | Self-learning loop → `wiki/LESSONS.md` + vault facts |
| `inbox-audit` | "What's left / are you sure 100%?" → per-file reconciliation (`scripts/inbox-audit.py`), then process by type |
| `session-sweep` | Export all containers' sessions, fan out readers, surface repeats/corrections → skills + reflect |
| `career-map` | "Knowing me, where do I fit / what value / which path" — fixed vault read set + one number from his data |
| `job-scan` | Live Djinni/DOU/remote-board scan → CSV in input → fit table → bare apply URLs |
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
| `to-fix-loop` | "improve fix to and deploy": read every `to-fix/*.png`, patch, gate, deploy from a clean worktree, delete only proven-fixed shots |
| `secrets-intake` | Pasted key/token/password → env file without echo, one verification call, one rotate note |
| `publish-gate` | Hosted DB changes only on "push": backup both, cleaners, competitor-link grep, `sync --prune`, verify counts |
| `pin-invariant` | ALL-CAPS "never change this" → constant + verbatim quote + test + CLAUDE.md line |
| `mcp-add` | "add X mcp and any other mcps you can find / add ALL!!!" → check what is wired, register every candidate at user scope, keys read at launch, one live call each, list what only he can unblock |
| `self-dev-mentor` | raw self-observations (communication, focus, calling, relationships) → root causes + one dated step + a book/chapter/series tied to a named issue; never generic self-help |
| `health-ingest` | "injest <date> / process all / опрацюй" for medical, insurance and body-data folders → OCR with table recovery, owner by DOB, date by document, per-folder reconciliation, then the attached health question |
| `seo-forensics` | "impressions are down WHY / Just analyze / deindex / noindex" → Googlebot status at the edge, GSC last finalised day, URL Inspection sample before any sentence; index cuts gated on a measured blast radius |
| `launch-status` | "what is left / most critical first / are we good / anything else critical?" → fresh checks, one ranked list kept in a file, answered as a delta with his steps and Claude's separated |
| `session-find` | "find me the session where… / link lost session / part of this session was removed, restore" → exports first, then jsonl, full 36-char ids, compaction ≠ deletion, deleted project folders are not resumable |
| `doctor-brief` | "going to <doctor>, based on what you know about me what should I discuss" → one-page brief from the Здоров'я read set as a phone-readable Claude Doc; after the visit "опрацюй / absorb <date>" the transcript; "який варіант обрати з цих?" → one evidence-tiered supplement pick (DSLD + BioMCP) |
| `telegram-access` | contacts/messages of his own groups, deleted/edited posts of his channels via Telethon — QR login in a real terminal (never `!`), 2FA once, scripts `scripts/tg-*.py`, output in `.raw/telegram/`, cleanup on "видаляй" |
| `deye-station` | інвертор / батарея / SOC / "скільки світла виробило" → the home Deye station (id 62718350) through the official Deye Open MCP `deye` (cloud, EU), read-only by 21 deny rules; handshake `get_skill_info(client_skill_version)` first, token from `secrets.json`, refresh via `scripts/deye-token.sh` |
| `backlink-prospecting` | "I need links to my website / get all the backlink profile of my competitors / GET MORE… ANY TLD / gather more NEW / post them! NEVERENDING" → read the state page first, balance check before any metered call (SE Ranking `export` = 0 credits), Common Crawl via DuckDB one worker, PBN overlap = risk flag, the automation decision asked once on one page, every attempt logged in `output/<date>/backlinks/posted/` |

### Backlinks — the app (added 01.11.2026)

`repositories/backlinks` (`bin/blx`) is the backlink engine: **one Postgres warehouse**
(`blx` on the docker host, own database) and four verbs — `gather` / `analyze` / `post` /
`report`. It replaces the one-off scripts of 28–31.10.2026, whose answers could only be
re-derived by re-scraping. A question is now a query: `blx db query "select * from
v_act_first"`. Read its README first; the thirteen mistakes it is built around are listed
there and pinned in `tests/`.

- `blx gather load` imports every artifact already on disk (step 0 of the ladder). Live
  channels: `authority commoncrawl|openpagerank|tranco`, `corpora reddit|crypto|hn|
  stackexchange|devto`, `lists` (repos are DATA in `rules/list_repos.txt` — search only
  *prints* candidates), `registry` (the directories `mr_program.source_url` names),
  `probe submit-pages|resource-pages`.
- `blx analyze score|cocite|shortlist|vet` — every pass clears its own column first, so a
  refinement is never a silent no-op. `vet` is backlink-guard in **free mode only**.
- `blx post` is policy-gated: `BLX_POST_POLICY=draft` (default, never sends) | `confirm`
  (a human runs `blx post approve <id>`) | `auto`, daily cap, append-only `post_audit`.
  Form fills go from the **home IP**, never Nord. A claim is only LIVE when our `<a href>`
  is really on the page, with the `rel` found.
- Registry and corpus connections are opened **read-only** (`BR-DATA-10`); the warehouse is
  a separate database so the live loop in `.devtools/backlinks/` keeps working untouched.
- `rules/*.json` are data: adding a classification rule or a form field is an edit.
- Secrets are never copied into its `.env`; `config.secret()` reads `~/.api-mcp/secrets.json`
  **and** `repositories/mcp/api-mcp/.env` (that is where `OPENPAGERANK_KEY` lives).
| `backlink-expansion-matrix` (+ `backlink-source-prep` / `-batch-expansion` / `-quality-expansion` / `-workbook-delivery`, `submit-product-directories-v1-batch` / `-v2-quality`) | Vendored from flaqai/backlink_skills (MIT, 01.11.2026): backlink profile → candidate pools → Free/Paid workbooks + submission audit; local overrides in each `UPSTREAM.md`. Vetting = backlink-guard (hub `backlink-guard`, free mode only), queue source = awesome-submitlist (`.devtools/backlinks/submitlist_import.py`) |
| `diagnosing-bugs` | Hard bug / "still broken" / "why can't you verify what's not working" → a red-capable command first, then minimise → ranked hypotheses → instrument → regression test (mattpocock/skills, MIT; a site-seam copy lives in `.devtools/affiliate-site/.claude/skills/`) |
| `wizard` | Any step only he can do (paste/rotate a key, re-login, vendor dashboard) → a bash wizard he runs in a VS Code terminal: hidden entry, writes the env file, verifies, stamps `~/.claude/wizards/done.jsonl` (mattpocock/skills, MIT) |
| `/handoff` | User-invoked: compact the session into `output/<date>/handoffs/` with its full session id before context runs out or a `/branch` (adapted from mattpocock/skills) |
| `/progressive-disclosure` | User-invoked: shrink an always-loaded CLAUDE.md into a router + `docs/` read on demand — preview in `output/<date>/declutter/` first, apply only on his word, proven lossless by `scripts/preservation-check.py` |
| `web-data-access` | **Before any fetch/parse/scrape**: the ladder (have it already → site's own MCP/connector → anonfetch → Wayback → headless browser → direct HTTP), `hosts.json` route map enforced by a PreToolUse hook (`scripts/guard-fetch.sh` blocks direct `WebFetch`/`curl` to known-routed hosts), `solved-cases.md` ledger of cracked cases — improve it in the session that teaches you something |

Skills were derived from a sweep of 60+ sessions (25.08.2026, `session-sweep`); their
`description` fields carry his actual trigger wording, including Ukrainian.

## Rules for Claude

- **Every network fetch starts at `.claude/skills/web-data-access/`** (owner's order 19.10.2026): what we have → the site's
  own MCP / api-mcp connector (keys are on disk) → anonfetch (Nord exits) → Wayback (`hub wayback__*`) → headless browser →
  direct HTTP last. `hosts.json` is enforced by `scripts/guard-fetch.sh` (PreToolUse on WebFetch/Bash); a solved hard case
  goes into `solved-cases.md` in the same session, a learned host into `hosts.json`.
- Read `wiki/about-me.md` first when you need to know the user; follow its
  read-order contract. Do not load the whole vault.
- `input/` is **material he gives me to process** — read-only, never modify it. Dated folders, `input/<DD.MM.YYYY>/…`.
  Renamed from `inbox/` on 29.10.2026 (owner: *"I've moved inbox to input"*); the `to-process/` layer is gone, so a
  dated folder now sits directly under `input/`.
- **`output/` is everything I generate for him** — spreadsheets, reports, images, exports — filed the same way by date:
  `output/<DD.MM.YYYY>/<topic>/`. Use it whenever there is no more specific, more cohesive home for the artifact
  (a requirement doc, a wiki page, a repo file). Gitignored like the rest of the brain. Material that only exists to be
  ingested later (session exports, scraped CSVs awaiting a parse) still belongs in `input/`; finished things he opens
  go in `output/`.
- `to-do/` is an **intake of raw thoughts, not a queue** — nothing is worked on from it directly. Lifecycle: `to-do/` → `/triage <file>` (classify → requirements with acceptance criteria and verify commands → `.claude/queue/` units; docs only) → `/cycle` (saved workflow `build-cycle`: plan → parallel builders in site worktrees → independent verifier until PASS → close; rounds until empty; money items stop at a branch for the owner unless `--merge-blocking`) → the raw file moves to `to-do/archive/` only when every derived item is closed. `/next-task` does one item by hand; `bash scripts/queue-status.sh` shows the state. Never edit to-do files; every derived file cites `source: to-do/<file>`. Templates: `docs/specs/_template.md`, `.claude/queue/_template.md`. `to-fix/` is the same intake for screenshots; `input/` is wiki source material.
- `wiki/LESSONS.md` is updated only through `/reflect`; never append raw notes.
- Guard wiki page writes with `scripts/wiki-lock.sh acquire <path>`/`release <path>` (per-file; a bare `acquire` errors).
- Personal data (`wiki/`, `input/`, `.raw/`) is gitignored — never `git add -f` it.
- The same prompt arriving 5–13× within minutes is a 529 storm, not insistence —
  say once "N identical prompts, treating as one", run the work detached with
  resumable state, and never redo a harvest.
- **The same message again 9–120 s later with an addendum is an edit, not a storm** (20+ times in 10–27.10.2026:
  "як перевірити у себе ГТР?" → "+ як бути впевненим?"; a pasted skeleton re-sent five times each adding one hop). Answer
  the *last* version only, in his structure ("NOW IN SUCH STRUCTUE!"), no banner. Two *different* short orders seconds
  apart are still two orders (`two-commands-are-two-commands`).
- `pkill -f` / `pgrep -f` / `xargs kill` are **blocked by a PreToolUse hook** (`scripts/guard-kill.sh`);
  use `bash scripts/safe-kill.sh <pattern>`. "Are there any loops going on?" → `bash scripts/loops-status.sh`.
- No `sleep` longer than 5 minutes; poll with `scripts/wait-for-pool.sh` or a
  `Monitor`. He reads long silent waits as idle. Never `pkill -f <pattern that
  appears in your own command line>` — it killed its own shell four times.
- **Commits follow Conventional Commits; versions are SemVer tags** (02.11.2026). `scripts/githooks/commit-msg` blocks any
  other header: `<type>[(scope)][!]: <description>`, types `feat fix docs style refactor perf test build ci chore revert`.
  Release: `bash scripts/release.sh` (dry run) → `--go` (prepends `CHANGELOG.md`, commits only that file, annotated `vX.Y.Z`
  tag; fix → patch, feat → minor, `!`/`BREAKING CHANGE:` → major, minor while < 1.0). Tags stay local; push on his word.
  `pre-*` checkpoint tags are not versions. The site repo (`.devtools/affiliate-site`) is not covered yet.
- Any refactor / "make it agnostic" / "fix without breaking" starts with a git
  checkpoint (`checkpoint-refactor`); any "done" ends with fresh evidence
  (`verify-before-claim`).
- **Shared trees (`.devtools/affiliate-site`): `git add <paths>`, never `-A`** — on 04.10.2026 `-A` swallowed a peer
  session's fix and a 104 MB `.next-verify/`; run `git log origin/test origin/main` and `scripts/loops-status.sh` before
  building or promoting; two Playwright gates on one test account trip the billing rate limit. `/verify` is
  user-invoke only (`disable-model-invocation`) — say so instead of trying. Local `npm run dev` of the site needs
  `DATABASE_URL=$(cat ../.dburl)` (the crawler DB lacks `mr_program_display` / `mr_seo_keep`).
- "Just analyze. Don't make any changes" / "just add docs. NO IMPLEMENTATION" / "DONT CHANGE THE CODE, JUST RESTORE
  CONVERSATION" are literal: report or recap only, no edits until he says so (31.08, 27.09, 04.10.2026).
- This repo is its own testbed: when a session surfaces friction, a gap, or a
  bug in the engine, fix it (or propose the fix) as part of that session —
  the product improves through use.

## Read on demand (moved out of this file 02.11.2026 — read the doc when the trigger applies)

| Topic | Read | When |
|---|---|---|
| Directory sources | `docs/claude-md/directory-sources.md` | adding, fixing or rejecting a crawler source in `.devtools/sites/`, or asked which directories are covered/rejected |
| Free infrastructure & credits available | `docs/claude-md/free-infrastructure.md` | choosing hosting, a database, email or any paid/credit service (rule: no pay-as-you-go) |
| Crypto research system | `docs/claude-md/crypto-research.md` | any crypto question or work on `.devtools/crypto/` (skill `crypto-research`) |
| Parsing | `docs/claude-md/parsing-drift-watch.md` | writing or changing any extractor/scraper, `schema_watch.js`, `parser_version`, or the site's program page fields |
| Setup | `docs/claude-md/setup-and-mcp.md` | setting up the container, an MCP server (hub, api-mcp, biomcp, SEO, crypto, exchanges, IBKR, Deye, LinkedIn, Gmail, Wayback), OCR/transcription, retrieval, or moving the repo |

## Owner rules from the moved sections (kept here verbatim — always loaded)

- **OWNER RULE (05.09.2026, PINNED `BR-DATA-10`): NEVER delete registry data without his order in that session.** Verbatim: "NEVER DROP ANYTHING FROM THE DATABASE. LEAVE IS IT IS!! I MEAN THE DATA!! JUST LET IT BE WITHOUT MY ORDER!! ASK ME AGAIN IF ILL BE WILLING TO!!" — said in answer to a proposal to drop the personal contact columns after `BR-PLAN-11`. The withdrawal from the plans stands; **the rows stay**. Not a sync, not a dedupe, not a migration, not a cleanup, and not because a legal argument would be tidier without them. If the case comes up again, **ask him** — never act. Guard: `.devtools/data_policy.js` (`requireOwnerOrder()`, protected = `mr_program`, `mr_rate_history`, `mr_review`, `mr_submission`, `mr_promo`); the seven scripts that delete registry rows (`sync_enriched --prune`, `clean_names`, `cn_clean`, `cn_fix`, `decode`, `merge_duplicates`, `migrate_to_cloud`) all refuse unless `--owner-ordered` is typed on that invocation. Never add that flag on your own judgement, and never bake it into a script, alias or cron. Check: `node .devtools/data_policy.js --self-test`.
- **OWNER RULE (05.09.2026, `BR-PLAN-11`): no plan sells personal contact data.** Verbatim: "yes remove personal contacts from Business plan". Named affiliate managers, personal mailboxes, messenger handles and direct phones go to **no plan at any price**; `personalData` is `false` on every entry of `.devtools/affiliate-site/lib/plans.ts` and every gate reads that one flag (`stripPersonal` in `lib/guard/contacts.ts`, `exportColumns` in `lib/programQuery.ts`). Accounts receive only the programme's official role mailboxes (`affiliates@`, `partners@`…). The only true value is the superadmin override in `lib/account.ts`, so erasure requests can be actioned. Pricing must not advertise the withheld data either. Tests: `tests/plans.spec.ts`. Legal texts re-versioned `2026-09-05` — Privacy no longer discloses a CCPA "sale", the Data Licence carries no personal data, the DPA is scoped to account data. **Still open (`11-open-questions.md` Q12): the rows remain stored in the hosted and local DBs** — dropping them is a `publish-gate` operation needing his word.
- **OWNER RULE (28.08.2026): the site list is 100 programs for everybody — visitors, free and paid.** `LIST_LIMIT` in `.devtools/affiliate-site/lib/bulk.ts`; never lift it, never add a plan that lifts it. Plans change columns/exports/compares/alerts only.
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
- **OWNER RULE (06.09.2026, PINNED `BR-OPS-18`): do everything yourself; interrupt him only when there is genuinely no other way.** Verbatim: "DO EVERYTHING YOU CAN BYYOURSELF DISTRUB ME ONLY AND ONLY WHEN THERE IS NO ANOTHER OPTION NOT TO DISTURB ME IF IT'S NOT AGAINS THE RULES". Before asking for any credential, **look for it**: `~/.api-mcp/secrets.json`, `~/.oci/config`, `repositories/mcp/api-mcp/` (service-account JSON, connector YAML), `.devtools/.*env`, `.devtools/.dburl`. In this session he was asked three times for credentials that were already on disk — GA4/Search Console (service account, already `siteOwner`), the Clarity token (`clarity_api_token`), and OCI (`~/.oci/config`, which works; sign requests with `openssl` when the SDK is missing). Asking is the last resort, not the first. Legitimate reasons to interrupt: a decision only he can make (money, scope, what ships), a genuinely irreversible action, a vendor step no API exposes (enabling Cloudflare R2), or a rule that forbids acting (BR-OPS-17).
- **OWNER RULE (04.09.2026, PINNED `BR-OPS-17`): affiliate-registry.com deploys go to PREVIEW FIRST AND ONLY.** Verbatim: "FROM NOW ONE PUT EVERYTHING TO PREVIEW FIRST AND ONLY - ONLY AFTER I DECIDE TO PUSH TO PRODUCTION THEN DEPLOY TO PRODUCTION!!! THIS IS THE MOST IMPORTANT RULE AND CONSTRAIN I WANT CLAUD ECODE TO ABIDE FOR preview.affiliate-registry.com DOMAIN". The only deploy command is `bash .devtools/affiliate-site/ops/deploy.sh` (preview + alias `preview.affiliate-registry.com` + gate). Production = `ops/deploy.sh --production --owner-decided <url>` only after he says "push to production" in that session. Constant `ops/deploy_policy.mjs`, test `tests/deploy-policy.spec.ts`. Since 06.09.2026 the site runs on Hetzner/Coolify and the preview host is **`stage.affiliate-registry.com`** (`PREVIEW_HOST` in `deploy_policy.mjs`; own DB `app_stage`, sandbox-only billing); the quote's `preview.` host name is historical. Production = `--production --owner-decided <sha>` (fast-forward of `main` to the gated commit). Two short messages seconds apart are two orders — "push to production" + "Open billing to everyone" (05.10) were wrongly read as one.
- **OWNER RULE (31.08.2026): only *proven* search engines read the home list as HTML.** Verbatim: "ONLY SEARCH BOTS can view
  freely home page and only for guest with no authentification session … signed in user still should not be able to open devtools
  and make requests to the website" — pinned as `GUARD.crawlerHomeSsr` in `affiliate-site/lib/guard/config.ts`. A UA is only a
  claim; it is settled by forward-confirmed reverse DNS (`lib/guard/searchBot.ts`), so a spoofed Googlebot gets the ordinary guest
  page. Guests keep the sealed chunk + ListGuard; a session never takes that path, `/api/programs` needs the page token beside the
  session, and signed-in reads are capped per day. Enforced by `tests/searchbot.spec.ts` + `tests/crawlers.spec.ts` + `tests/guard.spec.ts`.
- **OWNER RULE (29.08.2026): crawler blocking is HOME PAGE ONLY.** Verbatim: "ONLY ON HOME PAGE. NO BLOCKING FOR AI
  CRAWLERS OR ANY OTHERS CRAWLERS ON OTHER PAGES EXCEPT HOME" — pinned as `GUARD.crawlerBlockHomeOnly` in
  `affiliate-site/lib/guard/config.ts`; robots.txt disallows are `/$` + `/<locale>$` only; the Cloudflare WAF custom
  rules carry a `http.request.uri.path eq "/" …` prefix; Bot Fight Mode and the AI-bot block (zone-wide, not
  path-scopable) stay OFF. Enforced by `tests/crawlers.spec.ts`. Never re-widen.
- **Affiliate Registry business requirements live in `.devtools/affiliate-site/docs/requirements/`** (index `README.md` there; area rules auto-load from that repo's `.claude/rules/`). Read the relevant file before changing site behaviour, and do not infer business rules from the code or its `README.md` — both have drifted. The owner rules below are the pinned subset; the docs carry the rest with dates and verbatim quotes.
- **OWNER RULE (29.08.2026): legal texts of affiliate-registry.com promise nothing beyond applicable law.** Verbatim:
  "GIVE NO EXCESSIVE PROMIESES!!! JUST BARE MINIMUM AND IF IT"S NOT CRITICAL GIVE ABSOLUTELY NO PROMISES TO HAVE NO
  OBLIGATIONS!!" — pinned as `NO_VOLUNTARY_PROMISES` in `affiliate-site/lib/legal/index.ts`, enforced by
  `tests/legal-minimum.spec.ts` (no SLAs, "we will", refund promises, notice periods, "no argument/free of charge").
