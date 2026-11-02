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
| `to-fix-loop` | "improve fix to and deploy": read every `to-fix/*.png`, patch, gate, deploy from a clean worktree, delete only proven-fixed shots |
| `secrets-intake` | Pasted key/token/password → env file without echo, one verification call, one rotate note |
| `publish-gate` | Hosted DB changes only on "push": backup both, cleaners, competitor-link grep, `sync --prune`, verify counts |
| `pin-invariant` | ALL-CAPS "never change this" → constant + verbatim quote + test + CLAUDE.md line |
| `diagnosing-bugs` | Hard bug / "still broken" / "why can't you verify what's not working" → a red-capable command first, then minimise → ranked hypotheses → instrument → regression test (mattpocock/skills, MIT; a site-seam copy lives in `.devtools/affiliate-site/.claude/skills/`) |
| `wizard` | Any step only he can do (paste/rotate a key, re-login, vendor dashboard) → a bash wizard he runs in a VS Code terminal: hidden entry, writes the env file, verifies, stamps `~/.claude/wizards/done.jsonl` (mattpocock/skills, MIT) |
| `/handoff` | User-invoked: compact the session into `output/<date>/handoffs/` with its full session id before context runs out or a `/branch` (adapted from mattpocock/skills) |

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
- This repo is its own testbed: when a session surfaces friction, a gap, or a
  bug in the engine, fix it (or propose the fix) as part of that session —
  the product improves through use.


## Directory sources (added 27.08.2026) — `.devtools/crawl_sites.js`

