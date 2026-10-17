#!/usr/bin/env node
/**
 * Reads each brand's OWN affiliate page — the authoritative source for its
 * terms, unlike a directory listing that may be years stale.
 *
 * Tries the conventional paths in order and stops at the first page that
 * actually looks like an affiliate page, so a miss costs a few HEAD-ish GETs
 * rather than the whole list.
 *
 *   node brand_affiliate.js --limit 120 --delay 3000
 *   node brand_affiliate.js --slugs pages.txt --limit 300    # these rows, in this order
 *
 * Resumable: records the attempt in extra.brand_probe so a re-run skips it.
 */
const { Client } = require("pg");
const af = require("./af");
const dns = require("dns").promises;

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };

// ordered by observed hit rate; /partner-program produced zero hits and is dropped
const PATHS = ["/affiliate-program", "/affiliates", "/partners", "/affiliate"];

// a page that merely mentions the word is not an affiliate page
const LOOKS_AFFILIATE = /(commission|revenue share|revshare|per sale|payout|cookie|referral fee|affiliate program)/i;

// Marketing copy is full of percentages that are not commissions: "up to 80% off",
// "save 30%", "99.9% uptime". A number only counts as a rate when commission
// wording sits next to it and discount wording does not.
const { parseTerms } = require("./rate_terms");
const { DIRECTORY_HOSTS } = require("./url_clean");

