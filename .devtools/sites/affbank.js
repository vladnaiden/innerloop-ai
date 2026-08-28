// affbank.com — offer aggregator (~37k offers from hundreds of networks). The global
// listing stops at page 5, but per-network listings paginate fully, and each row already
// carries id, name, network, country, category and payout — so rows come from listings
// (one record per row) and the network index seeds the walk.
const { text, decode } = require("./_common");
module.exports = {
  name: "affbank", lang: "en", region: "global", base: "https://affbank.com",
  async list(af) {
    const nets = new Set();
    for (let p = 1; p <= 60; p++) {
      let r; try { r = await af.get(`${this.base}/cpa-networks?page=${p}`, { tries: 2 }); } catch { break; }
      const found = [...(r.html || "").matchAll(/href="\/cpa-networks\/([a-z0-9-]+)"/g)].map((m) => m[1]);
      const before = nets.size; for (const n of found) nets.add(n);
      if (!found.length || nets.size === before) break;
      await af.pace(2000);
    }
    return [...nets].map((n) => ({ url: `${this.base}/offers/${n}?page=1`, slug: `${n}-p1` }));
  },
  next(html, url) {
    const m = url.match(/\/offers\/([a-z0-9-]+)\?page=(\d+)$/); if (!m) return null;
    const rows = (String(html).match(/<tr data-key="\d+">/g) || []).length;
    if (rows < 30) return null;
    const p = +m[2] + 1; return { url: `${this.base}/offers/${m[1]}?page=${p}`, slug: `${m[1]}-p${p}` };
  },
  parse(html, url) {
    const h = String(html);
    const net = (url.match(/\/offers\/([a-z0-9-]+)\?/) || [])[1];
    return [...h.matchAll(/<tr data-key="(\d+)">([\s\S]*?)<\/tr>/g)].map((m) => {
      const id = m[1], tr = m[2];
      const a = tr.match(/<a href="\/offer\/(\d+-[^"]+)" title="([^"]*)"/);
      const network = text((tr.match(/td-network"><a href="\/cpa-networks\/[^"]+">([^<]*)</) || [])[1] || "");
      const country = text((tr.match(/td-country"><span class="table__country">([^<]*)</) || [])[1] || "");
      const cat = text((tr.match(/<a href="\/offers\/([a-z0-9-]+)">([^<]*)<\/a>/) || [])[2] || "");
      const pay = text((tr.match(/td-payouts">([^<]*)</) || [])[1] || "");
      const money = pay.match(/([$€£])\s*([\d.,]+)/), pct = pay.match(/([\d.,]+)\s*%/);
      const cur = money ? { "$": "USD", "€": "EUR", "£": "GBP" }[money[1]] : null;
      const geos = country.split(/[\s,]+/).map((g) => g.trim()).filter((g) => /^[A-Z]{2}$/.test(g));
      const title = decode(a ? a[2] : "");
      const model = (title.match(/\b(CPA|CPL|CPS|CPI|CPE|CPC|COD|RevShare|SOI|DOI|PPS)\b/) || [])[1] || null;
      return {
        key: id, program_name: title || null, domain: `affbank-offer.${id}`, signup_url: a ? `${this.base}/offer/${a[1]}` : url, landing_url: null,
        network: network || null, vertical: cat || null, categories: cat ? [cat] : null,
        commission: pay || null, commission_type: model, currency: cur,
        flat_min: money ? parseFloat(money[2].replace(",", "")) : null, flat_max: money ? parseFloat(money[2].replace(",", "")) : null,
        pct_min: pct ? parseFloat(pct[1]) : null, pct_max: pct ? parseFloat(pct[1]) : null,
        countries: geos.length ? geos : null, geo: country || null,
        extra: { kind: "offer", affbank_id: id, network_slug: net, listing_page: url },
      };
    }).filter((r) => r.program_name);
  },
};