One runner, one module per site in `.devtools/sites/<name>.js` (`{name, lang, region,
list(af), parse(html, url)}`; `parse` may return an array for table pages). The runner
owns pacing, raw HTML (`raw_pages/<site>/<slug>.html.gz`), resumable state + per-site
lock (`.sites-state/`), listing pagination via an optional `next(html, url)` on the module, a custom transport via optional `fetch(af, item)` (Livewire/POST sources), provenance (`extra.provenance`, `source_url`, `parser_version`
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
| `cpainform_networks` | cpainform.ru/networks | RU networks: site, opened, offers count, rating /100, payout methods/terms, engine, vertical mix | ~225 |
| `offers_help` | offers.help | EN iGaming/CPA offers from 25 networks: goals (type, price, currency), GEOs, traffic types (from __NEXT_DATA__; API keys never stored) | ~2,700 |
| `affbank` | affbank.com/offers/<network> | offer aggregator, ~37k rows from per-network listings (id, name, network, GEO, category, payout); the runner follows `next()` pagination | ~37,000 |
| `admitad_store` | admitad.ru/store/offers | Admitad public showcase: EPC, CR, approval %, processing time, regions, tools, categories (rates are login-only, not claimed) | ~680 |
| `affnext` | affnext.com | programmes + networks: LD-JSON profile, specialties (no figures — prose only) | ~1,150 |
| `businessofapps` | businessofapps.com/affiliate | affiliate-network profiles: tagline, rating /10 + votes, sign-up link, models mentioned | ~125 |
| `afftrends` | afftrends.com/partner | RU editorial network reviews: rating /5, CPA span, verticals, GEO, minimum, founded | ~80 |
| `cpa_club` | cpa.club/en/companies | ~240 network profiles with named managers (role, email, Telegram, Skype), tags, ratings, socials | ~240 |
| `affroom` | affroom.com reviews | programme/network reviews: rating /5, vertical, brands, commission type, countries, minimum, payment frequency/methods | ~80 |
| `affcatalog` | affcatalog.com/en/aff-program | iGaming programmes: terms table (min payout, frequency, negative balance, admin fee, software, licence, cookie, conversion window, CPA/RevShare/Sub-aff, founded), payment methods, brands, target/forbidden GEOs | ~1,460 |
| `aff_studio` | aff.studio/directory/affiliate-program | iGaming programme profiles: details grid (commission type/details, payout frequency, min payout, admin fee, negative balance, cookie, licence, founded, software), target GEOs, brands, house grade, rating | ~785 |
| `reditus` | getreditus.com/affiliate-programs | B2B SaaS programmes: commission, commission length, cookie window, network, payouts, official apply link | ~165 |
| `afftank` | afftank.com/review | ~210 network reviews: offers count, rate, referral %, tracking, minimum, frequency, methods, named managers with email + Telegram | ~210 |
| `affiliate_watch2` | affiliate.watch/affiliate | 916 programmes from the page's Inertia JSON: join link, earnings teaser, cookie, launch year, socials, AI rating /100, payment methods, categories, tags (replaces the thin legacy adapter) | 916 |
| `uppromote` | uppromote.com/affiliate-directory | ~780 programmes: commission, cookie, regions, website, niche, platform, join link, editorial feature tables | ~780 |
| `partnerstack_market` | market.partnerstack.com/page | PartnerStack public marketplace: offer structure, commission length, cookie, payout method/timing, attribution, features | ~400 |
| `affiliateroll` | affiliateroll.com/programs | curated directory: commission, type, cookie, minimum payout, payment methods, launch year, benefits | ~165 |
| `bap_list` | best-affiliate-programs.net (Livewire) | only the first page is reachable from outside (the component ignores `page` updates and `search()` returns 0 without the site's session) — kept for the seed ids | 17 |
| `bap_detail` | best-affiliate-programs.net/programs/x/<id> | 45,413 programme pages walked as a graph (each page links ~10 related programmes; `next()` returns them all): tags, parameters (status, currency, CPA/CPL, RevShare, bonuses), supported/forbidden countries, last update | ~45,000 |
| `indoleads` | indoleads.com/offers | Indoleads public offers: model, GEO, eCPC, hold, CR, cookie, creatives flags, traffic-restriction grid | ~460 |
| `affcaptain` | affcaptain.com (programmes + networks) | details table (base commission, model, minimum, frequency/methods, referral %, tracking, cookie, GEOs, managers, traffic), editorial rating, pros/cons | ~770 |
| `tradetracker` | tradetracker.com/<cc>/campaigns | 25 markets × categories: brand, logo, blurb, network — **first 12 per category only** (load-more is client-side), no commissions | partial |
| `linkclicky` | linkclicky.com/affiliate-program | ~1,750 US/CA programmes: website, niches, platform (network), regions, commission, official join link (template "how to join" text not stored) | ~1,750 |
| `statsdrone` | statsdrone.com/affiliate-programs | 3,637 iGaming programmes: labelled review sections (commission, carryover, CPA, sub-affiliates), tracking software + exposed stats, brands with sites, contact card, join link | 3,637 |
| `communicationads` | communicationads.net/de-de/publisher/partnerprogramme | communicationAds (DACH telecom/energy network): commission per lead/sale in EUR, model, cookie days, territory, advertiser site, programme text | ~85 |
| `partner_ads` | partner-ads.com/dk (20 category lists → showprogram2.php?id) | Partner-ads, Denmark's largest network: sale commission % / per-lead amount, description, advertiser website (ISO-8859-1 source) | ~1,230 |
| `leadgid` | cpa.leadgid.ru/offers (sitemap-offers.xml) | Leadgid CPA (RU/CIS finance): payout span + currency, CR/AR/EPC/EPL, vertical, product type, traffic type, payment frequency, target action, join link | ~600 |
| `actionpay_br` | actionpay.com.br/en/wmOffers | Actionpay Brazil: per-aim rows (payment, currency, processing, post-click, accept rate), geo, description, advertiser site (CSV export exists too) | ~300 |
| `webgains` | webgains.com/advertiser-directory → programID pages | Webgains public programmes (only the ~76 linked from the directory resolve; other IDs bounce home): commission, cookie, EPHC, CR, currency, live-since, named account manager | ~76 |
| `adpump` | adpump.com/en/wmOffers | Adpump performance network (CIS/EU/LATAM), same engine as Actionpay (`_actionpay_engine.js`): per-aim rates, geo, description | ~1,080 |
| `primelead` | primelead.com.ua/master/offers → /offer/<id> | PrimeLEAD (UA CPA network): payout % / UAH, EPC, CR, start date, post-click, hold, allowed traffic, category, description | ~185 |
| `drcash` | dr.cash/offers/<id> (own `/v1/offers?limit=30&offset=N` fragment) | dr.cash nutra CPA network: payout + currency, model, approve %, GEO, niche, product price, status, rules | thousands |
| `nutriprofits` | nutriprofits.com/offers.html | NutriProfits nutra CPS network: one table — category, target countries, commission %, avg commission USD | ~60 |
| `twoperformant` | 2performant.com/affiliate-programs (wp-sitemap-posts-program) | 2Performant (RO's largest network): commission, cookie, currency, time to payment, rankings, since, countries, category, site, description | ~510 |
| `profitshare` | profitshare.ro/affiliate-programs | Profitshare (eMAG's RO network): commission range, cookie period, approval rate + days, feed flag, category, site | ~65 |
| `cuelinks` | cuelinks.com/campaigns?page=N → /campaigns/<slug> | Cuelinks (India): payout upto % / ₹, 3-month + 1-week EPC, tracking/validation/payment timings, categories, cookie, deeplink, incentive + social allowance, FAQ commission range | 1,000+ |
| `cpa_rating` | cpa-rating.ru/partnerka/<slug>/otzivy | RU network rating: site, category, minimum, star rating + votes, review tallies, offers count, closed flag (offer tables are JS templates — not parsed) | ~40 |
| `saleads` | saleads.pro/offers?page=N → /offers/partnerskaya-programma/<slug> | Saleads.pro (RU CPA: finance, HR, courses, surveys, insurance): payout per action in RUB (spans), action, category, description | ~510 |
| `cpa_house` | cpa.house/webmaster/offer/detail/<id> (ids 1–10200) | CPA.house nutra network: per-country payout rows (price, payout $, limits), CR, approval %, description, rules, traffic sources | ~8,000 |
| `alverde` | alverde.net/blog/directory-programmi-di-affiliazione/<category>/ | alVerde IT directory (since 2001): per programme PPS/PPL/PPC terms as published, managing networks, summary, tags, sheet link — one record per listing row | ~400 |
| `eprovize` | e-provize.cz (post-sitemap.xml) | E-provize CZ programme database: cookie days, commission, profit type, min payout + method, founded, network/platform, signup link, auto-approval / dropshipping / referral / export / promo flags, forbidden promotion, rating | ~650 |
| `affiverse` | affiversemedia.com (WP REST `affiliate_directory`) → /affiliate_directory/<slug> | Affiverse iGaming programme profiles: RevShare / CPA / Hybrid lines, sub-affiliate %, cookie, software, API/postbacks, accepted traffic — "Label: value" lines kept as data | ~130 |
| `affisearch` | media-analytics.jp/affisearch/promotions (sitemaps promotions-N.xml) | アフィサーチ (JP): 6,500+ affiliate cases — per-ASP reward (円 / %), ASP name, blurb + conditions, category, per-ASP availability table | ~6,550 |
| `gdetraffic` | gdetraffic.com/Partnerki?page=N → /Partnerki/<slug> | Где Трафик CPA-network catalogue: offer types, features, payment systems, payout terms, hold, webmaster count, tags, intro | ~100 |
| `affmoment` | affmoment.com/partnerki/<slug>/ | AffMoment (RU) network profiles: vertical, payment model, minimum, payout methods, features, site + email, rating /10, reviews, description | ~150 |
| `fifteen_m` | 15m.com/affiliate-programs (WP REST `affiliate_programs`) | 15M iGaming programme reviews: verticals, traffic sources, commission models, sub-affiliate, min payout, founded, GEOs, cookie, support, licence, contact email, sign-up link, RevShare % range | ~60 |
| `afliet` | afliet.com/program/<slug> (sitemap) | أفلييت Arabic directory (MENA): commission model + %, cookie, payment methods, min withdrawal, frequency, Arabic support, acceptance ease, sign-up link — "غير مؤكد" never numerised | ~110 |
| `vivnetworks` | vivnetworks.com/affiliate-katalog (paginated) | VIVnetworks (CEE network): commission + per-channel tiers, cookie, condition grid (SEM, XML feed, coupons, S2S, cashback, creatives), category, named manager + email, description | ~650 |
| `affilord` | affilord.com (WP REST `affiliate_programs`) | Affilord crypto-casino programme directory: site, Telegram, email, about, GEO regions, licence, products, commission types, payout methods, carryover / admin-fee / crypto / streamer flags | ~130 |
| `travelpayouts` | travelpayouts.com/brands-directory (page's own `api.php?type=graph` JSON) | Travelpayouts public brands: reward rate, cookie lifetime + other offer params, categories, caption, hot/exclusive flags, offer landing — one record per brand | 46 |
| `gooodbro` | gooodbro.com/affiliate_program?page=N → /affiliate_program/<slug> | Gooodbro CPA-network catalogue (same engine as Где Трафик): offer types, features, payment systems, payout terms, hold, tags — only ~25 profiles despite 25 vertical categories | ~25 |
| `gambling_partnerki` | gambling-partnerki.com/affiliates/<slug>/ | RU gambling-network rating: rating /5, launch year, income models, minimum, offers, GEO, software, reporting period, payout speed, payment systems, sub-affiliate % | ~25 |
| `leadpanda` | leadpanda.media/partner-cat/all/page/N → /partner/<slug>/ | Lead Panda Media (UA) network reviews: short description, rating /5 + reviews, network site, categories, payment models mentioned | ~150 |
| `topranked` | topranked.io/all-listings (listing-sitemapN.xml) | TopRanked.io directory: headline commission teaser, category, review count, affiliate-registration link, overview + review sections | ~310 |
| `findaffiliates` | findaffiliates.online/<slug>-affiliate-program (sitemap) | FindAffiliates directory: category, commission, cookie days, advertiser site, description, last-verified date (apply links login-gated) | ~5,070 |
| `zorbasmedia` | zorbasmedia.ru/programs (WP REST `programs`) | ZorbasMedia (RU) network reviews: founded, verticals, models, GEO, payment systems, min payout, forbidden traffic, offers count, site, Telegram, managers | ~300 |
| `crypto_brands` | seed list of ~80 exchange / wallet / broker domains → their own affiliate pages | Brand-published crypto terms via `rate_terms` (commission wording next to the number); domains without an affiliate page or without published terms are recorded as gone | ~80 |

Rejected after probing: getlasso.co / affiliateprogramdb.com (403 on every exit),
gdetraffic.com root (article feed — the `/Partnerki` catalogue is now a module), theaffiliateslist (paywalled),
Chinese CPS networks (duomai / yiqifa / linktech are login-only JS shells — no public
advertiser list exists to parse), adtraction (brand cards load via /ajax/, no HTML),
daisycon (JS-rendered list), admitad (no public catalogue any more), mylead (404),
webepartners (≈15 programmes), affiliatecorner.co (Vite SPA — 3 KB shell, bundle exposes no listing API), all-affiliates.com (country pages only), flexoffers directory (429), adcell.com (programme URLs bounce to the homepage — login-only), superclix.de (dead domain), awin / avantlink / digistore24 / adrecord (no public programme list), cityads.com (auth wall), salesdoubler.com.ua (522 on every attempt), afilo.pl (now a programmatic LP), convertiser / paypro (no catalogue), leadgid main site is a Nuxt shell — use cpa.leadgid.ru; 7offers.ru / affilae / kwanko (no public catalogue), pdl-profit.com (JS shell), leadbit.com (404), linkhaitao.com (Chinese cross-border network — merchant pages are public SSR but `/brand/list` needs a login token and the public offer feed exposes only ~20 merchants), everad (no catalogue), worldfilia / sprintrade (agency sites), programypartnerskie.pl (parked), cpa.tl (empty), adrecord (503), affiliateseeking.com (parked), associateprograms.com (522), double.net (expired cert), adservice.com (= Adtraction), chanet.com.cn (cert mismatch), linkstars.net / cpamonitor.ru / allcpa.ru (TLS refused on every exit), tolt.io / mylead.global (no public directory URL), affistash (tool, no catalogue), afilio.pl (for sale), saasaffiliates.co (throttled out), guruleads.ru (offers behind login — public page shows examples only), kma.biz (404), shakes.pro (no offer list), terraleads (401), ad1.ru (throttled out), pampadu.ru (brand pages >5 MB — over the anonfetch cap), mobidea.com (only 12 showcase offers public; other ids fall back to the listing), adcombo / m1-shop (403), leadrock / webvork (no public offers URL), lucky.online (JS shell), affpapa.com (Cloudflare Turnstile), partnerprogramme.de (self-signed cert), affiliate-verzeichnis.de (connection reset), affiliateprogramma.nl / partnerprogramm-verzeichnis.de (throttled out), affiliate-programme.de (for sale), belboon / effiliation (agency sites, no list), gelirortaklari.com (cert mismatch), affiliate.hu (empty), involve.asia (444), accesstrade.vn / ecomobi (no public campaign list), linkwise.gr (cert mismatch), reklamaction (empty), vcommission (offers load via admin-ajax behind the form), dognet campaigns page >5 MB, optimise / partners.kz / affiliate.ua (throttled out), earnkaro / admitad.com / rakutenadvertising (no public catalogue), awin & cj directories (404), gelirortaklari (empty), protraffic.com (redirect loop), rewardful (no directory), partnero marketplace (JS-only, no inline data), affiliates.directory (for sale), partnerki.info (thin RU catalogue: description + geography only, no terms), cpa-network.ru (browser check), affiliatesnetwork.ru / affstore.ru / monsterleads.pro (throttled out), salid.ru (course pages carry no terms), lead-r.ru (login), offerrum (shell), alfaleads (404), uffiliates.ru (cert mismatch), 3snet.co (editorial GEO round-ups naming brands, no terms), leads.black (= leads.su, already covered), cpanomer1 (Next shell), funcpa.ru (dead), apilead (empty), ctr.ru / mobytize (throttled out), linkbux.com (merchant search behind login), partnerboost.com/brands (marketing page, no list), 360lian / wanglian (throttled out — CN union listings unreachable from the pool), cpsbang / tuia (throttled out), salesdoubler (finline.ua / salesdoubler.pro — no public offer list), affise (software vendor), trafficlight (TLS), gelirortaklari / linkwise.gr (cert mismatch on every host form), affiliate-programs.gr / adpower.com.tr (throttled out), adform (ad tech), reklamz (empty), cpalead.com marketplace (99 offers, public pages carry no payout), crakrevenue (4 editorial cards per vertical), unicom24 (partner cabinet SPA), traffic.club (domain marketplace), lemonad.ru (untrusted cert), advertise.ru (offer table is a doT template fed by an XHR `/offers/?…` that returns the HTML shell without a browser session), affiliate4you.nl (throttled out), partnerprogramma.be (parked), affiliate-marketing.ch (cert), adtraction/lt (404), affiliate.lt (reset), aff1.ru (Elementor editorial network reviews — prose only, ~20 per vertical), cpawords.pro (catalogue page empty), partnerskieprogramy.pl (blog with a handful of program posts), cpaukraine.net / hw.in.ua (articles), ore.pp.ua / sharklink.io / leadtrade.pro (throttled out), mylead.global (public side is blog articles only), money2money.pl (cert), comperialead / cpabazuka (no public list), affiliatepro.it (article, not a catalogue), 1tpe.com (no public product list), travelpayouts (no programs page), medikalize (for sale), affiliatesturkiye / katalog.affilblog.cz / getsobear.hu (throttled out), adrecord list-programs (503), cps.ym.qq.com (Tencent CPS — JS shell), zhuandaoke.com (CN link directory of ad networks — names + blurbs only, no terms), goboblo (410), affiliateprogramfinder.com (404 everywhere), myaffiliateprogramdirectory.com (one listing), affiliate.lv (a few posts), earnifyhub (article), uzdarbis.perkuinternete.lt / masoffer.net / rentracks.vn (throttled out), valuecommerce.ne.jp/client (advertiser names only, no terms), a8.net / adpia.vn / ec.work-son.com / accesstrade.in.th (no public lists), affisearcher.com (SPA shell), affiliate-cross-search.com (ASP presence per product, no rewards), cpatop.ru (JS shell), afftimes.com (redirect loop), zorbasmedia.ru tag feeds (the `/programs/` reviews are now a module), letmeads.com (a handful of cards), omt.de / trusted.de (403), omr.com reviews (software-review ratings for ~60 networks — no programme terms), 100partnerprogramme.de/affiliate-netzwerke (11 network profiles); ES/PT-LatAm searches return editorial lists only, cpaaggregator.com (530), offerator.ru (expired cert), vipcpaclub.ru / revduck.com (articles); Turkish / Persian / Hebrew / Greek searches return editorial lists only (affili.ir throttled out, linkwi.se catalogue is login-only, timologic.gr is an article); PL/BG/HR searches: netsalesmedia / superpartners (no public catalogue), conversand.pl (parked), properad.pl (one-page ranking of ~27 networks), afiliate.start.bg (link directory, names only); VIVnetworks' country editions expose the same ~650 programmes as the CZ catalogue; affiliate-marketing.de's public DACH section (98 categories) is fully covered by `affiliate_marketing_de` (5,333 merchants) — the "60,000 international programmes" are its paid database; DE/FR/ES "network public catalogue" searches return editorial lists only; a bulk probe of /offers and /advertisers on 22 further network domains from the registry found no public catalogue (directaffiliate.com shows 6 teaser offers; the rest are shells); a sitemap sweep of the JS-only/blocked directories (affiliatecorner, affpapa, partnero, mobidea, getlasso, affiliateprogramdb, affiliatly, linkhaitao, lucky.online) surfaced no fetchable programme URLs — affpapa's sitemaps list 63 affiliate *people*, and its pages stay behind Turnstile; JP/KR round 2: dokoafi.com (ASP-presence counts per advertiser, no rewards), linkprice merchant page (testimonials), afb ranking (JS), もしも/afb catalogues login-only; avangatenetwork.com / 2checkout affiliates (Incapsula bot wall), marketplace.refersion.com (listing behind auth.refersion.com); a retry of the earlier "throttled out" hosts (sharklink.io, katalog.affilblog.cz, getsobear.hu…) on a healthy pool failed identically — they refuse datacenter exits, not a Nord limit; forex/crypto round: bestibaffiliateforexcommission.com (36 brokers, but the CPA/rebate figures are the aggregator's own enhanced IB rates — not the brokers' published terms), bestforexib.com (landing), forexaffiliate.net (become-ib links redirect to broker portals), tradersunion (403); crypto searches are editorial lists; bundle-endpoint scan (the trick that unlocked Travelpayouts) on partnero marketplace (Next/Builder page, listing fetched by a chunk not referenced from the shell), cpatop.ru (3 KB rating script) and lucky.online (no scripts at all) found nothing; affspot.ru is an article of /go/ links; KZ/BY searches point back to sources already covered; PL round 2: make-cash.pl catalogue (403), leadstar.pl programme catalogue (login-only), other hits editorial; IT/ES round 2: monetizzando.it (editorial list with a few network posts), e-leads.it / worldfilia (no public offers), partnerkin's IT/ES editions duplicate the RU data already covered; directory.idevaffiliate.com is "open during construction" (invite-only listings); DE/FR "one page per programme" searches: editorial only (oseox.fr is an article about directories); crypto round 2: bifanyong.com (CN exchange fee/rebate lookup — the rebate % is the site's own invite-code split, not a programme rate; it also carries its own referral codes) rejected; partnerkin.com/offer/<category> is an offer catalogue (109 crypto offers per page, title = offer + rate + network) worth a module once the pool is quiet; the crypto brand-page pass (`brand_affiliate --vertical crypto`) yields ~5% hits and was paused when the Nord session cap tripped; crypto round 1: guessed crypto-directory domains (cryptoaffiliates.io, crypto-affiliates.com, coinaffiliates.com, cryptoaffiliateprograms.com) do not resolve; icobench / rockwallet / affmaven / bitbo / 99bitcoins are editorial lists with tracked links; NL/BE/NO searches: editorial top-N lists only (jijverdienthet, slimmerverdienen, deonlineondernemer); WP REST re-probe of affroom / afftrends / affcaptain confirmed their HTML listings already cover the post types, financeAds (public showcase is 8 programmes; the 500+ are behind login), letmeads (3), affylist (JS, 5 MB pages), wowtrk (Cloudflare challenge), annonsering.se (login since 2019), dognet (single >5 MB page — over the anonfetch cap), affbun (Cloudflare challenge on every exit), casinoaffiliateprograms.com (522), GPWA (403), AffiliateGuardDog (forum).

## Free infrastructure & credits available (checked live 28.08.2026)

Owner rule: **no pay-as-you-go anywhere.** Everything below is $0 or a pre-paid credit.
Full table with catches in `wiki/sources/Free infrastructure & credits (28.08.2026).md`.

- **OCI Always Free** (permanent, no PAYG upgrade needed; billed only if you explicitly
  upgrade): 2× E2.1.Micro AMD (1/8 OCPU, 1 GB) — **one already runs the production
  Postgres 16 + PgBouncer at `db.affiliate-registry.com`** (Frankfurt, since 28.08.2026);
  ARM A1.Flex **2 OCPU + 12 GB total** (shrunk from 4/24; "out of host capacity" is
  common — retry/quiet region); 200 GB block storage; 10 TB egress/mo; MySQL HeatWave 50 GB;
  2× Oracle Autonomous DB 20 GB; NoSQL; Email Delivery 3,000/mo; 1 flexible load balancer.
  **No managed Postgres** — self-host on a VM. Idle VMs get reclaimed (7 days) → keep the
  crawler/DB busy and `pg_dump` off-box.
- **GitHub Student Developer Pack** (only while student status is real — GitHub re-verifies;
  misuse = pack revoked + account suspension risk, which would take the repos and Vercel
  login with it). **DigitalOcean left the pack; all credits expired 01.08.2026.** Still
  useful: **Heroku $13/mo × 24 mo** → Heroku Postgres Essential-1 (10 GB, $9) as a managed
  fallback DB; **Azure $100** (≈6 mo of a B1ms Postgres — short runway, not a foundation);
  SendGrid/Mailgun (transactional email, plan alerts); Sentry; Datadog / New Relic (uptime,
  adapter-returns-0-rows alerts); Icons8 / Iconscout; Polypane (design-loop viewports);
  Termius, 1Password, Copilot Pro, Codespaces. MongoDB $50 / Appwrite / LocalStack — not
  Postgres, not needed. JetBrains student licence is **non-commercial only**; all other
  credits may be used on the commercial site.
- **Free tiers that no longer fit:** Supabase (500 MB storage / 5 GB egress — hit 397%
  egress and throttled the site; never point production back), Neon 0.5 GB, Vercel
  Postgres 256 MB. Hosted DB is ~780 MB; local crawler DB is 9.3 GB (`mr_program` 5.3 GB).
- **Promotion:** nothing in either program promotes a site. Traffic = SEO on the program
  pages, `reddit-leads`, directories/forums — all free, none in the pack.

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
- **OWNER RULE (28.08.2026): the site list is 100 programs for everybody — visitors, free and paid.** `LIST_LIMIT` in `.devtools/affiliate-site/lib/bulk.ts`; never lift it, never add a plan that lifts it. Plans change columns/exports/compares/alerts only.
- **Plans layer (28.08.2026).** Limits are data in `.devtools/affiliate-site/lib/plans.ts`
  (visitor / free / pro / business); every gate reads them, never hard-codes a number. Payout
  terms and contacts are fetched client-side (`/api/contacts`) so the cached program HTML never
  carries them; exports go through `/api/export` with a per-account watermark; payments are a
  merchant of record (Lemon Squeezy, `lib/billing.ts`) — see `DEPLOY.md` "Plans, exports and
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
