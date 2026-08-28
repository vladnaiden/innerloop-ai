#!/usr/bin/env node
/**
 * Generic directory crawler. A site module (sites/<name>.js) knows how to list
 * programme URLs and parse one page; this file owns everything else: pacing,
 * raw-page persistence, resumable state, provenance, and the upsert.
 *
 *   node crawl_sites.js --site pp100 [--limit N] [--reparse] [--slug x] [--max-age-days 14]
 */
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const { Client } = require("pg");
const af = require("./af.js");
const crypto = require("crypto");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i === -1 ? d : process.argv[i + 1]; };
const SITE = arg("--site"); if (!SITE) { console.error("--site required"); process.exit(2); }
const site = require(`./sites/${SITE}.js`);
const LIMIT = +arg("--limit", 0), ONLY = arg("--slug"), REPARSE = process.argv.includes("--reparse");
const MAX_AGE = +arg("--max-age-days", 14) * 86400e3;
const RAW = path.join(__dirname, "raw_pages", SITE), STATE = path.join(__dirname, ".sites-state", `${SITE}.json`);
const METRICS = path.join(__dirname, ".crawl-metrics.jsonl");
fs.mkdirSync(RAW, { recursive: true }); fs.mkdirSync(path.dirname(STATE), { recursive: true });
// one writer per site: the supervisor's periodic pass must not race an initial crawl
const LOCK = STATE.replace(/\.json$/, ".lock");
try { const pid = Number(fs.readFileSync(LOCK, "utf8")); if (pid && pid !== process.pid) { process.kill(pid, 0); console.error(`another ${SITE} crawl (pid ${pid}) is running; exiting`); process.exit(3); } } catch (e) { if (e.code !== "ENOENT" && e.code !== "ESRCH") throw e; }
fs.writeFileSync(LOCK, String(process.pid));
process.on("exit", () => { try { if (Number(fs.readFileSync(LOCK, "utf8")) === process.pid) fs.unlinkSync(LOCK); } catch {} });
const PV = crypto.createHash("sha1").update(fs.readFileSync(path.join(__dirname, "sites", `${SITE}.js`), "utf8") + fs.readFileSync(path.join(__dirname, "sites", "_common.js"), "utf8")).digest("hex").slice(0, 10);
const metric = (o) => { try { fs.appendFileSync(METRICS, JSON.stringify({ t: new Date().toISOString(), job: SITE, ...o }) + "\n"); } catch {} };
const load = () => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return { done: {}, failed: {} }; } };
const save = (s) => { const tmp = `${STATE}.${process.pid}.tmp`; fs.writeFileSync(tmp, JSON.stringify(s)); fs.renameSync(tmp, STATE); };
const rawPath = (slug) => path.join(RAW, `${slug.replace(/[^a-z0-9._-]+/gi, "_")}.html.gz`);

const COLS = ["landing_url", "signup_url", "logo_url", "description", "network", "categories", "commission", "commission_type",
  "pct_min", "pct_max", "flat_min", "flat_max", "recurring", "lifetime", "cookie_days", "cookie_length_raw", "source_updated", "established_year", "tags",
  "countries", "currency", "min_payout", "hold_days", "payment_methods", "payment_frequency", "contact_email", "socials", "affiliate_managers", "phone", "telegram", "skype", "rating_avg", "rating_count", "offers_count", "vertical"];

async function upsert(db, row, slug, url, fetchedAt) {
  const domain = row.domain || `${SITE}.${slug}`;
  const name = row.program_name; if (!name) throw new Error("no program_name");
  const fullSlug = `${SITE}-${slug}`.toLowerCase().slice(0, 120);
  const extra = { ...(row.extra || {}), provenance: { site: SITE, url, fetched_at: fetchedAt } };
  // a parser that computed NaN has no value, not a broken one — never let it reach Postgres
  const vals = COLS.map((c) => c === "tags" ? (row.tags || []) : (row[c] === undefined || (typeof row[c] === "number" && !Number.isFinite(row[c])) ? null : row[c]));
  const sets = COLS.map((c, i) => `${c} = $${i + 6}`).join(", ");
  const base = [fullSlug, url, domain, name, JSON.stringify(extra), ...vals];
  // 1. our own row (by slug) — plain overwrite, this parser owns it
  const r = await db.query(
    `UPDATE mr_program SET detail_url = $2, source_url = $2, source_endpoint = 'GET ' || $2, source_fetched_at = now(),
       domain = $3, program_name = $4, extra = COALESCE(extra,'{}'::jsonb) || $5::jsonb, parser_version = '${PV}', parsed_at = now(), enriched_at = now(), last_checked = now(),
       site_adapter = '${SITE}', lang = '${site.lang}', region = '${site.region}', ${sets}
     WHERE slug = $1 RETURNING seq`, base);
  if (r.rowCount) return "updated";
  try {
    await db.query(
      `INSERT INTO mr_program (slug, detail_url, source_url, source_endpoint, source_fetched_at, domain, program_name, extra, parser_version, parsed_at, enriched_at, last_checked, site_adapter, lang, region, ${COLS.join(",")})
       VALUES ($1, $2, $2, 'GET ' || $2, now(), $3, $4, $5::jsonb, '${PV}', now(), now(), now(), '${SITE}', '${site.lang}', '${site.region}', ${COLS.map((_, i) => `$${i + 6}`).join(",")})`, base);
    return "inserted";
  } catch (e) {
    if (e.code !== "23505") throw e;
    // 2. the same brand already exists from another source (domain, program_name):
    //    fill only its empty fields and record that this source also lists it.
    const fill = COLS.map((c, i) => `${c} = COALESCE(mr_program.${c}, $${i + 6})`).join(", ");
    await db.query(
      `UPDATE mr_program SET ${fill}, extra = COALESCE(extra,'{}'::jsonb) || jsonb_build_object('also_on', COALESCE(extra->'also_on','[]'::jsonb) || jsonb_build_array($2::text)), last_checked = now()
       WHERE domain = $3 AND program_name = $4 AND slug <> $1 AND $5::jsonb IS NOT NULL`, base);
    metric({ ev: "merged", slug, domain, name });
    return "merged";
  }
}

