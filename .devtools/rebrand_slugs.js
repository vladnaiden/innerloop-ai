#!/usr/bin/env node
/**
 * Replaces every source-prefixed program slug with a brand slug.
 *
 * Why: 125,161 of 166,605 program URLs carried the crawler module name
 * (`/affiliate-program/affbank-onecrypt-p28-7121792`). Measured in Search Console
 * 24.08-02.09.2026: those pages produced **0 impressions** against 7,092 from the
 * 41,444 clean-slug pages, and a 9-URL inspection sample found 0 indexed, 7 of them
 * "URL is unknown to Google". The module name is an implementation detail that was
 * never meant to be public, and Google will not spend crawl budget on it.
 *
 * The new slug uses the SAME rules mk_slugs.js already used for the clean rows, so
 * there is one convention on the site and not two:
 *     slugify(program_name) -> slugify(domain) -> program-<seq>,
 *     collision keeps the incumbent and suffixes the newcomer with its seq (stable).
 *
 * Every rename is recorded in `mr_slug_alias`, which the program page reads to answer
 * a retired URL with a 301 instead of a 404 (BR-SEO-18's rule, applied to programs).
 *
 *   node rebrand_slugs.js --dry                 # report only, no writes
 *   node rebrand_slugs.js                       # local Postgres
 *   node rebrand_slugs.js --target hosted       # the hosted DB (.dburl)
 */
const fs = require("fs");
const { Client } = require("pg");

const DRY = process.argv.includes("--dry");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const TARGET = arg("--target", "local");

