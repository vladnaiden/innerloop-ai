// affililist.com — ~1,000 SaaS/creator programmes. Each page ships a schema.org
// Organization with makesOffer (the programme URL) plus labelled stat tiles.
const { text, host, ldjson, between, pctRange } = require("./_common");
module.exports = {
  name: "affililist", lang: "en", region: "global", base: "https://www.affililist.com",
  async list(af) {
    const r = await af.get(`${this.base}/sitemap.xml`, { tries: 2 });
    return [...(r.html || r.text || "").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
      .filter((u) => u.includes("/affiliate/")).map((url) => ({ url, slug: url.split("/").pop() }));
  },
  parse(html, url) {
    const h = String(html);
    const graph = ldjson(h).flatMap((j) => j["@graph"] || [j]);
    const page = graph.find((g) => g["@type"] === "WebPage") || {};
    const org = page.mainEntity || {};
    const offer = org.makesOffer || {};
    const tile = (l) => { const m = h.match(new RegExp(`>${l}</h6>\\s*<p[^>]*>([^<]*)<`)); return m ? text(m[1]) : null; };
    const rate = tile("Commission Rate"), cookie = tile("Cookie Duration"), structure = tile("Commission Structure"), duration = tile("Commission Duration");
    const desc = text(between(h, "program-overview-markdown", "</div>").replace(/^[^>]*>/, ""));
    const tags = [...h.matchAll(/href="\/tag\/([^"]+)"/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i);
    const pct = rate ? pctRange(rate) : {};
    return {
      program_name: org.name || text(between(h, "<h1", "</h1>").replace(/^<h1[^>]*>/, "")) || null,
      landing_url: org.url || null, domain: host(org.url) || null, signup_url: offer.url || null,
      logo_url: org.logo || null, description: desc || page.description || null,
      commission: rate, commission_type: structure, pct_min: pct.pct_min ?? null, pct_max: pct.pct_max ?? null,
      recurring: structure ? /recurring/i.test(structure) : null, lifetime: duration ? /lifetime/i.test(duration) : null,
      cookie_days: cookie ? parseInt(cookie, 10) || null : null, cookie_length_raw: cookie,
      tags: tags.length ? tags.slice(0, 20) : null,
      extra: { commission_duration: duration, offer_description: offer.description },
    };
  },
};
