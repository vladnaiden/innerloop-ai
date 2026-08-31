# Source URL reference

Raw endpoint templates, kept so nothing is lost. Each is marked with whether the catalog
already covers it and how.

## Covered by an existing connector

| URL template | connector |
|---|---|
| `wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/{ARTICLE}/daily/{FROM}/{TO}` | `wikipedia.article_views` |
| `hn.algolia.com/api/v1/search?query={Q}&numericFilters=created_at_i>{EPOCH}` | `hn.search` — for a count, call with `limit: 1` and read `meta.total` |
| `api.stackexchange.com/2.3/questions?tagged={TAG}&filter=total&fromdate=&todate=` | `stackexchange.count` |
| `api.stackexchange.com/2.3/tags/{TAG}/info?site=stackoverflow` | `stackexchange.tag_info` |
| `api.npmjs.org/downloads/range/{FROM}:{TO}/{PACKAGE}` | `npm.downloads_range` |
| `pypistats.org/api/packages/{PACKAGE}/overall` | `pypi.overall` |
| `api.github.com/search/repositories?q={Q}+created:>{DATE}` | `github.search_repos` — date syntax goes in `q` |
| `api.openalex.org/works?filter=title.search:{Q},from_publication_date:{DATE}` | `openalex.works` — both go in `filter` |
| `trends.google.com/trending/rss?geo=US` | `google-trends.trending` |
| `api.cloudflare.com/client/v4/radar/ranking/top?limit=100` | `cloudflare-radar.top_domains` |
| `api.cloudflare.com/client/v4/user/tokens/verify` · `/zones` · `/zones/{ID}/dns_records` | `cloudflare.verify_token` / `.zones` / `.dns_records` — same token as radar. All three verified 27.08.2026 with the broad user token (`cfut_…`): 1 zone (`makeup-reviews.com`), 5 DNS records. Same token also OK for Workers scripts, KV, D1, Pages, Tunnels, Radar, `/user`; R2 denied (10042 — not enabled on the account, dashboard toggle). **WAF / bot management / email routing writes need the account-owned token** `CLOUDFLARE_ACCOUNT_TOKEN` (`cfat_…`, 27.08.2026) — user tokens (`cfut_`) got `Authentication error` there even with the groups added. Free plan rejects `matches`, `http.request.headers.names`; rate limiting additionally rejects any header/query field. `CLOUDFLARE_ACCOUNT_ID` also in `.env`; `~/.bashrc` exports both as `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` so `wrangler` works without login (`wrangler whoami` verified). Empty `zones` list ≠ error: Cloudflare does not distinguish "no permission" from "no zones". |
| `oauth.reddit.com/r/{SUB}/search?q={Q}&restrict_sr=1` | `reddit.subreddit_search` |
| `arctic-shift.photon-reddit.com/api/posts/search?subreddit={SUB}` | `arctic-shift.posts_search` |
| `googleapis.com/youtube/v3/search?part=snippet&q={Q}&publishedAfter={ISO}` | `youtube.search` |
| `api.adzuna.com/v1/api/jobs/gb/search/1?what={Q}` | `adzuna.search` — needs a key |
| `remotive.com/api/remote-jobs` | `remotive.jobs` — no key. Fetch once, match locally |
| `remoteok.com/api` | `remoteok.jobs` — no key. **Row 0 is a legal notice, not a job** |
| `jobicy.com/api/v2/remote-jobs?count=200` | `jobicy.jobs` — no key, carries an industry taxonomy |
| `api.reporter.nih.gov/v2/projects/search` | `nih-reporter.search` (phrase-scoped) / `.search_loose` — POST, no key |
| `rdap.org/domain/{DOMAIN}` | `rdap.domain` — domain availability from the registries themselves; envelope `status` 404 = unregistered. Needed `accept_status` in the engine. |
| `api.cloudflare.com/client/v4/zones/{ID}/rulesets/phases/…` · `/bot_management` · `/settings` · `/email/routing` | `cloudflare-admin.*` (`zone`, `settings`, `bot_management`, `waf_rules`, `rate_limits`, `email_routing`, `email_catch_all`, `firewall_events`) — account-owned token `cloudflare_account_token`; zone id defaults to affiliate-registry.com. Verified 27.08.2026 while the egress IP matched; later calls from `37.19.218.178` → `9109 Cannot use the access token from location` = the token carries an IP/location restriction (dashboard → token → Client IP Address Filtering). |
| `api.vercel.com/v6/deployments` · `/v9/projects/{ID}/domains` · `/v9/projects/{ID}/env` · `/v1/security/firewall/config/active` | `vercel.deployments` / `.domains` / `.env` / `.firewall` — CLI token `vercel_token`, team + project ids default to affiliate-registry. All four verified 27.08.2026. |
| `api.porkbun.com/api/json/v3/pricing/get` | `porkbun.tld_price` — TLD registration/renewal prices, keyless; one cached fetch serves every TLD |

