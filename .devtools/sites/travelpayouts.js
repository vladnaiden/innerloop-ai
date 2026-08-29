// travelpayouts.com/brands-directory — Travelpayouts (travel affiliate network) public brands
// directory: one JSON document (the page's own `api.php?type=graph` call, using the page key
// embedded in its public bundle — not a user credential) listing every public brand with reward
// rate, cookie lifetime and other offer params, categories, caption, hot/exclusive flags, offer
// landing page. One record per brand.
const { text, decode, host } = require("./_common");
const KEY = "11eb6dd2f9dcf57686b;sd6f609d853f9c";
module.exports = {
  name: "travelpayouts", lang: "en", region: "global", base: "https://www.travelpayouts.com",
  async list() { return [{ url: `${this.base}/brands-directory/api/api.php?key=${KEY}&type=graph&locale=en`, slug: "graph-en" }]; },
  parse(html) {
    let j; try { j = JSON.parse(String(html)); } catch (e) { throw new Error("not json"); }
    const brands = (j.data && j.data.publicBrands) || [];
    if (!brands.length) throw new Error("no brands");
    return brands.map((b) => {
      const params = Object.fromEntries(((b.offerParamsSet && b.offerParamsSet.offerParams) || []).map((p) => [p.key, { label: p.label, value: p.value, description: p.description }]));
      const comm = text(b.affiliateCommission || (params.REVENUE_RULES && params.REVENUE_RULES.value) || "");
      const pct = [...comm.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)].map((m) => parseFloat(m[1].replace(",", ".")));
      const eur = comm.match(/€\s*(\d+(?:[.,]\d+)?)/), usd = comm.match(/\$\s*(\d+(?:[.,]\d+)?)/);
      const cookie = params.COOKIE_LIFETIME ? text(params.COOKIE_LIFETIME.value) : "";
      const cd = cookie.match(/(\d+)\s*day/i);
      const cats = (b.categories || []).map((c) => text(c.name)).filter(Boolean);
      const key = String(b.shortName || b.id).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const dom = b.shortName && /\.[a-z]{2,}$/i.test(b.shortName) && !/\s/.test(b.shortName) ? b.shortName.toLowerCase() : `travelpayouts.${key}`;
      return {
        key, program_name: text(b.shortName || ""), domain: dom, signup_url: b.landingUrl || `${this.base}/brands-directory/`, logo_url: b.logoUrl || null,
        description: text(decode((b.offerParamsSet && b.offerParamsSet.caption) || "")) || null, network: "Travelpayouts",
        commission: comm || null, commission_type: pct.length ? (eur || usd ? "Hybrid" : "CPS") : eur || usd ? "CPA" : null,
        pct_min: pct.length ? Math.min(...pct) : null, pct_max: pct.length ? Math.max(...pct) : null,
        flat_min: eur ? parseFloat(eur[1].replace(",", ".")) : usd ? parseFloat(usd[1].replace(",", ".")) : null, flat_max: eur ? parseFloat(eur[1].replace(",", ".")) : usd ? parseFloat(usd[1].replace(",", ".")) : null, currency: eur ? "EUR" : usd ? "USD" : null,
        cookie_days: cd ? +cd[1] : null, cookie_length_raw: cookie || null,
        tags: ["travel", ...cats.map((c) => c.toLowerCase())],
        extra: { brand_id: b.id, categories: cats, hot: b.offerParamsSet && b.offerParamsSet.hot || undefined, exclusive: b.offerParamsSet && b.offerParamsSet.exclusive || undefined, app_tracking: b.appTracking || undefined, offer_params: Object.keys(params).length ? params : undefined },
      };
    });
  },
};
