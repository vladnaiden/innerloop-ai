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

## Rules for Claude

- Read `wiki/about-me.md` first when you need to know the user; follow its
  read-order contract. Do not load the whole vault.
- `inbox/` is read-only source material — never modify it.
- `wiki/LESSONS.md` is updated only through `/reflect`; never append raw notes.
- Guard wiki page writes with `scripts/wiki-lock.sh acquire <path>`/`release <path>` (per-file; a bare `acquire` errors).
- Personal data (`wiki/`, `inbox/`, `.raw/`) is gitignored — never `git add -f` it.
- This repo is its own testbed: when a session surfaces friction, a gap, or a
  bug in the engine, fix it (or propose the fix) as part of that session —
  the product improves through use.

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
  - **Keep it slow.** A burst of ~40 probe requests got the NordVPN account
    throttled, and while throttled *every* exit fails identically
    (`ERR_BAD_RESPONSE: stream has been aborted`) — which reads like a
    site-wide block but is the provider. `anonfetch_status`'s `diagnosis`
    field names it correctly; back off a few minutes. Aborted streams also
    show up sporadically on healthy pools (anonfetch does not spoof TLS/JA3);
    the built-in retries absorb them.
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
    stream with `anonfetch_status` reporting no systemic failure. Run `--check`
    until it comes back green *before* spending a scan, and keep the default
    `--rotation sticky` so a working exit gets reused instead of re-gambling
    every request.
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
