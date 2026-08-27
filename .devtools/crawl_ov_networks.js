#!/usr/bin/env node
/**
 * Crawls offervault one NETWORK at a time instead of walking global pages.
 *
 * The search API randomises results (each offer carries a randomScore), so page
 * N returns a different 20 offers on every call. Walking 1,648 global pages
 * therefore converges on overlap and can never enumerate all 32,955 offers —
 * retrying 145 pages yielded 192 new offers, which is what exposed this.
 *
 * The API's own aggregates list 89 networks whose counts sum EXACTLY to the
 * catalogue total. Each network is a bounded slice: fetch until the number of
 * distinct ids seen matches its declared count (or pages stop yielding anything
 * new), then move on. Completeness becomes checkable per slice rather than
 * assumed.
 *
 *   node crawl_ov_networks.js --delay 5000 [--only 780]
 */
const fs = require("fs");
const { Client } = require("pg");
const af = require("./af");
const PV = require("./parser_version");

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const API = "https://www.offervault.com/api/offers/search";
const STATE = `${__dirname}/.ov-networks.json`;
const LOCK = `${__dirname}/.ov-networks.lock`;
// The state file has ONE writer: this process. An offline "fix" once raced a running
// crawler and its corrections were overwritten — so any other instance exits, and
// reconciliation happens here, at startup, not in a side script.
function takeLock() {
  try {
    const pid = Number(fs.readFileSync(LOCK, "utf8"));
    if (pid && pid !== process.pid) { try { process.kill(pid, 0); console.error(`another crawler (pid ${pid}) owns the state; exiting`); process.exit(3); } catch {} }
  } catch {}
  fs.writeFileSync(LOCK, String(process.pid));
  const release = () => { try { if (Number(fs.readFileSync(LOCK, "utf8")) === process.pid) fs.unlinkSync(LOCK); } catch {} };
  process.on("exit", release); process.on("SIGTERM", () => { release(); process.exit(0); }); process.on("SIGINT", () => { release(); process.exit(0); });
}
const saveState = (st) => { const tmp = STATE + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(st)); fs.renameSync(tmp, STATE); };
// one line per request so the bottleneck is measurable, not guessed at
const METRICS = `${__dirname}/.crawl-metrics.jsonl`;
const zlib = require("zlib");
const RAWDIR = `${__dirname}/raw_pages/offervault`;
fs.mkdirSync(RAWDIR, { recursive: true });
const keep = (body, j) => { try { fs.writeFileSync(`${RAWDIR}/n${body.networks?.[0] ?? "all"}-c${(body.categories?.[0] ?? "all").toString().replace(/[^a-z0-9]+/gi, "_")}-p${body.page}.json.gz`, zlib.gzipSync(JSON.stringify(j))); } catch {} };
const metric = (o) => { try { fs.appendFileSync(METRICS, JSON.stringify({ t: new Date().toISOString(), ...o }) + "\n"); } catch {} };
const HEADERS = {
  "content-type": "application/json;charset=UTF-8",
  accept: "application/json, text/plain, */*",
  "site-identifier": "offervault",
  origin: "https://www.offervault.com",
  referer: "https://www.offervault.com/",
};

async function call(body, tries = 3) {
  const started = Date.now();
  for (let i = 0; i < tries; i++) {
    const t0 = Date.now();
    try {
      const r = await af.tool("fetch_url", {
        url: API, method: "POST", headers: HEADERS, body: JSON.stringify(body),
        returnBody: "text", maxChars: 400000, retries: 2,
        blockRules: ["http-status", "cloudflare-challenge"],
      });
      if (r.truncated === true) throw new Error("truncated");
      const j = JSON.parse(r.text || "{}");
      if (Array.isArray(j.offers)) {
        keep(body, j);
        metric({ ev: "fetch", ok: true, net: body.networks?.[0] ?? null, page: body.page,
                 ms: Date.now() - t0, waitMs: Date.now() - started, attempt: i + 1,
                 offers: j.offers.length, proxy: r.proxy ?? null });
        return j;
      }
      throw new Error(`no offers array (status ${r.status ?? "?"}, ${(r.text || "").length} chars: ${JSON.stringify((r.text || "").slice(0, 160))})`);
    } catch (e) {
      const reason = String(e.message).slice(0, 40);
      metric({ ev: "fetch", ok: false, net: body.networks?.[0] ?? null, page: body.page,
               ms: Date.now() - t0, attempt: i + 1, reason });
      if (i === tries - 1) throw e;
      const backoff = [20000, 60000, 120000][i] ?? 120000;
      metric({ ev: "backoff", ms: backoff, attempt: i + 1, reason });
      await af.sleep(backoff);
    }
  }
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const money = (v) => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : null; };
const base = (o) => ({ query: "", page: 1, sortBy: "", sortDesc: false,
  networks: [], countries: [], categories: [], ppc: false, mobile: false, ...o });

