// best-affiliate-programs.net — 45,413 programmes behind a Livewire list (20 per page).
// The listing HTML only carries page 1; further pages come from the component's own
// /livewire-*/update endpoint with the page snapshot + {page: N}. Each card yields
// name, detail URL (id), blurb, models (CPA/CPL, RevShare, CPS), indicator values, logo.
const { text, decode } = require("./_common");
const ROOT = "https://www.best-affiliate-programs.net/affiliate-programs-directory";
let session = null; // { uri, csrf, snapshot }
async function openSession(af) {
  const r = await af.tool("fetch_url", { url: ROOT, returnBody: "html", maxChars: 2000000, retries: 2, strategy: "sticky", blockRules: ["http-status"] });
  const h = r.html || "";
  const cfg = JSON.parse(((h.match(/livewireScriptConfig\s*=\s*(\{.*?\})\s*[;<]/) || [])[1] || "{}").replace(/\\\//g, "/"));
  const snap = [...h.matchAll(/wire:snapshot="([^"]+)"/g)].map((m) => decode(m[1])).find((x) => /"total":\d{4,}/.test(x));
  if (!cfg.uri || !snap) throw new Error("livewire session: no config/snapshot");
  session = { uri: cfg.uri, csrf: cfg.csrf, snapshot: snap, total: +(snap.match(/"total":(\d+)/) || [])[1] };
  return session;
}
module.exports = {
  name: "bap_list", lang: "en", region: "global", base: "https://best-affiliate-programs.net",
  async list(af) {
    const s = await openSession(af);
    const pages = Math.ceil(s.total / 20);
    return Array.from({ length: pages }, (_, i) => ({ url: `${ROOT}?page=${i + 1}`, slug: `p${i + 1}` }));
  },
  async fetch(af, item) {
    const page = +item.slug.slice(1);
    for (let attempt = 0; attempt < 2; attempt++) {
      const s = session || await openSession(af);
      const p = await af.tool("fetch_url", { url: s.uri, method: "POST", headers: { "Content-Type": "application/json", "X-Livewire": "true", Accept: "application/json", "X-CSRF-TOKEN": s.csrf, Referer: ROOT }, body: JSON.stringify({ _token: s.csrf, components: [{ snapshot: s.snapshot, updates: { page }, calls: [] }] }), returnBody: "html", maxChars: 3000000, retries: 2, strategy: "sticky", blockRules: [] });
      const t = p.html || p.text || "";
      try { const j = JSON.parse(t); const c = j.components && j.components[0]; if (c && c.effects && c.effects.html) { if (c.snapshot) session.snapshot = c.snapshot; return c.effects.html; } } catch {}
      session = null; // expired / checksum mismatch: reopen once
    }
    throw new Error("livewire page fetch failed");
  },
  parse(html, url) {
    const h = String(html).replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/wire:snapshot="[^"]*"/g, "").replace(/<!--\[if [^\]]*\]><!\[endif\]-->/g, "");
    // each card has two anchors with the same href (logo + name); split on the logo one only
    const cards = h.split(/(?=<a href="https:\/\/best-affiliate-programs\.net\/programs\/[a-z0-9-]+\/\d+"\s+title="Affiliate program - [^"]*"\s+class="col-span-2)/).slice(1);
    const seen = new Set();
    return cards.map((c) => {
      const m = c.match(/href="(https:\/\/best-affiliate-programs\.net\/programs\/([a-z0-9-]+)\/(\d+))"/); if (!m || seen.has(m[3])) return null; seen.add(m[3]);
      const name = text((c.match(/<a href="https:\/\/best-affiliate-programs\.net\/programs\/[^"]+"[^>]*class="text-sm[^"]*"[^>]*>([\s\S]*?)<\/a>/) || c.match(/title="Affiliate program - ([^"]+)"/) || [])[1] || "");
      const blurb = text((c.match(/class="mt-2 text-xs leading-4 text-on-surface"\s*>([\s\S]*?)<\/div>/) || [])[1] || "");
      const logo = (c.match(/<img src="(https:\/\/best-affiliate-programs\.net\/storage\/[^"]+)"/) || [])[1] || null;
      const cols = [...c.matchAll(/hidden max-lg:block"\s*>(Type\/Model|Indicators)<\/div>([\s\S]*?)<\/div>\s*<\/div>/g)];
      const vals = (label) => { const x = cols.find((k) => k[1] === label); return x ? [...x[2].matchAll(/<div>([^<]+)<\/div>/g)].map((v) => text(v[1])).filter(Boolean) : []; };
      const models = vals("Type/Model"), ind = vals("Indicators");
      const usd = ind.map((v) => v.match(/\$\s*([\d,]+(?:\.\d+)?)/)).filter(Boolean).map((x) => parseFloat(x[1].replace(/,/g, "")));
      const pct = ind.map((v) => v.match(/([\d.]+)\s*%/)).filter(Boolean).map((x) => parseFloat(x[1]));
      return {
        key: m[3], program_name: name || null, domain: `bap.${m[3]}`, signup_url: m[1], landing_url: null, logo_url: logo,
        description: blurb.replace(/\.{3}$/, "").slice(0, 1000) || null,
        commission: ind.join(" · ") || null, commission_type: models.join(", ") || null, commission_types: models.length ? models : null,
        flat_min: usd.length ? Math.min(...usd) : null, flat_max: usd.length ? Math.max(...usd) : null, currency: usd.length ? "USD" : null,
        pct_min: pct.length ? Math.min(...pct) : null, pct_max: pct.length ? Math.max(...pct) : null,
        extra: { bap_id: m[3], bap_slug: m[2], indicators: ind, listing_page: url, detail_pending: true },
      };
    }).filter((r) => r && r.program_name);
  },
};
