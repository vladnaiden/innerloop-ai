// cpainform.ru/programs/<cat>/<slug> — the largest RU offer monitor (~6,000 offer pages):
// each offer lists every CPA network that runs it with the network's CPAinform rating,
// target action, access level, GEO and payout (converted to RUB on the page).
const { text, between, decode, ldjson } = require("./_common");
module.exports = {
  name: "cpainform_offers", lang: "ru", region: "CIS", base: "https://cpainform.ru",
  async list(af) {
    const r = await af.get(`${this.base}/sitemap.xml`, { tries: 2 });
    return [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/cpainform\.ru\/programs\/([a-z0-9_-]+)\/([a-z0-9_-]+)\/)<\/loc>/g)].map((m) => ({ url: m[1], slug: `${m[2]}-${m[3]}` }));
  },
  parse(html, url) {
    const h = String(html);
    const name = text(between(h, "<h1", "</h1>").replace(/^<h1[^>]*>/, ""));
    const info = Object.fromEntries([...between(h, 'class="program-info"', "</table>").matchAll(/<th[^>]*>([^<]*)<\/th>\s*<td>([\s\S]*?)<\/td>/g)].map((m) => [text(m[1]).replace(/:$/, ""), text(m[2])]));
    const dates = [...between(h, 'class="program-info"', "</table>").matchAll(/<time datetime="([^"]+)"/g)].map((m) => m[1].slice(0, 10));
    const desc = text(between(h, "Описание:", "</tr>").replace(/^[^>]*>/, "")).replace(/^Описание:\s*/, "");
    // row by row, cell by cell — a single table-wide regex backtracked for 90 s on some pages
    const rows = between(h, 'id="sort-goals"', "</table>").split(/<tr>/).slice(1).map((tr) => {
      const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) => x[1]);
      if (tds.length < 6) return null;
      const net = tds[0].match(/\/networks\/([a-z0-9_-]+)\/">([^<]*)</);
      const pay = tds[5].match(/([\d.,]+)\s*<small[^>]*>([A-Z]{3})/);
      return { network: net ? text(net[2]) : text(tds[0]), network_slug: net ? net[1] : null, network_rating: parseInt(text(tds[1]), 10) || null,
        action: text(tds[2]), access: text(tds[3]), geo: text(tds[4]).split(/[\s,]+/).map((g) => g.trim()).filter((g) => /^[A-Z]{2}$/.test(g)),
        payout: pay ? parseFloat(pay[1].replace(",", ".")) : null, currency: pay ? pay[2] : null };
    }).filter(Boolean);
    const pay = rows.map((r) => r.payout).filter((n) => n != null && n > 0);
    const nets = rows.map((r) => r.network).filter((v, i, a) => v && a.indexOf(v) === i);
    const geos = rows.flatMap((r) => r.geo).filter((v, i, a) => /^[A-Z]{2}$/.test(v) && a.indexOf(v) === i);
    const cat = (info["Категория"] || "").replace(/\s*»\s*/g, " › ");
    return {
      program_name: name || null, domain: `cpainform-offer.${url.replace(/\/$/, "").split("/").slice(-2).join("-")}`, signup_url: url, landing_url: null,
      description: desc.slice(0, 3000) || null, vertical: cat.split(" › ")[0] || null, categories: cat ? cat.split(" › ") : null,
      network: nets.join(", ").slice(0, 200) || null, commission_type: "CPA",
      currency: (rows.find((r) => r.currency) || {}).currency || null, flat_min: pay.length ? Math.min(...pay) : null, flat_max: pay.length ? Math.max(...pay) : null,
      countries: geos.length ? geos : null, source_updated: dates[1] || dates[0] || null, offers_count: null,
      numbers: rows.length ? { goals: rows } : null,
      extra: { kind: "offer", added: dates[0], networks: nets, goals_count: rows.length, offers_total_on_site: (text(h).match(/Офферы\s+([\d\s]+)\s+Тизерки/) || [])[1]?.replace(/\s/g, "") },
    };
  },
};
