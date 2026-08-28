// best-affiliate-programs.net/programs/<slug>/<id> — 45,413 programme pages. The Livewire
// listing cannot be paged from outside, but detail URLs accept any slug (/programs/x/<id>)
// and every page links ~10 related programmes, so the crawl walks the catalogue as a graph
// from the ids seen in the listing. Fields: name, blurb, description, tags, parameters
// (status, currency, CPA/CPL, RevShare, bonuses), supported-country count, last update.
const { text, between, decode } = require("./_common");
const BASE = "https://best-affiliate-programs.net";
const SEEDS = ["3081212", "2769151", "2851875", "2843757", "3066979", "2917159", "2990319", "3077327", "3031183", "2812108", "3031180", "3059461", "3058086", "3031179", "2758174", "3031185", "3031176"];
module.exports = {
  name: "bap_detail", lang: "en", region: "global", base: BASE, authoritative: true, // detail pages replace listing stubs
  async list(af, db) {
    const ids = new Set(SEEDS);
    try { for (const r of (await db.query(`SELECT extra->>'bap_id' AS id FROM mr_program WHERE site_adapter = 'bap_list' AND extra ? 'bap_id'`)).rows) if (r.id) ids.add(r.id); } catch {}
    return [...ids].map((id) => ({ url: `${BASE}/programs/x/${id}`, slug: id }));
  },
  next(html, url) {
    return [...new Set([...String(html).matchAll(/href="https:\/\/best-affiliate-programs\.net\/programs\/[a-z0-9-]+\/(\d+)"/g)].map((m) => m[1]))].map((id) => ({ url: `${BASE}/programs/x/${id}`, slug: id }));
  },
  parse(html, url) {
    const h = String(html).replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/wire:snapshot="[^"]*"/g, "").replace(/<!--\[if [^\]]*\]><!\[endif\]-->/g, "");
    const name = text(between(h, "<h1", "</h1>").replace(/^<h1[^>]*>/, "")).replace(/\s*-\s*affiliate program$/i, "");
    if (!name) throw new Error("no name");
    const blurb = text(between(h, "</h1>", "</h2>").replace(/^[\s\S]*?<h2[^>]*>/, "")).replace(/^Affiliate program - [^.]*\.\s*/, "");
    const tagBlock = between(h, 'text-xs mt-5 text-tertiary"', "</div>");
    const tags = [...tagBlock.matchAll(/programs\/tag\.[a-z0-9-]+"[^>]*>\s*([^<]+?)\s*</g)].map((m) => text(m[1]));
    const hx = h.replace(/x-data="[\s\S]*?"\s*>/g, ">").replace(/:class="[^"]*"/g, "");
    const body = between(hx, 'text-xs mt-5 text-tertiary"', 'aria-label="Parameters Information"');
    const desc = text(body.replace(/^[\s\S]*?<\/div>/, "").replace(/<a [^>]*>[^<]*<\/a>/g, "").replace(/<br\s*\/?>/g, " · ").replace(/<button[\s\S]*?<\/button>/g, "")).replace(/\s*(Show more|Show less)\s*$/, "");
    const params = Object.fromEntries([...between(h, 'aria-label="Parameters Information"', "Supported countries").matchAll(/text-on-surface-variant">([^<]*)<\/span>\s*<span class="text-lg text-on-surface">([^<]*)</g)].map((m) => [text(m[1]), text(m[2])]));
    const sup = (h.match(/Supported countries \((\d+)\)/) || [])[1];
    const last = (h.match(/Last update:\s*([A-Z][a-z]+ \d{1,2}, \d{4})/) || [])[1];
    const net = (h.match(/href="https:\/\/best-affiliate-programs\.net\/networks\/([a-z0-9-]+)\/\d+"[^>]*>\s*([^<]{2,60}?)\s*</) || []);
    const forbidden = (desc.match(/don't accept traffic from these countries:\s*(.*)$/i) || [])[1];
    const usd = (params["CPA/CPL"] || "").match(/([\d,]+(?:\.\d+)?)/), pct = (params["RevShare"] || "").match(/([\d.]+)\s*%/), cps = (params["CPS"] || params["CPS (Ratio)"] || "").match(/([\d.]+)\s*%/);
    const models = ["CPA/CPL", "RevShare", "CPS", "CPS (Ratio)", "CPC", "CPM"].filter((k) => params[k]);
    return {
      program_name: name, domain: `bap.${url.split("/").pop()}`, signup_url: `${url.replace(/\/x\//, "/")}/join`, landing_url: null,
      logo_url: null, description: (desc || blurb).slice(0, 3000) || null,
      vertical: tags[0] || null, categories: tags.length ? tags : null, tags: tags.slice(0, 20),
      network: net[2] ? text(net[2]) : null, commission: models.map((k) => `${k}: ${params[k]}`).join("; ") || null,
      commission_type: models.map((k) => k.replace(" (Ratio)", "")).join(", ") || null, commission_types: models.length ? models.map((k) => k.replace(" (Ratio)", "")) : null,
      currency: params["Currency"] || null, flat_max: usd ? parseFloat(usd[1].replace(/,/g, "")) : null, flat_min: usd ? parseFloat(usd[1].replace(/,/g, "")) : null,
      pct_max: pct ? +pct[1] : cps ? +cps[1] : null, pct_min: pct ? +pct[1] : cps ? +cps[1] : null,
      source_updated: last ? new Date(last + " UTC").toISOString().slice(0, 10) : null,
      extra: { bap_id: url.split("/").pop(), status: params["Status"], parameters: params, supported_countries: sup ? +sup : undefined, forbidden_countries: forbidden ? forbidden.replace(/<[\s\S]*$/, "").replace(/\s*·\s*$/, "").slice(0, 600) : undefined },
    };
  },
};