(async () => {
  const limit = Number(arg("--limit", 120));
  const delay = Number(arg("--delay", 3000));
  const vertical = arg("--vertical", null);   // e.g. --vertical crypto: restrict the pass to one vertical (or its tags)
  /* --slugs <file>: probe THESE rows, in the file's order, instead of the thinnest in the whole
     table. Added 16.10.2026 because "thinnest first" is the right default and the wrong answer
     when the question is "enrich the pages that earn Google impressions": 6,755 of 201,459 rows
     carry all the search traffic, and a limit-bounded thinnest-first pass reaches almost none of
     them. The file is one slug per line, ordered by impressions, so the crawl spends itself where
     the readers are. Everything else about the pass is unchanged — same filters, same pacing. */
  const slugFile = arg("--slugs", null);
  const wanted = slugFile
    ? require("fs").readFileSync(slugFile, "utf8").split("\n").map(x => x.trim()).filter(Boolean)
    : null;
  const db = new Client({ host: "host.docker.internal", port: 5432, database: "app", user: "postgres", password: "postgres" });
  await db.connect();
  await af.init();

  // brands worth the visit: a real domain, and something still missing
  // Thinnest rows FIRST: the point is filling gaps, so the emptiest listings are
  // the ones worth a visit. Ordering by score DESC spends the crawl on rows that
  // already look complete and leaves the blank ones blank.
  // The domain column is a slug for whole sources (affpaying, affplus,
  // affiliate_watch store "recredit-ua-2", not a hostname), so the host has to
  // come from signup_url. Only .offers pseudo-domains are excluded outright.
  const rows = (await db.query(
    `SELECT seq, program_name, domain, signup_url FROM mr_program
     WHERE signup_url ~ '^https?://[a-z0-9.-]+\\.[a-z]{2,}'
       AND NOT (extra ? 'brand_probe')
       AND (cookie_days IS NULL OR (pct_max IS NULL AND flat_max IS NULL))
       -- offervault/affplus rows are individual OFFERS inside a CPA network. Their
       -- "brand" host is the network, which publishes no per-offer terms and often
       -- refuses connections outright: 1,900 probes there returned zero hits.
       -- Brands with their own affiliate page hit ~25%.
       AND COALESCE(site_adapter,'') NOT IN ('offervault','affplus')
       ${vertical ? `AND (vertical = '${vertical.replace(/'/g, "")}' OR tags && ARRAY['${vertical.replace(/'/g, "")}'])` : ""}
     ${wanted ? "AND slug = ANY($2::text[])" : ""}
     ${wanted ? "ORDER BY array_position($2::text[], slug)" : "ORDER BY COALESCE(data_score,0) ASC, seq"}
     LIMIT $1`, wanted ? [limit, wanted] : [limit])).rows;
  console.log(`probing ${rows.length} brand affiliate pages`);

  let hits = 0, fields = 0, dead = 0, network = 0, unreachable = 0, directory = 0;
  for (const r of rows) {
    let host;
    try { host = new URL(r.signup_url).hostname.replace(/^www\./, ""); } catch { continue; }
    if (/\.offers$/.test(host)) continue;
    /* The row's signup_url sometimes points at the DIRECTORY that listed it, not at the brand.
       Probing /partners there reads the directory's own affiliate programme and attributes its
       numbers to this row: on 16.10.2026 uaff.media/partners gave "50%" to ODDX PARTNERS. The
       network check below only catches it once a second row has recorded the same URL, so the
       first victim is always mis-attributed. Refuse the host outright instead. */
    if (DIRECTORY_HOSTS.test(host)) {
      await db.query(`UPDATE mr_program SET extra = COALESCE(extra,'{}'::jsonb) || $2::jsonb WHERE seq=$1`,
        [r.seq, JSON.stringify({ brand_probe: "directory-host" })]);
      directory++; continue;
    }
    // A dead domain is the common case in this list. One local DNS lookup skips
    // it for free instead of spending five proxied requests discovering it.
    try { await dns.resolve(host); }
    catch {
      await db.query(`UPDATE mr_program SET extra = COALESCE(extra,'{}'::jsonb) || $2::jsonb WHERE seq=$1`,
        [r.seq, JSON.stringify({ brand_probe: "nxdomain" })]);
      dead++; continue;
    }
    // Probe the candidate paths CONCURRENTLY. Sequentially, a miss cost one round
    // trip per path and misses are the common case; anonfetch's own concurrency
    // limit still applies, so this trades latency for no extra request volume.
    // SEQUENTIAL with early exit, deliberately. Firing all four paths at once was
    // ~3x faster but bursty, and a burst is what gets the proxy account throttled —
    // after which every exit fails identically and the crawl yields nothing at all.
    // Paths are ordered by observed hit rate, so most hits come on the first try.
    let reached = false, found = null, foundUrl = null;
    for (const pth of PATHS) {
      const url = `https://${host}${pth}`;
      let res;
      try { res = await af.get(url, { tries: 2, gapBase: 1200 }); }
      catch { await af.sleep(400); continue; }
      reached = true;
      const text = af.strip(res.html || "");
      if (text.length >= 400 && LOOKS_AFFILIATE.test(text)) {
        const d = parseTerms(text);
        if (Object.keys(d).length) { found = d; foundUrl = url; break; }
      }
      await af.sleep(400);
    }

    if (!found) {
      // Never reached the host => the probe did not happen. Marking it "none" would
      // retire the row forever on the strength of a network error.
      if (!reached) { unreachable++; await af.pace(delay); continue; }
      await db.query(
        `UPDATE mr_program SET extra = COALESCE(extra,'{}'::jsonb) || $2::jsonb WHERE seq=$1`,
        [r.seq, JSON.stringify({ brand_probe: "none" })]);
      await af.pace(delay); continue;
    }

    // If another program already recorded this same affiliate URL, the page belongs
    // to a NETWORK, not to this offer: maxbounty.com/affiliate is one page behind 88
    // different offers. Keep the evidence, but never attribute its numbers to a row.
    const alsoUsing = Number((await db.query(
      `SELECT count(*)::int n FROM mr_program
       WHERE extra->>'brand_affiliate_url' = $1 AND seq <> $2`, [foundUrl, r.seq])).rows[0].n);
    if (alsoUsing > 0) {
      await db.query(
        `UPDATE mr_program SET extra = COALESCE(extra,'{}'::jsonb) || $2::jsonb WHERE seq=$1`,
        [r.seq, JSON.stringify({ brand_probe: "network", brand_affiliate_url: foundUrl, brand_terms: found })]);
      network++;
      await af.pace(delay);
      continue;
    }

    const sets = [], params = [r.seq];
    for (const [k, v] of Object.entries(found)) {
      params.push(v);
      sets.push(`${k} = COALESCE(${k}, $${params.length})`);   // never overwrite what we already trust
    }
    // Record what the brand itself published, always — even where a directory
    // already gave us a value. COALESCE below only fills gaps, so without this
    // the authoritative figure would be silently dropped whenever a (possibly
    // stale) directory value already occupied the column. Disagreements are the
    // raw material for rate-change detection.
    params.push(JSON.stringify({ brand_probe: "hit", brand_affiliate_url: foundUrl, brand_terms: found }));
    sets.push(`extra = COALESCE(extra,'{}'::jsonb) || $${params.length}::jsonb`);
    params.push(foundUrl);
    sets.push(`signup_url = COALESCE(signup_url, $${params.length})`);
    await db.query(`UPDATE mr_program SET ${sets.join(", ")} WHERE seq=$1`, params);

    hits++; fields += Object.keys(found).length;
    console.log(`  + ${r.program_name.slice(0, 24).padEnd(24)} ${Object.entries(found).map(([k, v]) => `${k}=${v}`).join(" ")}`);
    await af.pace(delay);
  }
  console.log(`\n${hits}/${rows.length} brands published usable terms · ${fields} fields · ${dead} dead domains · ${network} network pages · ${directory} directory hosts refused · ${unreachable} unreachable (left for retry)`);
  await db.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
