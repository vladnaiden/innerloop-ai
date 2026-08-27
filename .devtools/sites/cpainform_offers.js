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
    const rows = [...between(h, 'id="sort-goals"', "</table>").matchAll(/<tr>\s*<td>\s*<a href="[^"]*\/networks\/([a-z0-9_-]+)\/">([^<]*)<\/a>\s*<\/td>\s*<td[^>]*>\s*([^<]*?)\s*<\/td>\s*<td>\s*([\s\S]*?)\s*<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td class="text-right[^"]*">\s*([\d.,]+)\s*<small[^>]*>([A-Z]{3})<\/small>/g)]
      .map((m) => ({ network: text(m[2]), network_slug: m[1], network_rating: parseInt(m[3], 10) || null, action: text(m[4]), access: text(m[5]), geo: text(m[6]).split(/[\s,]+/).map((g) => g.trim()).filter((g) => /^[A-Z]{2}$/.test(g)), payout: parseFloat(m[7].replace(",", ".")), currency: m[8] }));
    const pay = rows.map((r) => r.payout).filter((n) => n > 0);
    const nets = rows.map((r) => r.network).filter((v, i, a) => v && a.indexOf(v) === i);
    const geos = rows.flatMap((r) => r.geo).filter((v, i, a) => /^[A-Z]{2}$/.test(v) && a.indexOf(v) === i);
    const cat = (info["Категория"] || "").replace(/\s*»\s*/g, " › ");
    return {
      program_name: name || null, domain: `cpainform-offer.${url.replace(/\/$/, "").split("/").slice(-2).join("-")}`, signup_url: url, landing_url: null,
      description: desc.slice(0, 3000) || null, vertical: cat.split(" › ")[0] || null, categories: cat ? cat.split(" › ") : null,
      network: nets.join(", ").slice(0, 200) || null, commission_type: "CPA",
      currency: rows[0] ? rows[0].currency : null, flat_min: pay.length ? Math.min(...pay) : null, flat_max: pay.length ? Math.max(...pay) : null,
      countries: geos.length ? geos : null, source_updated: dates[1] || dates[0] || null, offers_count: null,
      numbers: rows.length ? { goals: rows } : null,
      extra: { kind: "offer", added: dates[0], networks: nets, goals_count: rows.length, offers_total_on_site: (text(h).match(/Офферы\s+([\d\s]+)\s+Тизерки/) || [])[1]?.replace(/\s/g, "") },
    };
  },
};
