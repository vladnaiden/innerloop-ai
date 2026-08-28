#!/usr/bin/env node
/**
 * data_score decides what the listing shows first, so it should count the columns
 * a visitor actually sees. The old score rewarded signup_url and description —
 * useful data, but invisible in the table, so rows full of them ranked above rows
 * with real terms and the listing looked empty.
 */
const { Client } = require("pg");

// weights reflect how much each field helps someone choosing a program
const FIELDS = [
  ["rate",              12],   // pct_max or flat_max
  ["cookie_days",        9],
  ["commission_type",    8],
  ["payment_methods",    8],
  ["min_payment",        7],
  ["countries",          7],
  ["vertical",           6],
  ["network",            6],
  ["categories",         6],
  ["tracking_software",  5],
  ["rating_avg",         5],
  ["payment_frequency",  5],
  ["offers_count",       4],
  ["referral_commission",4],
  ["established_year",   4],
  ["signup_url",         4],
];

(async () => {
  const c = new Client({ host: "host.docker.internal", port: 5432, database: "app", user: "postgres", password: "postgres" });
  await c.connect();
  const total = FIELDS.reduce((a, [, w]) => a + w, 0);
  const parts = FIELDS.map(([f, w]) =>
    f === "rate"
      ? `(CASE WHEN pct_max IS NOT NULL OR flat_max IS NOT NULL THEN ${w} ELSE 0 END)`
      : `(CASE WHEN ${f} IS NOT NULL${["payment_methods","countries","categories"].includes(f) ? ` AND array_length(${f},1) > 0` : ""} THEN ${w} ELSE 0 END)`
  ).join(" + ");

  // rewrite only rows whose score actually changes: a full-table UPDATE every publish cycle
  // left 3M dead tuples behind a blocked autovacuum and made every scan crawl
  const expr = `ROUND(((${parts})::numeric / ${total}) * 100)`;
  const u = await c.query(`UPDATE mr_program SET data_score = ${expr} WHERE data_score IS DISTINCT FROM ${expr}`);
  console.log(`rescored ${u.rowCount} changed rows`);
  const d = (await c.query(
    `SELECT width_bucket(data_score,0,100,5)*20 upto, count(*)::int n FROM mr_program GROUP BY 1 ORDER BY 1`)).rows;
  console.log("completeness now reflects the visible columns:");
  console.table(d);
  const top = (await c.query(
    `SELECT program_name, data_score FROM mr_program ORDER BY data_score DESC, seq LIMIT 6`)).rows;
  top.forEach((r) => console.log(`   ${String(r.program_name).slice(0, 34).padEnd(34)} ${r.data_score}`));
  await c.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
