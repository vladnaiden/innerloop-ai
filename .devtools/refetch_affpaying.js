#!/usr/bin/env node
/**
 * Re-reads every affpaying detail page for the fields the first pass never
 * looked for: description, the Join Now destination, social profiles, the real
 * display name, and cookie_days.
 *
 *   node refetch_affpaying.js --limit 200 --delay 2500
 *
 * Resumable via extra.full_pass. Never overwrites a value we already trust,
 * except program_name where the old value is a slug.
 */
const { Client } = require("pg");
const af = require("./af");
// same per-request metrics as the offervault crawler, so status.js sees every job
const __fs = require("fs");
const metric = (o) => { try { __fs.appendFileSync(`${__dirname}/.crawl-metrics.jsonl`, JSON.stringify({ t: new Date().toISOString(), job: "affpaying", ...o }) + "\n"); } catch {} };
const { parseAffpayingFull } = require("./affpaying_full");
const PV = require("./parser_version");
const zlib = require("zlib");
const fs = require("fs");
const RAW = `${__dirname}/raw_pages/affpaying`;

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };

(async () => {
  const limit = Number(arg("--limit", 200));
  const [shardK, shardN] = (arg("--shard", "") || "").split("/").map((x) => (x === "" ? null : Number(x)));
  const delay = Number(arg("--delay", 2500));
  const db = new Client({ host: "host.docker.internal", port: 5432, database: "app", user: "postgres", password: "postgres" });
  await db.connect();
  // ALTER TABLE takes an ACCESS EXCLUSIVE lock and queues every reader behind it if any
  // long UPDATE is running — only touch the schema when the column is really missing
  if (!(await db.query(`SELECT 1 FROM information_schema.columns WHERE table_name='mr_program' AND column_name='socials'`)).rowCount)
    await db.query(`ALTER TABLE mr_program ADD COLUMN IF NOT EXISTS socials text[]`);
  await af.init();

  const rows = (await db.query(
    `SELECT seq, slug, program_name, detail_url FROM mr_program
     WHERE detail_url LIKE '%affpaying.com%' AND NOT (extra ? 'full_pass')
       AND ($2::text IS NULL OR slug = $2)
       AND ($3::int IS NULL OR seq % $4::int = $3::int)   -- --shard k/n: disjoint workers never fetch the same page
     ORDER BY COALESCE(rating_count,0) DESC LIMIT $1`, [limit, arg("--slug", null), shardK, shardN])).rows;
  console.log(`re-reading ${rows.length} affpaying pages`);

  let ok = 0, empty = 0, renameSkipped = 0, gained = { program_name: 0, description: 0, signup_url: 0, socials: 0, cookie_days: 0, contact_email: 0, affiliate_managers: 0, categories: 0, managers: 0, phone: 0 };
  for (const r of rows) {
    let res;
    const __t0 = Date.now();
    try { res = await af.get(r.detail_url, { tries: 3, gapBase: 3000 }); }
    catch (e) { metric({ ev: "fetch", ok: false, ms: Date.now() - __t0, reason: String(e && e.message).slice(0, 40) }); await af.pace(delay); continue; }

    // keep the page: re-parsing and validation must not need another fetch
    try { fs.mkdirSync(RAW, { recursive: true }); fs.writeFileSync(`${RAW}/${r.slug || r.seq}.html.gz`, zlib.gzipSync(res.html || "")); } catch {}
    metric({ ev: "fetch", ok: true, ms: Date.now() - __t0, offers: 1 });
    const d = parseAffpayingFull(res.html || "");
    if (!Object.keys(d).length) {
      // a page that yields nothing (404 slug, empty template) must still be marked,
      // or it is re-selected and re-fetched forever — thousands of requests for no rows
      await db.query(`UPDATE mr_program SET extra = COALESCE(extra,'{}'::jsonb) || '{"full_pass":true,"empty_page":true}'::jsonb WHERE seq=$1`, [r.seq]);
      empty++; await af.pace(delay); continue;
    }

    // Two programs can share a (domain, program_name) pair once slugs become real
    // display names. A collision must not abort the run or lose the other fields,
    // so retry without the rename and keep going.
    const apply = (withName) => db.query(
      `UPDATE mr_program SET
         program_name = COALESCE($2, program_name),
         description  = CASE WHEN $3::text IS NOT NULL AND (description IS NULL OR description ~ 'class=|<[a-z]+ |style=|</') THEN $3 ELSE description END,
         landing_url  = COALESCE(landing_url, $4),
         affiliate_managers = COALESCE(affiliate_managers, $8),
         categories   = COALESCE(categories, $9),
         offers_count = CASE WHEN $10::int IS NOT NULL AND (offers_count IS NULL OR offers_count <= 1) THEN $10 ELSE offers_count END,
         pct_min = COALESCE(pct_min, $11), pct_max = COALESCE(pct_max, $12),
         logo_url = COALESCE(logo_url, $17),
         managers = COALESCE($13::jsonb, managers), contact_emails = COALESCE($20::text[], contact_emails), contacts = COALESCE($21::jsonb, contacts), rating_count = COALESCE(rating_count, $22), rating_avg = COALESCE(rating_avg, $23), rating_dist = COALESCE(rating_dist, $24::jsonb), parser_version = $25, parsed_at = now(), skype = COALESCE(skype, $18), telegram = COALESCE(telegram, $19), phone = COALESCE(phone, $14), address = COALESCE(address, $15), jsonld = COALESCE($16::jsonb, jsonld),
         signup_url   = COALESCE(signup_url, $4),
         socials      = COALESCE(socials, $5),
         cookie_days  = COALESCE(cookie_days, $6),
         contact_email = COALESCE(contact_email, $7),
         extra = COALESCE(extra,'{}'::jsonb) || '{"full_pass":true}'::jsonb
       WHERE seq = $1`,
      [r.seq, withName ? (d.program_name ?? null) : null, d.description ?? null,
       d.signup_url ?? null, d.socials ?? null, d.cookie_days ?? null,
       d.contact_email ?? null, d.affiliate_managers ?? null, d.categories ?? null, d.offers_count ?? null, d.pct_min ?? null, d.pct_max ?? null,
       d.managers ? JSON.stringify(d.managers) : null, d.phone ?? null, d.address ?? null, d.jsonld ? JSON.stringify(d.jsonld) : null, d.jsonld?.image ?? null, d.skype ?? null, d.telegram ?? null, d.contact_emails ?? null, d.contacts ? JSON.stringify(d.contacts) : null, d.rating_count ?? null, d.rating_avg ?? null, d.rating_dist ? JSON.stringify(d.rating_dist) : null, PV.AFFPAYING]);

    try { await apply(true); }
    catch (e) {
      if (e.code !== "23505") throw e;
      renameSkipped++;
      await apply(false);
    }

    for (const k of Object.keys(gained)) if (d[k] != null) gained[k]++;
    ok++;
    if (ok % 25 === 0) process.stdout.write(`  ${ok}/${rows.length}\r`);
    await af.pace(delay);
  }
  console.log(`\nre-read ${ok} pages · ${empty} empty pages marked · ${renameSkipped} kept their old name (would collide)`);
  console.table(Object.entries(gained).map(([field, n]) => ({ field, captured: n })));
  await db.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
