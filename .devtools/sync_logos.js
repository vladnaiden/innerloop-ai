#!/usr/bin/env node
/** Mirrors mr_logo (one row per logo URL) to the hosted database. */
const fs = require("fs"); const { Client } = require("pg");
(async () => {
  // statement timeouts: a hung run held a transaction open for 12 h and starved autovacuum
  const src = new Client({ host: "host.docker.internal", port: 5432, database: "app", user: "postgres", password: "postgres", statement_timeout: 120000 });
  const dst = new Client({ connectionString: fs.readFileSync(`${__dirname}/.dburl`, "utf8").trim(), ssl: { rejectUnauthorized: false }, statement_timeout: 120000 });
  await src.connect(); await dst.connect();
  await dst.query(`CREATE TABLE IF NOT EXISTS mr_logo (url text PRIMARY KEY, mime text, b64 text, bytes int, fetched_at timestamptz DEFAULT now(), ok boolean)`);
  const have = new Set((await dst.query(`SELECT url FROM mr_logo`)).rows.map((r) => r.url));
  // urls first (cheap), bytes one row at a time — never pull every base64 blob into memory
  const rows = (await src.query(`SELECT url FROM mr_logo WHERE ok`)).rows.filter((r) => !have.has(r.url)).slice(0, 2000);
  for (const u of rows) {
    const r = (await src.query(`SELECT url, mime, b64, bytes FROM mr_logo WHERE url = $1`, [u.url])).rows[0]; if (!r) continue;
    await dst.query(`INSERT INTO mr_logo(url,mime,b64,bytes,ok) VALUES ($1,$2,$3,$4,true) ON CONFLICT (url) DO NOTHING`, [r.url, r.mime, r.b64, r.bytes]);
  }
  console.log(`logos synced: ${rows.length} new, hosted holds ${(await dst.query(`SELECT count(*)::int n FROM mr_logo WHERE ok`)).rows[0].n}`);
  await src.end(); await dst.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
