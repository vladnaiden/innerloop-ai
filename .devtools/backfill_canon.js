#!/usr/bin/env node
/**
 * Backfill the canonical filter columns over rows scraped before canon.js existed.
 *
 * Reads the raw fields, writes the `*_en` ones, never the other way round. Safe to re-run: it only
 * touches rows whose canonical value would change, so a second pass over a clean table does nothing.
 *
 *   DATABASE_URL=… node backfill_canon.js [--batch 2000] [--dry]
 */
const { Client } = require("pg");
const { canonRow } = require("./canon.js");

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const BATCH = Number(arg("batch", 2000));
const DRY = process.argv.includes("--dry");

const same = (a, b) => (Array.isArray(a) || Array.isArray(b))
  ? JSON.stringify(a || null) === JSON.stringify(b || null)
  : (a ?? null) === (b ?? null);

(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  await db.query("SET statement_timeout = 0");
  let after = 0, seen = 0, changed = 0;
  for (;;) {
    const { rows } = await db.query(
      `SELECT seq, vertical, payment_frequency, payment_methods, rate_type,
              vertical_en, payment_frequency_en, payment_methods_en, rate_type_en
         FROM mr_program WHERE seq > $1 ORDER BY seq LIMIT $2`, [after, BATCH]);
    if (!rows.length) break;
    after = rows[rows.length - 1].seq;
    seen += rows.length;
    const updates = [];
    for (const r of rows) {
      const c = canonRow(r);
      if (same(c.vertical_en, r.vertical_en) && same(c.payment_frequency_en, r.payment_frequency_en)
        && same(c.payment_methods_en, r.payment_methods_en) && same(c.rate_type_en, r.rate_type_en)) continue;
      updates.push([r.seq, c.vertical_en, c.payment_frequency_en, c.payment_methods_en, c.rate_type_en]);
    }
    if (updates.length && !DRY) {
      // one statement per batch: a row-by-row UPDATE over 186k rows takes minutes on the free tier
      await db.query(
        `UPDATE mr_program p SET vertical_en = u.v, payment_frequency_en = u.f,
             payment_methods_en = u.m, rate_type_en = u.r
         FROM (SELECT * FROM unnest($1::bigint[], $2::text[], $3::text[], $4::text[][], $5::text[])
               AS t(seq, v, f, m, r)) u
         WHERE p.seq = u.seq`,
        [updates.map(u => u[0]), updates.map(u => u[1]), updates.map(u => u[2]),
         updates.map(u => u[3]), updates.map(u => u[4])]);
    }
    changed += updates.length;
    process.stdout.write(`\r  ${seen} rows seen, ${changed} updated…`);
  }
  console.log(`\n${DRY ? "would update" : "updated"} ${changed} of ${seen} rows`);
  await db.end();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
