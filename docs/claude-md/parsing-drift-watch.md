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
- **Plans layer (28.08.2026).** Limits are data in `.devtools/affiliate-site/lib/plans.ts`
  (visitor / free / pro / business); every gate reads them, never hard-codes a number. Payout
  terms and contacts are fetched client-side (`/api/contacts`) so the cached program HTML never
  carries them; exports go through `/api/export` with a per-account watermark; payments are a
  merchant of record (Freemius since 02.09.2026, `lib/billing.ts`; Lemon Squeezy and Creem before it) — see `DEPLOY.md` "Plans, exports and
  payments". Signed-in checks: `node ops/probe_plans.mjs`.
- **URL hygiene (29.08.2026).** `signup_url` / `landing_url` must never carry another directory's
  attribution. `.devtools/url_clean.js` (rules as data: tracking hosts/paths, attribution params, a
  "strong key" list that drops whole tracking links, directory-brand tokens in params/paths/hashes,
  an own-host list for provenance links, per-host keep-lists like CJ's `cid`) runs inside
  `crawl_sites.js` on every upsert; `clean_urls.js [--dry]` re-runs it over the table and logs every
  change to `backups/url_clean_<ts>.jsonl`. A dropped signup URL falls back to the cleaned landing page.
- `brand_affiliate.js --vertical crypto` restricts the brand-page pass to one vertical (rows tagged or classified crypto).
- Novelty >=20% means stop and look. It found `Affiliate Managers` on a live page
  that existed in no other sample.
- A rebuild that only changes class hashes must score ~0%: build-generated classes
  are stripped and boilerplate is keyed on text. Verify this still holds after
  editing the fingerprint.
