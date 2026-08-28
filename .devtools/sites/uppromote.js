// uppromote.com/affiliate-directory/<slug> — ~780 programmes: commission, cookie days,
// regions, website, niche, affiliate platform, join link, subheading, plus editorial
// Feature/Description tables (industry, product type, programme type, materials …).
const { text, between, decode, host, pctRange } = require("./_common");
module.exports = {
  name: "uppromote", lang: "en", region: "global", base: "https://uppromote.com",
  async list(af) {
    const r = await af.get(`${this.base}/directory-sitemap.xml`, { tries: 2 });
    return [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/uppromote\.com\/affiliate-directory\/([a-z0-9-]+)\/)<\/loc>/g)].map((m) => ({ url: m[1], slug: m[2] }));
  },
  parse(html, url) {
    const h = String(html);
    const name = text(between(h, '<h1 class="headline">', "</h1>").replace(/^[^>]*>/, "").replace(/<strong>Affiliate Program<\/strong>/, ""));
    if (!name) throw new Error("no name");
    const kv = Object.fromEntries([...h.matchAll(/category-group__name">([^<]*)<\/p>\s*<p class="category-group__subcontent">([^<]*)</g)].map((m) => [text(m[1]), text(m[2])]));
    const join = (h.match(/href="([^"]+)"[^>]*class="btn-primary btn-lg btn-join"/) || [])[1] || null;
    const site = kv["Website"] ? (kv["Website"].startsWith("http") ? kv["Website"] : `https://${kv["Website"]}`) : null;
    const sub = text(between(h, 'class="description__subheading"', "</div>").replace(/^[^>]*>/, ""));
    const rows = [...h.matchAll(/<tr><td><strong>([^<]*)<\/strong><\/td><td>([\s\S]*?)<\/td><\/tr>/g)].map((m) => [text(m[1]), text(m[2])]);
    const table = Object.fromEntries(rows);
    const comm = kv["Commission"] || "", pct = /%/.test(comm) ? pctRange(comm) : {}, usd = comm.match(/\$\s*([\d,]+(?:\.\d+)?)/);
    const cookie = (kv["Cookie"] || "").match(/(\d+)/);
    const regions = (kv["Regions"] || "").split(/\s*,\s*/).filter(Boolean);
    const models = [...new Set(((table["Affiliate Program Type"] || "") + " " + comm).match(/\b(CPA|CPL|CPS|CPC|RevShare|Hybrid)\b/g) || [])];
    return {
      program_name: name, domain: site ? host(site) : `uppromote.${url.replace(/\/$/, "").split("/").pop()}`, landing_url: site, signup_url: join || url,
      description: sub.slice(0, 2000) || null, vertical: kv["Niche"] || table["Industry"] || null, categories: [kv["Niche"], table["Industry"]].filter(Boolean),
      network: kv["Affiliate platform"] && !/^(direct|in-house|none)$/i.test(kv["Affiliate platform"]) ? kv["Affiliate platform"] : (kv["Affiliate platform"] || null),
      commission: comm || null, commission_type: models.join(", ") || (pct.pct_max != null ? "CPS" : usd ? "CPA" : null), commission_types: models.length ? models : null,
      pct_min: pct.pct_min ?? null, pct_max: pct.pct_max ?? null, flat_min: usd ? parseFloat(usd[1].replace(/,/g, "")) : null, flat_max: usd ? parseFloat(usd[1].replace(/,/g, "")) : null, currency: usd ? "USD" : null,
      cookie_days: cookie ? +cookie[1] : null, cookie_length_raw: kv["Cookie"] ? `${kv["Cookie"]} days` : null,
      geo: regions.join(", ") || null, countries: regions.filter((r) => /^[A-Z]{2}$/.test(r)).length ? regions.filter((r) => /^[A-Z]{2}$/.test(r)) : null,
      extra: { fields: kv, table: rows.length ? table : undefined },
    };
  },
};
