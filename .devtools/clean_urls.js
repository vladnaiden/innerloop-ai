// Cleanup pass over mr_program.signup_url / landing_url with url_clean.js. --dry prints the plan.
// Originals are logged to backups/url_clean_<ts>.jsonl (never into extra — the site renders extra).
const { Client } = require("pg"); const fs = require("fs"); const { clean } = require("./url_clean");
const DRY = process.argv.includes("--dry");
(async () => {
  const db = new Client({ host: "host.docker.internal", port: 5432, database: "app", user: "postgres", password: "postgres" }); await db.connect();
  const rows = (await db.query("select id, site_adapter, signup_url, landing_url from mr_program where signup_url is not null or landing_url is not null")).rows;
  const stats = {}, log = []; let upd = 0;
  const bump = (k) => (stats[k] = (stats[k] || 0) + 1);
  const ts = new Date().toISOString().replace(/[:.]/g, "-"); const out = fs.createWriteStream(DRY ? `/tmp/claude-1000/-workspaces-innerloop-ai/2a125e9a-7a4d-4372-835b-78d6e5695141/scratchpad/url_clean_dry.jsonl` : `backups/url_clean_${ts}.jsonl`);
  if (!DRY) await db.query("begin");
  for (const r of rows) {
    const set = {};
    for (const col of ["signup_url", "landing_url"]) {
      if (!r[col]) continue; const c = clean(r[col]);
      if (c.changed) { set[col] = c.url; bump(`${col}:${c.reason}`); bump(`adapter:${r.site_adapter}`); if (out) out.write(JSON.stringify({ id: r.id, col, before: r[col], after: c.url, reason: c.reason }) + "\n"); }
    }
    if (!Object.keys(set).length) continue;
    // a dropped signup_url falls back to the (cleaned) landing page when one exists
    if ("signup_url" in set && set.signup_url === null) { const land = "landing_url" in set ? set.landing_url : r.landing_url; if (land) set.signup_url = land; }
    upd++;
    if (!DRY) { const keys = Object.keys(set); await db.query(`update mr_program set ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")} where id = $1`, [r.id, ...keys.map((k) => set[k])]); }
  }
  if (!DRY) await db.query("commit"); out.end();
  console.log(`${DRY ? "DRY " : ""}rows to update: ${upd}`); console.log(Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => `${k}=${v}`).join("\n"));
  await db.end();
})().catch((e) => { console.error(e); process.exit(1); });