## Cloudflare MCP servers (not connectors — remote MCP, installed 27.08.2026)

Installed in Claude Code via `claude plugin marketplace add cloudflare/skills` +
`claude plugin install cloudflare@cloudflare` (user scope; plugin ships skills + these
servers; run `/reload-plugins` or restart to activate). Source of truth:
`https://developers.cloudflare.com/agent-setup/prompt.md`. OAuth triggers on first tool
use; `cloudflare-docs` needs no auth. They cover what a YAML connector cannot (Workers,
KV/D1/R2 bindings, builds, logs) — do not duplicate them here.

| server | url | auth |
|---|---|---|
| `cloudflare-api` (Code Mode, full API) | `https://mcp.cloudflare.com/mcp` | OAuth |
| `cloudflare-docs` | `https://docs.mcp.cloudflare.com/mcp` | none |
| `cloudflare-bindings` (KV, D1, R2, Workers) | `https://bindings.mcp.cloudflare.com/mcp` | OAuth |
| `cloudflare-builds` | `https://builds.mcp.cloudflare.com/mcp` | OAuth |
| `cloudflare-observability` (logs, analytics) | `https://observability.mcp.cloudflare.com/mcp` | OAuth |

For other agents (Codex/Cursor/Windsurf/OpenCode): same five URLs under `mcpServers`
(Windsurf uses `serverUrl`), skills via `npx -y skills add cloudflare/skills --skill '*' --yes --global`.

## Not covered

| URL | why not |
|---|---|
| `api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live` | Paid (~$0.0006/request). HTTP Basic auth is already supported, so a connector is a short file whenever you want to fund it. It is the cheapest source of *exact* Google search volume — the thing Google Ads only gives in bands without ad spend. |
| `api.namecheap.com` (domains.check, users.getPricing) | Gated: API access requires a $50+ balance or 20+ domains, plus a whitelisted caller IP. `rdap` + `porkbun` cover the same questions keylessly; the one thing Namecheap adds is aftermarket premium prices for *taken* domains. |
| `api.godaddy.com/v1/domains/available` | Closed since 2024 to accounts under ~50 domains. |

## Notes on two tricks in this list

- **`filter=total` (Stack Exchange)** — strips the response to `{"total":1262}`. One quota
  unit, a 15-byte body. Now `stackexchange.count`, built for time series: one call per
  window gives a demand curve for a tag.
- **`hitsPerPage=0` (HN Algolia)** — does **not** work; the API returns HTTP 400. Use
  `hitsPerPage=1` and read `nbHits`, which is what `hn.search` already exposes as
  `meta.total`.

## Sources still to consider

Verified reachable, no credentials needed, no connector yet:

```
https://forum.bubble.io/latest.json
https://community.n8n.io/latest.json
https://community.retool.com/latest.json
https://web.archive.org/cdx/search/cdx?url=DOMAIN/pricing&output=json&fl=timestamp,original,digest&collapse=digest
https://boards-api.greenhouse.io/v1/boards/BOARD/jobs?content=true
https://api.lever.co/v0/postings/COMPANY?mode=json
https://api.ashbyhq.com/posting-api/job-board/NAME
https://apply.workable.com/api/v1/widget/accounts/SUB?details=true
https://data.sec.gov/submissions/CIK##########.json
https://itunes.apple.com/search?term=TERM&entity=software
https://itunes.apple.com/us/rss/customerreviews/id=APPID/sortBy=mostRecent/json
https://crt.sh/?q=%25.DOMAIN&output=json
http://index.commoncrawl.org/CC-MAIN-2025-05-index?url=DOMAIN/*&output=json
```

