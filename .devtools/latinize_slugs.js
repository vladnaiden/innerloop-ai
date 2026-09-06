#!/usr/bin/env node
/**
 * Makes every program URL Latin.
 *
 * Why: `slugify` preserved Cyrillic and CJK, so 15,380 of 196,915 program slugs were non-Latin.
 * A non-ASCII slug in a `Location` header throws ERR_INVALID_CHAR — that is what 500'd 14,956
 * retired URLs from 02.09 to 06.09.2026 and cut Googlebot from 35,458 requests/day to 1,270.
 * The owner's rule (06.09.2026): every endpoint is Latin, named after the brand.
 *
 * The new slug comes from `latin_slug.js#brandSlug`, the same module crawl_sites.js mints with,
 * so a re-crawl cannot reintroduce what this pass removes. Every rename is recorded in
 * `mr_slug_alias`, which the program page reads to answer the retired URL with a 301.
 *
 *   node latinize_slugs.js --dry                  # report only, no writes
 *   node latinize_slugs.js                        # local Postgres
 *   node latinize_slugs.js --target hosted --dry  # the hosted DB (.dburl)
 */
const fs = require("fs");
const { Client } = require("pg");
const { brandSlug } = require("./latin_slug.js");

const DRY = process.argv.includes("--dry");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const TARGET = arg("--target", "local");
const NON_LATIN = `slug ~ '[^ -~]'`;
/** A slug that leads with a module name whose synthesised domain head is that same module: the
 *  first pass minted 1,665 of these because `site_adapter` was NULL. Narrow on purpose — a brand
 *  whose name genuinely IS a module (TradeTracker.com) has a real domain and is never matched. */
