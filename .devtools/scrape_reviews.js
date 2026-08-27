#!/usr/bin/env node
/**
 * Walks every review page for each affpaying program and stores the reviews.
 *
 * Verified against a real browser first: affpaying renders reviews server-side,
 * so raw HTTP sees exactly what Chromium does (in fact more — the browser
 * collapses the description behind a "[more]" toggle). No browser needed here.
 *
 *   node scrape_reviews.js --limit 50 --delay 2500
 *
 * Resumable: skips programs whose reviews_scraped_at is set.
 */
const { Client } = require("pg");
const af = require("./af");
// same per-request metrics as the offervault crawler, so status.js sees every job
const __fs = require("fs");
const metric = (o) => { try { __fs.appendFileSync(`${__dirname}/.crawl-metrics.jsonl`, JSON.stringify({ t: new Date().toISOString(), job: "reviews", ...o }) + "\n"); } catch {} };
const { parseReviews } = require("./review_parse");

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const PER_PAGE = 15;

(async () => {
  const limit = Number(arg("--limit", 40));
  const delay = Number(arg("--delay", 2500));
  const maxPages = Number(arg("--max-pages", 40));
  const [shardK, shardN] = (arg("--shard", "") || "").split("/").map((x) => (x === "" ? null : Number(x)));

  const db = new Client({ host: "host.docker.internal", port: 5432, database: "app", user: "postgres", password: "postgres" });
  await db.connect();
  await af.init();

  // busiest first: those pages carry the most information per fetch
  const rows = (await db.query(
    `SELECT seq, program_name, detail_url, rating_count FROM mr_program
     WHERE detail_url LIKE '%affpaying.com%' AND reviews_scraped_at IS NULL
       AND COALESCE(rating_count,0) > 0
     ORDER BY rating_count DESC NULLS LAST LIMIT $1`, [limit])).rows;
  console.log(`scraping reviews for ${rows.length} programs`);

  let totalReviews = 0, done = 0, failed = 0;
  for (const r of rows) {
    const pages = Math.min(Math.ceil((r.rating_count || PER_PAGE) / PER_PAGE), maxPages);
    let got = 0, pageFailures = 0, firstPageOk = false;

    for (let p = 1; p <= pages; p++) {
      const url = p === 1 ? r.detail_url : `${r.detail_url}?page=${p}`;
      let res;
      const __t0 = Date.now();
    try { res = await af.get(url, { tries: 3, gapBase: 3000 }); }
      catch (e) { metric({ ev: "fetch", ok: false, ms: Date.now() - __t0, reason: String(e && e.message).slice(0, 40) }); pageFailures++; if (pageFailures >= 3) break; await af.pace(delay); continue; }

      metric({ ev: "fetch", ok: true, ms: Date.now() - __t0, offers: 1 });
      if (p === 1) firstPageOk = true;
      const reviews = parseReviews(res.html || "");
      if (!reviews.length) break;                     // past the last page

      for (const rv of reviews) {
        await db.query(
          `INSERT INTO mr_scraped_review
             (program_seq, source, author, review_date, body, rating,
              score_offers, score_payout, score_tracking, score_support, page)
           VALUES ($1,'affpaying',$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT DO NOTHING`,
          [r.seq, rv.author, rv.review_date, rv.body, rv.rating,
           rv.score_offers, rv.score_payout, rv.score_tracking, rv.score_support, p]);
        got++;
      }
      await af.pace(delay);
    }

    // only mark done if we actually retrieved something, so a bad window retries later
    if (got > 0) {
      await db.query(
        `UPDATE mr_program SET reviews_scraped_at = now(), reviews_count = $2 WHERE seq = $1`,
        [r.seq, got]);
      done++; totalReviews += got;
      console.log(`  ${String(r.program_name).slice(0, 24).padEnd(24)} ${got} reviews (${pages} pages)`);
    } else if (firstPageOk) {
      // page fetched and parsed cleanly, it simply has no written reviews
      // (star-only ratings): record that, or it is retried every cycle forever
      await db.query(`UPDATE mr_program SET reviews_scraped_at = now(), reviews_count = 0 WHERE seq = $1`, [r.seq]);
      done++;
      console.log(`  ${String(r.program_name).slice(0, 24).padEnd(24)} 0 written reviews — marked done`);
    } else {
      failed++;
      console.log(`  ${String(r.program_name).slice(0, 24).padEnd(24)} no reviews retrieved — left for retry`);
    }
  }
  console.log(`\n${done} programs done, ${failed} left for retry, ${totalReviews} reviews stored`);
  await db.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
