#!/usr/bin/env node
/**
 * Applies the local slug mapping to the hosted DB, keyed by `seq`.
 *
 * Deliberately NOT `rebrand_slugs.js --target hosted`: that would recompute the mapping against a
 * different row set (hosted carries 186,061 rows to local's 190,605) and a different "already taken"
 * set, so the two databases would mint different URLs for the same program. The slug is a public
 * identifier — it is copied, never re-derived.
 *
 *   node push_slugs.js --dry
 *   node push_slugs.js
 */
const fs = require("fs");
const { Client } = require("pg");
const DRY = process.argv.includes("--dry");

(async () => {
  const src = new Client({ host: "host.docker.internal", port: 5432, database: "app", user: "postgres", password: "postgres" });
  const dst = new Client({ connectionString: fs.readFileSync(`${__dirname}/.dburl`, "utf8").trim(), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
  await src.connect(); await dst.connect();

  const local = new Map((await src.query(`SELECT seq, slug, source_key FROM mr_program WHERE source_key IS NOT NULL`)).rows.map(r => [String(r.seq), r]));
  const hosted = (await dst.query(`SELECT seq, slug FROM mr_program`)).rows;
  console.log(`local renamed rows: ${local.size.toLocaleString()}   hosted rows: ${hosted.length.toLocaleString()}`);

  const plan = [];
  for (const h of hosted) {
    const l = local.get(String(h.seq));
    if (l && l.slug !== h.slug) plan.push({ seq: h.seq, old: h.slug, next: l.slug, key: l.source_key });
  }
  console.log(`hosted rows to rename: ${plan.length.toLocaleString()}`);
  const uniq = new Set(plan.map(p => p.next));
  console.log(`distinct targets: ${uniq.size.toLocaleString()} ${uniq.size === plan.length ? "OK" : "*** NOT UNIQUE ***"}`);
  if (uniq.size !== plan.length) throw new Error("mapping is not unique on hosted — refusing to write");
  for (const p of plan.slice(0, 5)) console.log(`   ${p.old}  ->  ${p.next}`);
  if (DRY) { await src.end(); await dst.end(); return; }

  await dst.query(`ALTER TABLE mr_program ADD COLUMN IF NOT EXISTS source_key text`);
  await dst.query(`CREATE TABLE IF NOT EXISTS mr_slug_alias (
      old_slug text PRIMARY KEY, new_slug text NOT NULL, changed_at timestamptz NOT NULL DEFAULT now())`);
  await dst.query(`CREATE INDEX IF NOT EXISTS ix_slug_alias_new ON mr_slug_alias(new_slug)`);
  await dst.query(`CREATE TABLE IF NOT EXISTS mr_slug_backup_20260902 AS SELECT seq, slug FROM mr_program WHERE false`);
  if ((await dst.query(`SELECT count(*)::int n FROM mr_slug_backup_20260902`)).rows[0].n === 0)
    await dst.query(`INSERT INTO mr_slug_backup_20260902 SELECT seq, slug FROM mr_program`);

  const CHUNK = 1000;
  await dst.query("BEGIN");
  try {
    for (const phase of ["park", "final"]) {
      for (let i = 0; i < plan.length; i += CHUNK) {
        const c = plan.slice(i, i + CHUNK);
        await dst.query(
          `UPDATE mr_program SET slug = v.s FROM (VALUES ${c.map((_, j) => `($${j * 2 + 1}::bigint,$${j * 2 + 2}::text)`).join(",")}) AS v(seq, s) WHERE mr_program.seq = v.seq`,
          c.flatMap(p => [p.seq, phase === "park" ? `~tmp-${p.seq}` : p.next]));
      }
      process.stdout.write(`\r  ${phase} pass done`);
    }
    for (let i = 0; i < plan.length; i += CHUNK) {
      const c = plan.slice(i, i + CHUNK);
      await dst.query(
        `UPDATE mr_program SET source_key = v.k FROM (VALUES ${c.map((_, j) => `($${j * 2 + 1}::bigint,$${j * 2 + 2}::text)`).join(",")}) AS v(seq, k) WHERE mr_program.seq = v.seq`,
        c.flatMap(p => [p.seq, p.key]));
      await dst.query(
        `INSERT INTO mr_slug_alias(old_slug, new_slug) VALUES ${c.map((_, j) => `($${j * 2 + 1},$${j * 2 + 2})`).join(",")}
         ON CONFLICT (old_slug) DO UPDATE SET new_slug = EXCLUDED.new_slug, changed_at = now()`,
        c.flatMap(p => [p.old, p.next]));
    }
    await dst.query(`UPDATE mr_slug_alias a SET new_slug = b.new_slug FROM mr_slug_alias b
                      WHERE a.new_slug = b.old_slug AND a.old_slug <> b.new_slug`);
    const shadow = await dst.query(`DELETE FROM mr_slug_alias a USING mr_program p WHERE p.slug = a.old_slug RETURNING a.old_slug`);
    await dst.query("COMMIT");
    console.log(`\ncommitted. aliases dropped because a live row owns that slug: ${shadow.rowCount}`);
  } catch (e) { await dst.query("ROLLBACK"); throw e; }

  await dst.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_p_source_key ON mr_program(source_key) WHERE source_key IS NOT NULL`);
  const a = (await dst.query(
    `SELECT count(*)::int total,
            count(*) FILTER (WHERE site_adapter IS NOT NULL AND slug LIKE site_adapter || '-%')::int prefixed,
            (SELECT count(*)::int FROM mr_slug_alias) aliases FROM mr_program`)).rows[0];
  console.log(`hosted after: ${a.total.toLocaleString()} rows, ${a.prefixed.toLocaleString()} still prefixed, ${a.aliases.toLocaleString()} aliases`);
  await src.end(); await dst.end();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
