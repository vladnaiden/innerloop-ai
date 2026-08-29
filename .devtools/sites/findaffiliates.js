// findaffiliates.online/<slug>-affiliate-program — FindAffiliates directory: ~5,000 programme
// pages with category, commission, cookie days (header pills), advertiser website, description,
// last-verified date, logo. Apply links are login-gated (not stored). Listing: sitemap.xml root URLs.
const { text, decode, between, host } = require("./_common");
module.exports = {
  name: "findaffiliates", lang: "en", region: "global", base: "https://www.findaffiliates.online",
  async list(af) {
    const r = await af.get(`${this.base}/sitemap.xml`, { tries: 2, maxChars: 4000000 });
    return [...(r.html || r.text || "").matchAll(/<loc>https:\/\/www\.findaffiliates\.online\/([a-z0-9-]+)<\/loc>/g)].map((m) => m[1])
      .filter((s) => !/^(tools|blog|faq|privacy|terms|about|login|pro|pricing|contact|affiliate-programs|search|categories)$/.test(s))
      .map((s) => ({ url: `${this.base}/${s}`, slug: s }));
  },
  urlFor(slug) { return `${this.base}/${slug}`; },
  parse(html, url) {
    const h = String(html).replace(/<!--\s*-->/g, "");
    const name = text(decode((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "")).replace(/\s+Affiliate Program$/i, "");
    if (!name) { const e = new Error("no programme on page"); e.gone = true; throw e; }
    const pill = (label) => text(decode((h.match(new RegExp(`>${label}:\\s*([^<]*)<`)) || [])[1] || ""));
    const cat = pill("Category"), comm = pill("Commission"), cookie = pill("Cookies");
    const site = (h.match(/rel="sponsored nofollow noopener" href="([^"]+)">Visit Website/) || [])[1] || null;
    const desc = text(decode((between(h, ">Description</h3>", "</div></div></div></div>") || "").replace(/<[^>]+>/g, " "))).replace(/^More information\s*/, "");
    const verified = (h.match(/Last verified:\s*([A-Za-z]+ \d{1,2}, \d{4})/) || [])[1];
    const logo = (h.match(/<img alt="[^"]*logo"[^>]*src="([^"]+)"/) || [])[1];
    const pct = [...comm.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => +m[1]);
    const flat = comm.match(/\$\s*([\d,]+(?:\.\d+)?)/);
    const cd = cookie.match(/(\d+)/);
    return {
      program_name: name, domain: site ? host(site) : `findaffiliates.${url.split("/").pop()}`, landing_url: site, signup_url: site || url, logo_url: logo ? (logo.startsWith("/") ? this.base + logo : logo) : null,
      description: desc.slice(0, 4000) || null,
      commission: comm || null, commission_type: /recurring/i.test(comm) ? "RevShare" : pct.length ? "CPS" : flat ? "CPA" : null,
      pct_min: pct.length ? Math.min(...pct) : null, pct_max: pct.length ? Math.max(...pct) : null, flat_min: flat ? parseFloat(flat[1].replace(/,/g, "")) : null, flat_max: flat ? parseFloat(flat[1].replace(/,/g, "")) : null, currency: flat ? "USD" : null,
      recurring: /recurring/i.test(comm) ? true : null,
      cookie_days: cd ? +cd[1] : null, cookie_length_raw: cookie || null,
      tags: cat ? [cat.toLowerCase()] : [],
      extra: { category: cat || undefined, last_verified: verified },
    };
  },
};
