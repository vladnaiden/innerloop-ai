// Merge cross-source duplicates in mr_program: rows with the same normalised domain + programme
// name coming from DIFFERENT site adapters. Same-adapter twins (per-GEO offers etc.) are left alone.
// Survivor = the row with the most non-null columns; its NULLs are filled from the others, array
// columns are unioned, extra gets also_on[] + merged_from{adapter: {keys the survivor lacked}}.
// Losers are deleted. --dry prints the plan only. A log goes to backups/merge_<ts>.json.
const { Client } = require("pg"); const fs = require("fs");
const DRY = process.argv.includes("--dry");
(async () => {
  const db = new Client({ host: "host.docker.internal", port: 5432, database: "app", user: "postgres", password: "postgres" }); await db.connect();
  const cols = (await db.query("select column_name, data_type from information_schema.columns where table_name='mr_program'")).rows;
  const arr = new Set(cols.filter((c) => c.data_type === "ARRAY").map((c) => c.column_name));
  const skip = new Set(["id", "slug", "extra", "site_adapter", "seq", "first_seen_at"]);
  const groups = (await db.query(`
    with r as (select id, site_adapter, regexp_replace(lower(domain),'^www\\.','') d, regexp_replace(lower(program_name),'[^a-z0-9а-яё]+','','g') n from mr_program
      where domain is not null and program_name is not null and domain !~ ('^' || site_adapter || '\\.') and domain !~ '\\.\\d+$')
    select d, n, array_agg(id) ids from r group by d,n having count(distinct site_adapter)>1`)).rows;
  const log = []; let merged = 0;
  if (!DRY) await db.query("begin");
  for (const g of groups) {
    const rows = (await db.query("select * from mr_program where id = any($1)", [g.ids])).rows;
    const score = (r) => Object.entries(r).filter(([k, v]) => !skip.has(k) && v !== null && v !== "" && !(Array.isArray(v) && !v.length)).length;
    rows.sort((a, b) => score(b) - score(a) || a.id - b.id);
    const surv = rows[0]; const seen = new Set([surv.site_adapter]); const losers = [];
    for (const r of rows.slice(1)) { if (seen.has(r.site_adapter)) continue; seen.add(r.site_adapter); losers.push(r); }
    if (!losers.length) continue;
    const set = {}; const fromKeys = {};
    for (const r of losers) {
      for (const c of cols.map((c) => c.column_name)) {
        if (skip.has(c)) continue;
        const sv = c in set ? set[c] : surv[c], lv = r[c];
        if (lv === null || lv === "" || (Array.isArray(lv) && !lv.length)) continue;
        if (arr.has(c)) { const u = [...new Set([...(sv || []), ...lv])]; if (u.length !== (sv || []).length) set[c] = u; }
        else if (sv === null || sv === "") set[c] = lv;
      }
      const ex = r.extra || {}; const missing = Object.fromEntries(Object.entries(ex).filter(([k]) => !(surv.extra || {})[k] && !["also_on", "merged_from", "provenance"].includes(k)));
      fromKeys[r.site_adapter] = { slug: r.slug, detail_url: r.detail_url, ...(Object.keys(missing).length ? { extra: missing } : {}) };
    }
    const alsoOn = [...new Set([...(surv.extra?.also_on || []), ...losers.map((r) => r.site_adapter)])];
    const extra = { ...(surv.extra || {}), also_on: alsoOn, merged_from: { ...(surv.extra?.merged_from || {}), ...fromKeys } };
    log.push({ survivor: surv.id, survivor_slug: surv.slug, losers: losers.map((r) => ({ id: r.id, slug: r.slug, site_adapter: r.site_adapter })), filled: Object.keys(set) });
    merged += losers.length;
    if (DRY) continue;
    const keys = Object.keys(set); const vals = keys.map((k) => set[k]);
    await db.query(`update mr_program set ${keys.map((k, i) => `${k} = $${i + 3}`).concat(["extra = $2::jsonb", "last_checked = now()"]).join(", ")} where id = $1`, [surv.id, JSON.stringify(extra), ...vals]);
    await db.query("delete from mr_program where id = any($1)", [losers.map((r) => r.id)]);
  }
  if (!DRY) { await db.query("commit"); fs.writeFileSync(`backups/merge_${new Date().toISOString().replace(/[:.]/g, "-")}.json`, JSON.stringify(log, null, 1)); }
  console.log(`${DRY ? "DRY " : ""}groups ${log.length}, rows merged ${merged}; sample:`, JSON.stringify(log[0]));
  await db.end();
})().catch((e) => { console.error(e); process.exit(1); });
