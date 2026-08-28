// cpa.house/webmaster/offer/detail/<id> — CPA.house, nutra CPA network (UA/EU/LATAM): ~8,000 public
// offer pages by numeric id with per-country rows (product price, payout in $, limits), CR,
// approval rate, description, rules, allowed traffic sources, logo. The listing is filter-driven
// JS, so ids 1..10200 are enumerated; a page without an offer throws with e.gone so the runner
// records it and never retries it.
const { text, decode, between } = require("./_common");
module.exports = {
  name: "cpa_house", lang: "en", region: "global", base: "https://cpa.house",
  async list() { return Array.from({ length: 10200 }, (_, i) => ({ url: `${this.base}/webmaster/offer/detail/${i + 1}`, slug: String(i + 1) })); },
  urlFor(slug) { return `${this.base}/webmaster/offer/detail/${slug}`; },
  parse(html, url) {
    const h = String(html);
    const name = text(decode((h.match(/headingBlock[\s\S]*?<h3>([\s\S]*?)<\/h3>/) || [])[1] || ""));
    if (!name) { const e = new Error("no offer on page"); e.gone = true; throw e; }
    const id = url.split("/").pop();
    const geo = (name.match(/\(([A-Z]{2})\)\s*$/) || [])[1];
    const ind = {}; for (const m of h.matchAll(/indicatorHeading">([^<]*)<\/div>\s*<div class="indicatorValue">([^<]*)</g)) ind[text(m[1])] = text(m[2]);
    const desc = text(decode((h.match(/Offer description<\/div>\s*<div class="text">([\s\S]*?)<\/div>/) || [])[1] || "").replace(/<[^>]+>/g, " "));
    const rules = text(decode((between(h, "Offer rules", "Traffic sources") || "").replace(/<\/(p|li|div)>|<br\s*\/?>/g, " · ").replace(/<[^>]+>/g, " "))).replace(/^[^·]*Offer rules\s*·?\s*/, "").replace(/(\s*·\s*){2,}/g, " · ").slice(0, 2500);
    const rows = [];
    for (const m of h.matchAll(/geoText">([^<]*)<\/span>[\s\S]*?sInfoVal">([^<]*)<\/span>[\s\S]*?sInfoVal">\s*([^<]*?)\s*<\/span>[\s\S]*?sInfoVal">([^<]*)<\/span>/g)) rows.push({ country: text(m[1]), price: text(m[2]), payout: text(m[3]), limits: text(m[4]) });
    const traffic = [...(between(h, "Traffic sources", "</div></div></div>") || "").matchAll(/checkedText">([^<]*)</g)].map((m) => text(m[1]));
    const logo = (h.match(/<img src="([^"]*offers_covers[^"]+)"/) || [])[1];
    const pays = rows.map((r) => parseFloat(r.payout.replace(/[^\d.]/g, ""))).filter((n) => !isNaN(n));
    const cur = rows[0] && /\$/.test(rows[0].payout) ? "USD" : rows[0] && /€/.test(rows[0].payout) ? "EUR" : null;
    const cr = (ind["CR"] || "").match(/([\d.]+)%/), ar = (ind["Approval Rate"] || "").match(/([\d.]+)%/);
    return {
      program_name: name, domain: `cpa-house.${id}`, signup_url: `${this.base}/registration`, logo_url: logo ? logo.replace(/^https:\/\/cpa\.house\/\.\//, "https://cpa.house/") : null,
      description: [desc, rules].filter(Boolean).join(" · Rules: ").slice(0, 4000) || null, network: "CPA.house",
      commission: rows.map((r) => `${r.country}: ${r.payout}`).join("; ") || null, commission_type: rows.length ? "CPA" : null,
      flat_min: pays.length ? Math.min(...pays) : null, flat_max: pays.length ? Math.max(...pays) : null, currency: pays.length ? cur : null,
      tags: ["nutra"].concat(geo ? [geo.toLowerCase()] : []),
      extra: { offer_id: id, geo, cr_pct: cr ? +cr[1] : undefined, approval_pct: ar ? +ar[1] : undefined, payout_rows: rows.length ? rows : undefined, traffic_sources: traffic.length ? traffic : undefined },
    };
  },
};