Caveats measured, not assumed: Wayback CDX needs a timeout above 20s or it aborts;
`crt.sh` returned HTTP 502 on both attempts, so it needs retry logic; `lever.co` 404s for
companies that do not use Lever, which is not an API failure.

Available through the existing BigQuery credentials, no new key:

```
bigquery-public-data.google_ads_transparency_center.creative_stats   -- ad longevity per region
githubarchive.day.*                                                  -- 1.9 GB/day
bigquery-public-data.pypi.file_downloads                             -- 1,953 GB unfiltered; needs hard date filters
httparchive.*                                                        -- 403 for this service account, unresolved
```

## The scope trap, measured

The same question asked two defensible ways returns wildly different numbers, and
nothing in the response tells you which one you got. Measured 2026-08-24:

| query | mode | result |
|---|---|---|
| NIH RePORTER FY2025 "brain computer interface" | `criteria.terms` (loose) | **76,271** |
| same | `advanced_text_search` on title+abstract | **40** |

A factor of 1,900. `nih-reporter` therefore ships both endpoints deliberately, with the
phrase-scoped one as the default: any figure you intend to *report* must come from
`search`, and `search_loose` exists only for discovery. `scripts/gap-scan.py` applies the
same discipline to GitHub — every count is taken loose and strict, and a row whose two
counts disagree by more than 10x is flagged rather than ranked.

## Search-engine and analytics stack (added 31.08.2026)

Added so affiliate-registry.com's SEO and AI-crawler strategy runs on measured data instead of
guesses. Each row says what it gives that the others cannot.

| connector | what only it gives | state 31.08.2026 |
|---|---|---|
| `search-console` | Google queries/pages/countries, index coverage per URL (`inspect`), sitemap status, sitemap resubmission | **verified live** — `sc-domain:affiliate-registry.com`, siteOwner. Real rows returned ("shopz affiliate" pos 1.29). Sitemap index submitted 31.08.2026, downloaded by Google in 1 s, 0 errors |
| `bing-webmaster` | Bing/DuckDuckGo/ChatGPT-search side, **absolute keyword impression volume** with no ad spend, and direct URL submission (`submit_urls`, `url_quota`) | **verified live 31.08.2026**: added via `add_site`, proved via DNS CNAME + `BingSiteAuth.xml` + `msvalidate.01`, verified with `verify_site`, 24 URLs submitted against a 100/day quota |
| `ga4` | what visitors did after they arrived: landing pages, source/medium, country/language — the demand side Search Console cannot see | **verified live** on property `551309693`. The property is **shared by 9 hostnames** (blog, old subdomain, 5 preview deploys, localhost), so every report is filtered by a `host` param defaulting to affiliate-registry.com; the `hosts` endpoint exists to reveal the blend |
| `clarity` | frustration signals no counter has: dead clicks, rage clicks, quick-backs, script errors, per URL | **verified live**, 16 metrics returned. All zero so far, which is consistent with ~24 sessions/28 days plus the consent gate and bot filtering — not a misconfiguration |
| `yandex-webmaster` | RU/BY/KZ/TR search, which is invisible to Google Search Console, plus a recrawl queue | connector ready, **needs an OAuth token stored as `OAuth <token>`** and a verified host |
| `indexnow` | one call reaching Bing, Yandex, Seznam and Naver — no per-engine account | **verified live**, 200 responses; the site's own cron batches up to 9,000/run |
| `cloudflare-analytics` | **requests per user agent at the edge — the only way to see whether AI crawlers are actually reading the site.** No answer engine publishes a webmaster console or a citation API, so crawl volume is the measurement | **verified live 31.08.2026**. Needed a token carrying the `Analytics Read` group — the account's general-purpose tokens do not have it, so a least-privilege one scoped to the single zone was minted. First reading: 482 AI-crawler requests in 24 h (GPTBot 373, OAI-SearchBot 72, ChatGPT-User 27, ClaudeBot 2, Perplexity 2) |
| `crux` | real-Chrome Core Web Vitals for the origin — the ranking-relevant speed number, not a lab score | already present, uses `google_api_key` |
| `openpagerank` / `tranco` | how contested the niche is and how strong incumbents are | already present |
| `dataforseo` | exact Google Ads volume/CPC per keyword | already present, **pay-as-you-go — against `BR-OPS-1`, use only deliberately** |