(async () => {
  await af.init();
  const db = new Client({ host: "host.docker.internal", port: 5432, database: "app", user: "postgres", password: "postgres" });
  await db.connect();
  const state = load();
  let targets;
  if (REPARSE) {
    // a page that never parsed has no `done` entry — its URL lives in `failed`
    targets = fs.readdirSync(RAW).filter((f) => f.endsWith(".html.gz")).map((f) => { const s = f.replace(/\.html\.gz$/, ""); return { slug: s, url: state.done[s]?.url || state.failed[s]?.url || (site.urlFor ? site.urlFor(s) : null) }; }).filter((t) => t.url);
  } else {
    targets = await site.list(af, db);
    console.log(`${SITE}: ${targets.length} programme URLs listed`);
  }
  if (ONLY) targets = targets.filter((t) => t.slug === ONLY);
  const now = Date.now();
  const todo = targets.filter((t) => REPARSE || ONLY || !state.done[t.slug] || state.done[t.slug].pv !== PV || now - state.done[t.slug].at > MAX_AGE);
  console.log(`${todo.length} to ${REPARSE ? "re-parse" : "fetch"} (parser ${PV})`);
  const counts = { inserted: 0, updated: 0, merged: 0, failed: 0, skipped: 0 };
  let n = 0;
  for (const t of todo) {
    if (LIMIT && n >= LIMIT) break; n++;
    let html, fetchedAt;
    const p = rawPath(t.slug);
    // a stored page that is only stale by parser version is re-read from disk, not re-fetched
    const d = state.done[t.slug];
    const fromDisk = REPARSE || (d && d.pv !== PV && now - d.at <= MAX_AGE);
    if (fromDisk && fs.existsSync(p)) { html = zlib.gunzipSync(fs.readFileSync(p)).toString(); fetchedAt = d?.fetched || null; }
    else {
      const t0 = Date.now();
      // a module may own its transport (e.g. a Livewire POST) — it returns the page's HTML
      try { html = typeof site.fetch === "function" ? await site.fetch(af, t) : ((r) => r.html || r.text || "")(await af.get(t.url, { tries: 3, gapBase: 3000, maxChars: site.maxChars || 900000 })); metric({ ev: "fetch", ok: true, ms: Date.now() - t0, offers: 1 }); }
      catch (e) { metric({ ev: "fetch", ok: false, ms: Date.now() - t0, reason: String(e.message).slice(0, 40) }); state.failed[t.slug] = { url: t.url, at: Date.now(), reason: String(e.message).slice(0, 80) }; counts.failed++; save(state); await af.pace(5000); continue; }
      fetchedAt = new Date().toISOString();
      fs.writeFileSync(p, zlib.gzipSync(html));
      await af.pace(3000);
    }
    try {
      const tp = Date.now();
      const parsed = site.parse(html, t.url);
      // a listing-style page may yield many records; each gets its own slug
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      if (!rows.length) throw new Error("no records on page");
      const tu = Date.now();
      for (let i = 0; i < rows.length; i++) {
        const what = await upsert(db, rows[i], Array.isArray(parsed) ? `${t.slug}-${rows[i].key || i + 1}` : t.slug, t.url, fetchedAt);
        counts[what]++;
      }
      metric({ ev: "timing", parse_ms: tu - tp, upsert_ms: Date.now() - tu, rows: rows.length });
      // paginated listings: the module may name the next page, which joins the queue
      if (typeof site.next === "function") { const nx = site.next(html, t.url); const queued = new Set(todo.map((x) => x.slug)); for (const n of [].concat(nx || [])) if (n && n.url && !state.done[n.slug] && !queued.has(n.slug)) { todo.push(n); queued.add(n.slug); } }
      state.done[t.slug] = { url: t.url, at: Date.now(), pv: PV, fetched: fetchedAt }; delete state.failed[t.slug];
      if (n % 25 === 0) console.log(`  ${n}/${todo.length} · ${JSON.stringify(counts)}`);
    } catch (e) {
      counts.failed++; state.failed[t.slug] = { url: t.url, at: Date.now(), reason: "parse: " + String(e.message).slice(0, 80) };
      metric({ ev: "parse_fail", slug: t.slug, reason: String(e.message).slice(0, 60) });
    }
    save(state);
  }
  console.log(`${SITE} done · ${JSON.stringify(counts)} · still failed ${Object.keys(state.failed).length}`);
  await db.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
