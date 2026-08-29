#!/usr/bin/env node
/**
 * Pushes freshly-enriched program fields from local Postgres to the hosted one.
 *
 * Unlike migrate_to_cloud.js this NEVER drops anything — production carries
 * submissions, reviews and promos that only exist there, and a DROP would take
 * them with it. This only UPDATEs mr_program rows by seq.
 *
 *   node sync_enriched.js [--since 2026-08-24] [--all] [--prune]
 */
const fs = require("fs");
const { Client } = require("pg");

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };

const FIELDS = [
  "commission_type", "commission_types", "base_commission", "min_payment", "min_payment_raw",
  "payment_frequency", "payment_methods", "referral_commission", "tracking_software",
  "tracking_link", "cookie_length_raw", "rating_avg", "rating_count", "rating_dist",
  "offers_count", "categories", "countries", "source_updated", "established_year",
  "support_info", "landing_url", "detail_url", "enriched_at",
  // rate decomposition, in case the hosted copy predates it
  "rate_type", "pct_min", "pct_max", "flat_min", "flat_max", "recurring_months", "lifetime",
  "min_payout", "hold_days", "tier2_pct", "data_score", "needs_link", "signup_url",
  "commission_pct", "payout_flat", "cookie_days", "recurring", "country", "lang", "vertical",
  "slug", "reviews_count", "socials", "contact_email", "affiliate_managers",
  // never synced before: re-read descriptions and corrected names stayed local
  "description", "program_name", "managers", "phone", "address", "logo_url", "skype", "telegram", "contact_emails", "contacts", "parser_version", "parsed_at",
  // never synced before: hosted lacked network/currency/commission on every row inserted since migration
  "commission", "currency", "network", "payout_method", "confidence", "numbers", "tags", "geo",
  "last_checked", "score_fit", "score_profit", "score_reliable", "score_easy", "score_notes", "link_source",
  "extra", "jsonld", "source_url", "source_endpoint", "source_fetched_at", "first_seen_at", "reviews_scraped_at",
];
const JSONISH = new Set(["rating_dist", "managers", "numbers", "extra", "jsonld", "contacts"]);

