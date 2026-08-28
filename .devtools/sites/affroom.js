// affroom.com — reviews of affiliate programmes and CPA networks (labelled option rows:
// vertical, brands, commission type, countries, minimum payouts, …; rating /5).
const { text, between, ldjson, decode, host } = require("./_common");
module.exports = {
  name: "affroom", lang: "en", region: "global", base: "https://affroom.com",
  async list(af) {
    const out = new Map();
    for (const sm of ["affiliate-program-sitemap.xml", "cpa-network-sitemap.xml"]) {
      try { const r = await af.get(`${this.base}/${sm}`, { tries: 2 }); for (const m of (r.html || r.text || "").matchAll(/<loc>(https:\/\/affroom\.com\/(?:affiliate-programs|cpa-networks)\/reviews\/([a-z0-9-]+)\/)<\/loc>/g)) out.set(m[2], { url: m[1], slug: m[2] }); } catch {}
      await af.pace(2000);
    }
    try { const r = await af.get(`${this.base}/cpa-networks/reviews/`, { tries: 2 }); for (const m of (r.html || "").matchAll(/href="(https:\/\/affroom\.com\/cpa-networks\/reviews\/([a-z0-9-]+)\/)"/g)) out.set(m[2], { url: m[1], slug: m[2] }); } catch {}
    return [...out.values()];
  },
  parse(html, url) {
    const h = String(html);
    const name = text(between(h, "<h1", "</h1>").replace(/^<h1[^>]*>/, ""));
    if (!name) throw new Error("no name");
    const opts = Object.fromEntries([...h.matchAll(/option__title">([^<]*)<\/div>\s*<div class="option__list">([\s\S]*?)<\/div>/g)].map((m) => [text(m[1]), [...m[2].matchAll(/list__item">\s*([^<]*?)\s*</g)].map((x) => text(x[1])).filter(Boolean)]));
    const site = (h.match(/class="[^"]*card__website"[^>]*href="([^"]+)"/) || [])[1] || null;
    const rating = (h.match(/rating__counter">\s*<span>\s*([\d.]+)/) || [])[1];
    const graph = ldjson(h).flatMap((j) => j["@graph"] || [j]); const page = graph.find((g) => g["@type"] === "WebPage") || {};
    const models = opts["Commission Type"] || [];
    const cc = (opts["Countries"] || []).filter((c) => /^[A-Z]{3}$/.test(c));
    const desc = text(between(h, 'class="post-content"', 'class="table-of-contents').replace(/<div class="smiley-rating"[\s\S]*?<\/div><\/div><\/div>/, "").replace(/^[^>]*>/, "").replace(/<\/(p|li|h\d)>/g, " · ")).replace(/^What do you think\?[\s\S]*?(?=[A-Z][a-z]+ [a-z])/, "").slice(0, 3000);
    return {
      program_name: name, domain: site ? host(site) : `affroom.${url.replace(/\/$/, "").split("/").pop()}`, signup_url: site, landing_url: null, logo_url: page.thumbnailUrl || null,
      description: desc && !/^(Leave the email|What do you think)/.test(desc) ? desc : null, vertical: (opts["Vertical"] || [])[0] || null, categories: opts["Vertical"] || null,
      commission_type: models.join(", ") || null, commission_types: models.length ? models : null,
      countries: cc.length ? cc : null, geo: (opts["Countries"] || []).join(", ") || null, min_payment_raw: (opts["Minimum payouts"] || []).join(", ") || null,
      payment_methods: opts["Payment methods"] || opts["Payment Methods"] || null, payment_frequency: (opts["Payment Frequency"] || [])[0] || null,
      rating_avg: rating ? parseFloat(rating) : null, source_updated: (page.dateModified || page.datePublished || "").slice(0, 10) || null,
      extra: { options: opts, brands: opts["Brands"], kind: /cpa-networks/.test(url) ? "network" : "program", rating_scale: 5 },
    };
  },
};