`scripts/index-push.mjs` is the submission side of all of this in one command; see
`.devtools/affiliate-site/docs/seo-analytics.md` for the operator runbook.

### Rejected after probing (31.08.2026)

- **Naver Search Advisor** — `searchadvisor.naver.com/api/v1/*` answers 404; there is no public
  third-party API, only the web console. Naver is reached through IndexNow instead.
- **Seznam Webmaster** — `api.webmaster.seznam.cz` does not resolve. Reached through IndexNow.
- **Google Indexing API** — exists and authenticates, but accepts only `JobPosting` and
  `BroadcastEvent` page types. Submitting a program page is a policy violation, not a shortcut.
  Google's sitemap ping was retired in 2023, so **for Google the sitemap is the only channel**.
- **Baidu push** (`data.zz.baidu.com/urls`) — endpoint is live (401 on a dummy token), but the
  token needs a Baidu Ziyuan account, which needs a Chinese phone number and an ICP-friendly site.
  Not worth it for a `zh` locale that is UI-only.
- **DuckDuckGo / ChatGPT search** — no submission or analytics API of their own; both draw on
  Bing's index, so `bing-webmaster` + IndexNow is the whole lever.

### Two traps in this API, both measured 31.08.2026

1. **`AuthenticationCode` and `DnsVerificationCode` are different codes.** `AuthenticationCode` is
   **account-level** — identical across every site on the account — and is what goes in the
   `msvalidate.01` meta tag and in `BingSiteAuth.xml`. `DnsVerificationCode` is **per site** and is
   the left label of a CNAME pointing at `verify.bing.com`. Using one where the other belongs fails
   silently: `VerifySite` just returns `false` with no explanation. The `sites` endpoint now
   projects both.

2. **`sites` was cached for 24 h**, which is the connector default and exactly wrong for the one
   endpoint you poll while verifying — it reported the site as absent long after `add_site`
   succeeded, which read as "the key belongs to another account". Now cached for 5 minutes.

### Engine note: `list: true` splits on commas, not JSON

`src/engine/request.ts` turns a `list: true` string into an array with `.split(',')`. Passing a
JSON array (`urls=["a","b"]`) yields `['["a"', '"b"]']` and the API rejects it — Bing echoed the
bracket-and-quote string straight back as `Invalid Urls`. Pass comma-separated values. The same
trap made a generic `ga4.report` endpoint unusable; it was replaced with a fixed `ga4.hosts`.

### Cloudflare GraphQL analytics, two things that waste an hour

- **The free plan refuses a window wider than 1 day** on `httpRequestsAdaptiveGroups`
  (`cannot request a time range wider than 1d`), and there is no retrospective history. Pull daily
  and store — `scripts/ai-crawlers.mjs --json` exists for exactly that.
- **GraphQL answers HTTP 200 even when it refuses.** The reason arrives in an `errors` array beside
  a null `data`, so a permission or quota failure looks identical to "nobody visited". Both
  endpoints now project `errors` into `meta`, and `ai-crawlers.mjs` exits non-zero on it.

### Cloudflare token split (31.08.2026)

Two tokens, and the difference matters:

| Secret / env | Token | Scope | Use for |
|---|---|---|---|
| `cloudflare_site_token` / `CLOUDFLARE_SITE_TOKEN` | *affiliate-registry.com site token (api-mcp)* | **one zone**, 5 permissions: Zone Read, Zone Settings Read, DNS Write, Zone WAF Write, Analytics Read | everything touching the website — DNS verification records, crawler WAF rules, AI-crawler analytics |
| `CLOUDFLARE_ACCOUNT_TOKEN` | *sparkling-king-1512* | **account-wide**, 166 permissions incl. Billing Write and Account API Tokens Write | global/account changes only |

Verified on creation: the site token reads its own zone, DNS, WAF rules and analytics, and is
**denied** the other zone, account settings, the token list and Workers. Prefer it by default; reach
for the account token only when the job genuinely is account-wide.