(async () => {
  const delay = Number(arg("--delay", 5000));
  const only = arg("--only", null);
  const maxNets = Number(arg("--max-networks", 0));
  let touched = 0;
  const db = new Client({ host: "host.docker.internal", port: 5432, database: "app", user: "postgres", password: "postgres" });
  await db.connect();
  await af.init();

  // network list and per-network totals come from the API itself
  const first = await call(base({ page: 1 }));
  const networks = (first.aggregates?.networks || [])
    .map((n) => ({ id: n.key, want: n.count }))
    .filter((n) => n.id != null)
    .sort((a, b) => a.want - b.want);          // small slices first on the very first pass
  // Bounded cycles must ROTATE: sorted by size alone, the same dozen small
  // stragglers were revisited every cycle and the big networks never came up —
  // the catalogue sat at 85% for hours. Least-recently-attempted goes first.
  const prev = (() => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return {}; } })();
  networks.sort((a, b) => (prev[a.id]?.last || 0) - (prev[b.id]?.last || 0) || a.want - b.want);
  console.log(`${networks.length} networks · declared total ${networks.reduce((a, n) => a + n.want, 0)}`);

  takeLock();
  const state = (() => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return {}; } })();
  // Reconcile at startup: "seen" must mean "stored". Ids missing from the database
  // are forgotten so their pages get fetched again; networks that lose ids reopen.
  {
    let purged = 0, reopened = 0;
    for (const [id, v] of Object.entries(state)) {
      const kept = [];
      for (let i = 0; i < (v.ids || []).length; i += 2000) {
        const { rows } = await db.query(`SELECT extra->>'ov_id' id FROM mr_program WHERE extra->>'ov_id' = ANY($1::text[])`, [v.ids.slice(i, i + 2000)]);
        rows.forEach((r) => kept.push(r.id));
      }
      purged += (v.ids || []).length - kept.length;
      const wasDone = v.done; v.ids = kept; v.got = kept.length;
      if (wasDone && !v.exhausted && kept.length < v.want) { v.done = false; reopened++; }
    }
    saveState(state);
    if (purged || reopened) console.log(`reconciled: forgot ${purged} unstored ids, reopened ${reopened} networks`);
    if (process.argv.includes("--reconcile-only")) { await db.end(); process.exit(0); }
  }
  const existing = new Map();
  for (const r of (await db.query(
    `SELECT seq, domain, program_name FROM mr_program WHERE site_adapter='offervault'`)).rows) {
    const k = norm(r.program_name); if (!k) continue;
    if (!existing.has(r.domain)) existing.set(r.domain, []);
    existing.get(r.domain).push({ seq: r.seq, key: k });
  }

  let inserted = 0, updated = 0;
  async function upsert(o, net, page) {
    const detail = `https://www.offervault.com/offer/${o.id}/${o.slug}`;
    const domain = `${o.networkSlug || "offervault"}.offers`;
    const pct = money(o.payoutPercentage), flat = money(o.payoutAmount);
    const countries = (o.countries || []).map((c) => c.code).filter(Boolean).slice(0, 60);
    const cats = (o.categories || []).map((c) => c.name || c.slug || c).filter((x) => typeof x === "string").slice(0, 8);
    const rate = o.variablePayout ? "variable" : (pct ? "percentage" : flat ? "cpa" : null);

    // provenance: the precise endpoint + request params this record came from,
    // so any field can be traced back to the exact call that produced it
    const prov = {
      endpoint: API, method: "POST",
      params: { networks: [net.id], page, query: "" },
      ov_id: o.id, fetched_at: new Date().toISOString(),
    };
    let ex = await db.query(`SELECT seq FROM mr_program WHERE extra->>'ov_id' = $1 OR detail_url = $2 LIMIT 1`, [o.id, detail]);
    if (!ex.rows[0]) {
      const key = norm(o.title);
      const hit = (existing.get(domain) || []).find((c) => c.key.length >= 12 && key.startsWith(c.key));
      if (hit) ex = { rows: [{ seq: hit.seq }] };
    }
    if (ex.rows[0]) {
      const up = await db.query(
        `UPDATE mr_program SET detail_url=$2, network=COALESCE(network,$3), signup_url=COALESCE(signup_url,$4),
           pct_min=COALESCE(pct_min,$5), pct_max=COALESCE(pct_max,$5), flat_min=COALESCE(flat_min,$6),
           flat_max=COALESCE(flat_max,$6), rate_type=COALESCE(rate_type,$7), currency=COALESCE(currency,$8),
           countries=COALESCE(countries,$9), categories=COALESCE(categories,$10),
           source_url=$12, source_endpoint=$13, source_fetched_at=now(), parser_version=$15, parsed_at=now(),
           extra = COALESCE(extra,'{}'::jsonb) || jsonb_build_object('ov_id',$11::text,'full_pass',true,'provenance',$14::jsonb)
         WHERE seq=$1 RETURNING (extra->>'ov_id') AS ov`,
        [ex.rows[0].seq, detail, o.networkName ?? null,
         /^https?:/.test(o.previewUrl || "") ? o.previewUrl : null, pct, flat, rate,
         o.payoutCurrency ?? null, countries.length ? countries : null, cats.length ? cats : null, o.id,
         detail, `POST ${API} networks=[${net.id}] page=${page}`, JSON.stringify(prov), PV.OFFERVAULT]);
      if (up.rowCount === 1 && up.rows[0].ov === o.id) { updated++; }
      else { metric({ ev: "claim_failed", seq: ex.rows[0].seq, ov_id: o.id, rows: up.rowCount }); ex = { rows: [] }; }
    }
    if (!ex.rows[0]) {
      try {
        await db.query(
          `INSERT INTO mr_program (program_name,domain,detail_url,source_url,site_adapter,network,signup_url,
             pct_min,pct_max,flat_min,flat_max,rate_type,currency,countries,categories,source_updated,
             source_endpoint,source_fetched_at,first_seen_at,parser_version,parsed_at,extra)
           VALUES ($1,$2,$3,$3,'offervault',$4,$5,$6,$6,$7,$7,$8,$9,$10,$11,$12,$14,now(),now(),$16,now(),
                   jsonb_build_object('ov_id',$13::text,'full_pass',true,'provenance',$15::jsonb))`,
          [o.title, domain, detail, o.networkName ?? null,
           /^https?:/.test(o.previewUrl || "") ? o.previewUrl : null, pct, flat, rate,
           o.payoutCurrency ?? null, countries.length ? countries : null, cats.length ? cats : null,
           o.updated_at ?? null, o.id,
           `POST ${API} networks=[${net.id}] page=${page}`, JSON.stringify(prov), PV.OFFERVAULT]);
        inserted++;
        if (!existing.has(domain)) existing.set(domain, []);
        existing.get(domain).push({ seq: -1, key: norm(o.title) });
      } catch (e) {
      if (e.code !== "23505") throw e;
      // same (network, title) exists for a DIFFERENT offer — keep both, distinguished
      // by GEO/id, instead of silently losing this one (TabTrade has 51 such variants)
      const alt = `${o.title} ${countries[0] ? `[${countries[0]}]` : ""} #${String(o.id).slice(0, 6)}`.replace(/\s+/g, " ").trim();
      try {
        await db.query(
          `INSERT INTO mr_program (program_name,domain,detail_url,source_url,site_adapter,network,signup_url,
             pct_min,pct_max,flat_min,flat_max,rate_type,currency,countries,categories,source_updated,
             source_endpoint,source_fetched_at,first_seen_at,parser_version,parsed_at,extra)
           VALUES ($1,$2,$3,$3,'offervault',$4,$5,$6,$6,$7,$7,$8,$9,$10,$11,$12,$14,now(),now(),$16,now(),
                   jsonb_build_object('ov_id',$13::text,'full_pass',true,'provenance',$15::jsonb))`,
          [alt, domain, detail, o.networkName ?? null, /^https?:/.test(o.previewUrl || "") ? o.previewUrl : null,
           pct, flat, rate, o.payoutCurrency ?? null, countries.length ? countries : null, cats.length ? cats : null,
           o.updated_at ?? null, o.id, `POST ${API} networks=[${net.id}] page=${page}`, JSON.stringify(prov), PV.OFFERVAULT]);
        inserted++;
      } catch (e2) { if (e2.code !== "23505") throw e2; metric({ ev: "dropped", ov_id: o.id, reason: "duplicate even with suffix" }); }
    }
    }
      
  }

  for (const net of networks) {
    if (only && String(net.id) !== String(only)) continue;
    if (state[net.id]?.done) continue;
    if (maxNets && touched++ >= maxNets) break;

    const seen = new Set(state[net.id]?.ids || []);
    let page = 1, dryRounds = 0;
    // stop when the slice is accounted for, or pages stop adding anything new
    while (seen.size < net.want && dryRounds < 4 && page <= Math.ceil(net.want / 20) + 12) {
      let j;
      try { j = await call(base({ page, networks: [net.id] })); }
      catch { dryRounds++; await af.pace(delay); page++; continue; }
      if (!j.offers.length) break;

      const before = seen.size;
      for (const o of j.offers) { seen.add(o.id); await upsert(o, net, page); }
      dryRounds = seen.size === before ? dryRounds + 1 : 0;
      page++;
      await af.pace(delay);
    }

    metric({ ev: "network_done", net: net.id, want: net.want, got: seen.size,
             complete: seen.size >= net.want, pages: page - 1 });
    // Random ordering leaves the last few percent of a big slice unreachable by
    // re-sampling. Split the slice by category: each sub-space is small enough that
    // its pages actually enumerate it.
    if (seen.size < net.want) {
      const cats = (first.aggregates?.categories || []).map((c) => c.key).filter(Boolean).slice(0, 60);
      for (const cat of cats) {
        if (seen.size >= net.want) break;
        let cp = 1, dry = 0;
        while (dry < 2 && cp <= 25) {
          let cj; try { cj = await call(base({ page: cp, networks: [net.id], categories: [cat] })); } catch { break; }
          if (!cj.offers.length) break;
          const before = seen.size;
          for (const o of cj.offers) { if (!seen.has(o.id)) { seen.add(o.id); await upsert(o, net, cp); } }
          dry = seen.size === before ? dry + 1 : 0; cp++;
          await af.pace(delay);
        }
      }
      // second axis for the biggest gaps: category x country shrinks the random
      // space further than category alone
      if (seen.size < net.want && net.want - seen.size > 150) {
        const countries = (first.aggregates?.countries || []).map((c) => c.key).filter(Boolean).slice(0, 25);
        for (const cat of cats.slice(0, 12)) for (const cc of countries) {
          if (seen.size >= net.want) break;
          let cj; try { cj = await call(base({ page: 1, networks: [net.id], categories: [cat], countries: [cc] })); } catch { continue; }
          for (const o of cj.offers) if (!seen.has(o.id)) { seen.add(o.id); await upsert(o, net, 1); }
          await af.pace(delay);
        }
      }
      metric({ ev: "subpartition", net: net.id, got: seen.size, want: net.want });
    }
    // Declared counts include offers the API never returns (expired/deleted). A
    // network that gains nothing across three full attempts is exhausted, not
    // incomplete — otherwise the loop chases ghosts forever.
    const before = state[net.id]?.got || 0;
    const attempts = (state[net.id]?.dryAttempts || 0) + (seen.size === before ? 1 : 0);
    if (attempts >= 3 && seen.size < net.want) { metric({ ev: "exhausted", net: net.id, got: seen.size, want: net.want }); }
    // "seen" must mean "stored": an id the crawler saw but a constraint dropped is
    // not progress. Reconcile against the database and forget anything missing, so
    // the next cycle fetches it again instead of counting the slice as complete.
    const ids = [...seen];
    const storedIds = new Set();
    for (let i = 0; i < ids.length; i += 2000) {
      const { rows } = await db.query(`SELECT extra->>'ov_id' id FROM mr_program WHERE extra->>'ov_id' = ANY($1::text[])`, [ids.slice(i, i + 2000)]);
      rows.forEach((r) => storedIds.add(r.id));
    }
    const lost = ids.filter((id) => !storedIds.has(id));
    if (lost.length) { metric({ ev: "unstored", net: net.id, n: lost.length }); lost.forEach((id) => seen.delete(id)); }
    state[net.id] = { ids: [...seen], want: net.want, got: seen.size, done: seen.size >= net.want || attempts >= 3, exhausted: attempts >= 3 && seen.size < net.want, dryAttempts: seen.size === before ? attempts : 0, last: Date.now() };
    saveState(state);
    const mark = seen.size >= net.want ? "complete" : `${Math.round((seen.size / net.want) * 100)}%`;
    console.log(`  network ${String(net.id).padStart(5)} ${String(seen.size).padStart(5)}/${String(net.want).padEnd(5)} ${mark} · +${inserted} new so far`);
  }

  const done = Object.values(state).filter((s) => s.done).length;
  const got = Object.values(state).reduce((a, s) => a + s.got, 0);
  console.log(`\n${done}/${networks.length} networks complete · ${got} distinct offers seen · ${inserted} inserted, ${updated} updated`);
  await db.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