/** Identical to mk_slugs.js — the convention that produced today's working URLs. */
const slugify = (s) =>
  String(s || "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9Ѐ-ӿ一-鿿]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/, "");

/**
 * When a source published no real domain the crawler synthesised one as `<adapter>.<source slug>`
 * (`affisearch.twinkle-star-knights-x`, `cpainform-offer.funservices-oi-com-br`). The head is the
 * module name and must never reach a URL; the tail is the source's own readable identifier and is
 * the best brand we have for a name slugify cannot render — every Japanese title, for instance,
 * since katakana survives neither NFKD nor the `a-z0-9` fold.
 */
const usableDomain = (domain, adapter) => {
  if (!domain) return null;
  const na = adapter.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const i = domain.indexOf(".");
  if (i > 0) {
    const head = domain.slice(0, i).replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (head === na || na.startsWith(head) || head.startsWith(na)) domain = domain.slice(i + 1);
  }
  // a bare id ("7151188") names nothing; so does anything still carrying the module name
  if (/^[0-9-]+$/.test(domain)) return null;
  const na2 = domain.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (na2.startsWith(na)) return null;
  return domain;
};

(async () => {
  let db;
  if (TARGET === "local") {
    db = new Client({ host: "host.docker.internal", port: 5432, database: "app", user: "postgres", password: "postgres" });
  } else {
    const dsn = process.env.TARGET_DATABASE_URL || fs.readFileSync(`${__dirname}/.dburl`, "utf8").trim();
    db = new Client({ connectionString: dsn, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  }
  await db.connect();
  console.log(`target: ${TARGET}${DRY ? "  (dry run)" : ""}`);

  /*
   * Match on the list of module names, NOT on the row's own `site_adapter`.
   * `WHERE slug LIKE site_adapter || '-%'` looks equivalent and is not: when an authoritative module
   * takes ownership of a row (bap_detail over bap_list) the adapter changes and the minted slug does
   * not, so 946 rows — 930 of them bap_list — kept a module name that no longer matched their own
   * adapter column and were skipped on the first pass.
   */
  // The module files, UNION the adapter names present in the table: `bap_list` minted 930 slugs and
  // its module file has since been deleted, so a filename-only list would leave those URLs standing.
  const MODULES = [...new Set([
    ...fs.readdirSync(`${__dirname}/sites`).filter((f) => f.endsWith(".js") && !f.startsWith("_")).map((f) => f.replace(/\.js$/, "")),
    ...(await db.query(`SELECT DISTINCT site_adapter FROM mr_program WHERE site_adapter IS NOT NULL`)).rows.map((r) => r.site_adapter),
  ])].filter((m) => /^[a-z0-9_]+$/.test(m));
  // `_` is a single-character wildcard in LIKE; escape it so `leads_su-%` cannot match `leadsXsu-`.
  const like = MODULES.map((m) => `slug LIKE '${m.replace(/_/g, "\\_")}-%'`).join(" OR ");

  const prefixed = (await db.query(
    `SELECT seq, slug, program_name, domain, site_adapter
       FROM mr_program
      WHERE source_key IS NULL AND (${like})
      ORDER BY seq`)).rows;
  const kept = (await db.query(
    `SELECT slug FROM mr_program
      WHERE slug IS NOT NULL AND NOT (source_key IS NULL AND (${like}))`)).rows;

  const taken = new Set(kept.map((r) => r.slug));
  console.log(`prefixed rows: ${prefixed.length.toLocaleString()}   slugs kept as-is: ${taken.size.toLocaleString()}`);

  const plan = [];
  const src = { name: 0, domain: 0, seq: 0 }, collided = [];
  for (const r of prefixed) {
    let base = slugify(r.program_name), from = "name";
    if (base.length < 2) { base = slugify(usableDomain(r.domain, r.site_adapter)); from = "domain"; }
    if (base.length < 2) { base = `program-${r.seq}`; from = "seq"; }
    src[from]++;
    let s = base;
    if (taken.has(s)) { s = `${base}-${r.seq}`; collided.push(base); }   // stable: seq never changes
    taken.add(s);
    plan.push({ seq: r.seq, old: r.slug, next: s });
  }

  const uniq = new Set(plan.map((p) => p.next));
  console.log(`\nnew slug built from: program_name ${src.name.toLocaleString()} · domain ${src.domain.toLocaleString()} · seq fallback ${src.seq.toLocaleString()}`);
  console.log(`collisions needing a -<seq> suffix: ${collided.length.toLocaleString()} (${(collided.length / plan.length * 100).toFixed(1)}%)`);
  console.log(`distinct new slugs: ${uniq.size.toLocaleString()} of ${plan.length.toLocaleString()} ${uniq.size === plan.length ? "OK" : "*** NOT UNIQUE ***"}`);
  console.log(`still naming a module after rename: ${plan.filter((p) => MODULES.some((m) => p.next.startsWith(`${m}-`))).length} (a brand whose name IS the module, e.g. TradeTracker.com)`);
  console.log("\nsample:");
  for (const p of plan.slice(0, 8)) console.log(`   ${p.old}\n     -> ${p.next}`);

  if (DRY) { await db.end(); return; }

  await db.query(`CREATE TABLE IF NOT EXISTS mr_slug_alias (
      old_slug text PRIMARY KEY,
      new_slug text NOT NULL,
      changed_at timestamptz NOT NULL DEFAULT now())`);
  await db.query(`CREATE INDEX IF NOT EXISTS ix_slug_alias_new ON mr_slug_alias(new_slug)`);

  // Two phases inside one transaction. A single-statement bulk rename can trip the unique
  // index on an intermediate row even when the final state is unique, so every row first
  // parks on a slug no real slug can equal ('~' never survives slugify).
  const CHUNK = 2000;
  await db.query("BEGIN");
  try {
    for (let i = 0; i < plan.length; i += CHUNK) {
      const c = plan.slice(i, i + CHUNK);
      await db.query(
        `UPDATE mr_program SET slug = v.s FROM (VALUES ${c.map((_, j) => `($${j * 2 + 1}::bigint,$${j * 2 + 2}::text)`).join(",")}) AS v(seq, s) WHERE mr_program.seq = v.seq`,
        c.flatMap((p) => [p.seq, `~tmp-${p.seq}`]));
    }
    for (let i = 0; i < plan.length; i += CHUNK) {
      const c = plan.slice(i, i + CHUNK);
      await db.query(
        `UPDATE mr_program SET slug = v.s FROM (VALUES ${c.map((_, j) => `($${j * 2 + 1}::bigint,$${j * 2 + 2}::text)`).join(",")}) AS v(seq, s) WHERE mr_program.seq = v.seq`,
        c.flatMap((p) => [p.seq, p.next]));
      await db.query(
        `UPDATE mr_program SET source_key = COALESCE(source_key, v.k) FROM (VALUES ${c.map((_, j) => `($${j * 2 + 1}::bigint,$${j * 2 + 2}::text)`).join(",")}) AS v(seq, k) WHERE mr_program.seq = v.seq`,
        c.flatMap((p) => [p.seq, p.old]));
      await db.query(
        `INSERT INTO mr_slug_alias(old_slug, new_slug) VALUES ${c.map((_, j) => `($${j * 2 + 1},$${j * 2 + 2})`).join(",")}
         ON CONFLICT (old_slug) DO UPDATE SET new_slug = EXCLUDED.new_slug, changed_at = now()`,
        c.flatMap((p) => [p.old, p.next]));
      process.stdout.write(`\r  renamed ${Math.min(i + CHUNK, plan.length).toLocaleString()}/${plan.length.toLocaleString()}`);
    }
    // An alias whose target was itself renamed later must not dead-end: collapse the chain.
    await db.query(`UPDATE mr_slug_alias a SET new_slug = b.new_slug FROM mr_slug_alias b
                     WHERE a.new_slug = b.old_slug AND a.old_slug <> b.new_slug`);
    // An alias that now shadows a live slug would 301 a working page onto another one.
    const shadow = await db.query(`DELETE FROM mr_slug_alias a USING mr_program p WHERE p.slug = a.old_slug RETURNING a.old_slug`);
    await db.query("COMMIT");
    console.log(`\ncommitted. aliases dropped because a live row still owns that slug: ${shadow.rowCount}`);
  } catch (e) { await db.query("ROLLBACK"); throw e; }

  const after = (await db.query(
    `SELECT count(*) FILTER (WHERE site_adapter IS NOT NULL AND slug LIKE site_adapter || '-%')::int prefixed,
            count(*)::int total FROM mr_program`)).rows[0];
  const al = (await db.query(`SELECT count(*)::int n FROM mr_slug_alias`)).rows[0];
  console.log(`after: ${after.total.toLocaleString()} rows, ${after.prefixed.toLocaleString()} still prefixed, ${al.n.toLocaleString()} aliases`);
  await db.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