const MODULE_LED = (mods) => mods.length
  ? `(${mods.map((m) => `(slug LIKE '${m.replace(/_/g, "\\_")}-%' AND domain LIKE '${m.replace(/_/g, "\\_")}.%')`).join(" OR ")})`
  : "false";

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

  const MODULES = [...new Set([
    ...fs.readdirSync(`${__dirname}/sites`).filter((f) => f.endsWith(".js") && !f.startsWith("_")).map((f) => f.replace(/\.js$/, "")),
    ...(await db.query(`SELECT DISTINCT site_adapter FROM mr_program WHERE site_adapter IS NOT NULL`)).rows.map((r) => r.site_adapter),
  ])].filter((m) => /^[a-z0-9_]+$/.test(m));
  const modules = new Set(MODULES);
  const SELECT = `${NON_LATIN} OR ${MODULE_LED(MODULES)}`;

  const rows = (await db.query(
    `SELECT seq, slug, program_name, domain, site_adapter
       FROM mr_program WHERE ${SELECT} ORDER BY seq`)).rows;
  // Every slug that is NOT being renamed is already taken and outranks a newcomer.
  const taken = new Set((await db.query(
    `SELECT slug FROM mr_program WHERE slug IS NOT NULL AND NOT (${SELECT})`)).rows.map((r) => r.slug));
  console.log(`candidates (non-Latin or module-led): ${rows.length.toLocaleString()}   slugs kept as-is: ${taken.size.toLocaleString()}`);

  const plan = [], src = { name: 0, domain: 0, seq: 0 };
  let collided = 0;
  for (const r of rows) {
    const { slug: base, from } = brandSlug(r, modules);
    src[from]++;
    let s = base;
    if (taken.has(s)) { s = `${base}-${r.seq}`; collided++; }   // stable: seq never changes
    taken.add(s);
    // A brand whose name genuinely IS a module (gdeslon.ru, saleads.pro) re-mints to the slug it
    // already has. Renaming it would write a self-referencing alias and move nothing.
    if (s !== r.slug) plan.push({ seq: r.seq, old: r.slug, next: s });
  }

  const uniq = new Set(plan.map((p) => p.next));
  const bad = plan.filter((p) => /[^ -~]/.test(p.next));
  console.log(`\nbuilt from: program_name ${src.name.toLocaleString()} · domain tail ${src.domain.toLocaleString()} · seq fallback ${src.seq.toLocaleString()}`);
  console.log(`collisions needing a -<seq> suffix: ${collided.toLocaleString()} (${(collided / plan.length * 100).toFixed(1)}%)`);
  console.log(`distinct new slugs: ${uniq.size.toLocaleString()} of ${plan.length.toLocaleString()} ${uniq.size === plan.length ? "OK" : "*** NOT UNIQUE ***"}`);
  console.log(`still non-Latin after rename: ${bad.length} ${bad.length ? "*** BUG ***" : "OK"}`);
  console.log(`actual renames (excluding no-ops): ${plan.length.toLocaleString()}`);
  console.log("\nsample:");
  for (const p of plan.slice(0, 10)) console.log(`   ${p.old}\n     -> ${p.next}`);

  if (DRY) {
    fs.writeFileSync(`${__dirname}/.latinize-plan.json`, JSON.stringify(plan));
    console.log(`\nplan written to .latinize-plan.json (${plan.length.toLocaleString()} renames) — no writes made`);
    await db.end();
    return;
  }
  if (uniq.size !== plan.length || bad.length) { console.error("refusing to write: plan is not unique or not Latin"); process.exit(1); }

  // Back up what is about to change, so the rename is reversible without touching a dump.
  const backup = `${__dirname}/backups/latinize_${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
  fs.mkdirSync(`${__dirname}/backups`, { recursive: true });
  fs.writeFileSync(backup, plan.map((p) => JSON.stringify(p)).join("\n"));
  console.log(`\nbackup: ${backup}`);

  await db.query(`CREATE TABLE IF NOT EXISTS mr_slug_alias (
      old_slug text PRIMARY KEY, new_slug text NOT NULL, changed_at timestamptz NOT NULL DEFAULT now())`);
  await db.query(`CREATE INDEX IF NOT EXISTS ix_slug_alias_new ON mr_slug_alias(new_slug)`);

  // Two phases in one transaction: a bulk rename can trip the unique index on an intermediate
  // row even when the final state is unique, so every row parks on '~tmp-<seq>' first
  // ('~' never survives slugify, so it can collide with nothing real).
  const CHUNK = 2000;
  const values = (c) => c.map((_, j) => `($${j * 2 + 1}::bigint,$${j * 2 + 2}::text)`).join(",");
  await db.query("BEGIN");
  try {
    for (const park of [true, false]) {
      for (let i = 0; i < plan.length; i += CHUNK) {
        const c = plan.slice(i, i + CHUNK);
        await db.query(
          `UPDATE mr_program SET slug = v.s FROM (VALUES ${values(c)}) AS v(seq, s) WHERE mr_program.seq = v.seq`,
          c.flatMap((p) => [p.seq, park ? `~tmp-${p.seq}` : p.next]));
      }
    }
    // The 301. An old_slug already present keeps pointing at the newest target, and any alias that
    // pointed AT a slug we just moved is re-pointed, so a two-hop chain never forms.
    for (let i = 0; i < plan.length; i += CHUNK) {
      const c = plan.slice(i, i + CHUNK);
      await db.query(
        `INSERT INTO mr_slug_alias (old_slug, new_slug) VALUES ${values(c).replace(/::bigint/g, "::text")}
           ON CONFLICT (old_slug) DO UPDATE SET new_slug = EXCLUDED.new_slug, changed_at = now()`,
        c.flatMap((p) => [p.old, p.next]));
      await db.query(
        `UPDATE mr_slug_alias a SET new_slug = v.s, changed_at = now()
           FROM (VALUES ${values(c).replace(/::bigint/g, "::text")}) AS v(old, s)
          WHERE a.new_slug = v.old`,
        c.flatMap((p) => [p.old, p.next]));
    }
    await db.query(`DELETE FROM mr_slug_alias WHERE old_slug = new_slug`);   // a no-op hop
    await db.query("COMMIT");
  } catch (e) { await db.query("ROLLBACK"); console.error("rolled back:", e.message); process.exit(1); }

  // Count NON_LATIN, not SELECT: SELECT also matches the module-led brands that legitimately
  // re-mint to the slug they already have (gdeslon.ru), and counting those read as a failure.
  const left = (await db.query(`SELECT count(*)::int n FROM mr_program WHERE ${NON_LATIN}`)).rows[0].n;
  const led = (await db.query(`SELECT count(*)::int n FROM mr_program WHERE ${SELECT}`)).rows[0].n - left;
  console.log(`\ncommitted. non-Latin slugs remaining: ${left} ${left ? "*** CHECK ***" : "OK"}` +
              (led ? `  (${led} module-named brands keep their own slug by design)` : ""));
  await db.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