(async () => {
  const target = process.env.TARGET_DATABASE_URL || fs.readFileSync(`${__dirname}/.dburl`, "utf8").trim();
  const src = new Client({ host: "host.docker.internal", port: 5432, database: "app", user: "postgres", password: "postgres" });
  const dst = new Client({ connectionString: target, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await src.connect();
  await dst.connect();

  const where = process.argv.includes("--all") ? "" : "WHERE enriched_at IS NOT NULL OR data_score > 0";
  const rows = (await src.query(
    `SELECT seq, ${FIELDS.join(",")} FROM mr_program ${where} ORDER BY seq`
  )).rows;
  console.log(`syncing ${rows.length} rows to hosted`);
  if (!rows.length) { await src.end(); await dst.end(); return; }

  // Rows removed locally (merged duplicates, scraped junk) must also leave
  // production. Without this the site keeps serving entries the registry no
  // longer believes in — including ones deleted precisely because they were wrong.
  if (process.argv.includes("--prune")) {
    const localSeqs = new Set((await src.query("SELECT seq FROM mr_program")).rows.map((r) => String(r.seq)));
    const stale = (await dst.query("SELECT seq FROM mr_program")).rows
      .map((r) => String(r.seq)).filter((q) => !localSeqs.has(q));
    if (stale.length) {
      const keep = (await dst.query(
        `SELECT DISTINCT program_seq FROM mr_review WHERE program_seq = ANY($1::bigint[])`, [stale]
      )).rows.map((r) => String(r.program_seq));
      const removable = stale.filter((q) => !keep.includes(q));
      if (removable.length) {
        await dst.query(`DELETE FROM mr_program WHERE seq = ANY($1::bigint[])`, [removable]);
      }
      console.log(`pruned ${removable.length} stale rows from hosted` +
        (keep.length ? ` (${keep.length} kept: reviews attached)` : ""));
    } else {
      console.log("nothing stale on hosted");
    }
  }

  // insert rows that do not exist on the target yet, then update the rest —
  // UPDATE alone silently leaves newly scraped programs out of production.
  const targetSeqs = new Set(
    (await dst.query("SELECT seq FROM mr_program")).rows.map((r) => String(r.seq))
  );
  const fresh = rows.filter((r) => !targetSeqs.has(String(r.seq)));
  if (fresh.length) {
    // program_name/description are now in FIELDS; listing them twice makes Postgres reject the INSERT
    const cols = ["seq", ...FIELDS.filter((f) => f !== "seq"), ...["domain", "program_name", "description"].filter((c) => !FIELDS.includes(c))];
    const extra = (await src.query(
      `SELECT seq, domain, program_name, description FROM mr_program WHERE seq = ANY($1::bigint[])`,
      [fresh.map((r) => r.seq)]
    )).rows.reduce((m, r) => (m[r.seq] = r, m), {});
    for (let i = 0; i < fresh.length; i += 200) {
      const chunk = fresh.slice(i, i + 200);
      const vals = [], params = [];
      chunk.forEach((r, k) => {
        const base = k * cols.length;
        vals.push(`(${cols.map((_, j) => `$${base + j + 1}`).join(",")})`);
        for (const c of cols) {
          let v = c in r ? r[c] : extra[r.seq]?.[c];
          if (JSONISH.has(c)) v = v == null ? null : JSON.stringify(v);
          params.push(v ?? null);
        }
      });
      await dst.query(
        `INSERT INTO mr_program(${cols.join(",")}) VALUES ${vals.join(",")} ON CONFLICT (seq) DO NOTHING`,
        params
      );
    }
    console.log(`inserted ${fresh.length} new programs`);
  }

  // One UPDATE per row meant ~15k round trips to a remote database and a 20-minute
  // sync. Batched UPDATE ... FROM (VALUES ...) does the same work in a few dozen.
  const TYPES = (await src.query(
    `SELECT column_name, data_type, udt_name FROM information_schema.columns
     WHERE table_name = 'mr_program'`)).rows
    .reduce((m, r) => (m[r.column_name] = r.data_type === "ARRAY" ? `${r.udt_name.replace(/^_/, "")}[]`
      : r.data_type === "USER-DEFINED" ? r.udt_name : r.data_type, m), {});
  const cast = (f) => `${JSONISH.has(f) ? "jsonb" : (TYPES[f] || "text")}`;
  // URL columns must follow local exactly: a NULL means "dropped a third-party affiliate link" and has to win.
  const OVERWRITE = new Set(["signup_url", "landing_url"]);
  const set = FIELDS.map((f) => OVERWRITE.has(f) ? `${f} = v.${f}` : `${f} = COALESCE(v.${f}, mr_program.${f})`).join(", ");
  const CHUNK = 250;
  let n = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const params = [];
    const tuples = chunk.map((r) => {
      const vals = [r.seq, ...FIELDS.map((f) => {
        const v = r[f];
        return v == null ? null : (JSONISH.has(f) ? JSON.stringify(v) : v);
      })];
      const ph = vals.map((v) => { params.push(v); return `$${params.length}`; });
      // EVERY chunk needs the casts on its first tuple — a VALUES list infers
      // column types from its own first row, so casting only the very first
      // chunk left later ones comparing bigint to text.
      return r === chunk[0]
        ? `(${ph[0]}::bigint, ${FIELDS.map((f, k) => `${ph[k + 1]}::${cast(f)}`).join(", ")})`
        : `(${ph.join(", ")})`;
    });
    await dst.query(
      `UPDATE mr_program SET ${set}
       FROM (VALUES ${tuples.join(",")}) AS v(seq, ${FIELDS.join(", ")})
       WHERE mr_program.seq = v.seq`, params);
    n += chunk.length;
    process.stdout.write(`  ${n}/${rows.length}\r`);
  }

  // COALESCE keeps hosted values when local is NULL — so a description cleared
  // locally as markup debris stays live forever. Clear it on hosted directly.
  const junk = await dst.query(`UPDATE mr_program SET description=NULL WHERE description ~ 'class=|<[a-z]+ |style=|</'`);
  console.log(`cleared ${junk.rowCount} markup-only descriptions on hosted`);
  // affpaying network pages publish no GEOs; anything there was regex noise (AI, FB, EZ…)
  const geo = await dst.query(`UPDATE mr_program SET countries=NULL WHERE detail_url LIKE '%affpaying.com%' AND countries IS NOT NULL AND NOT (COALESCE(extra,'{}'::jsonb) ? 'ov_id')`);
  console.log(`cleared ${geo.rowCount} fabricated GEO lists on hosted`);

  const check = (await dst.query(
    `SELECT count(*) FILTER (WHERE commission_type IS NOT NULL)::int with_type,
            count(*) FILTER (WHERE min_payment IS NOT NULL)::int with_minpay,
            count(*) FILTER (WHERE tracking_software IS NOT NULL)::int with_tracking,
            count(*)::int total FROM mr_program`
  )).rows[0];
  console.log(`\nsynced ${n} rows. hosted now:`, check);
  await src.end(); await dst.end();
  process.exit(0);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
