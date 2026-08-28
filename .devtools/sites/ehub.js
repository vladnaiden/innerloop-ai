// ehub.cz — Czech affiliate network's public campaign catalogue, one server-rendered
// table per market (CZ, SK, EN, DE, PL, HU, RO): brand, category, commission (PPS %),
// attribution window, market, logo, detail link.
const { text, decode, between } = require("./_common");
const MARKETS = { cz: "/katalog-kampani", sk: "/sk/campaign-catalog", en: "/en/campaign-catalog", de: "/de/katalog", pl: "/pl/katalog", hu: "/hu/katalogus", ro: "/ro/catalog" };
module.exports = {
  name: "ehub", lang: "cs", region: "CEE", base: "https://ehub.cz", maxChars: 4000000,
  async list() { return Object.entries(MARKETS).map(([cc, path]) => ({ url: `${this.base}${path}`, slug: cc })); },
  parse(html, url) {
    const h = String(html);
    const cc = url.split("/").filter(Boolean)[2] && /^[a-z]{2}$/.test(url.split("/").filter(Boolean)[2]) ? url.split("/").filter(Boolean)[2] : "cz";
    const seen = new Set();
    return [...h.matchAll(/<tr>\s*<td>\s*<a href="\/(?:[a-z]{2}\/)?([a-f0-9]{8})-([a-z0-9-]+)"[\s\S]*?<\/tr>/g)].map((m) => {
      const tr = m[0], id = m[1];
      if (seen.has(id)) return null; seen.add(id);
      const name = text((tr.match(/class="name"[^>]*>\s*([^<]*?)\s*<\/a>/) || [])[1] || "");
      const cat = text((tr.match(/class="category"[^>]*>\s*([^<]*?)\s*<\/a>/) || [])[1] || "");
      const cell = (label) => text((tr.match(new RegExp(`data-header="${label}"[\\s\\S]*?<div class="value">([\\s\\S]*?)<\\/div>`)) || [])[1] || "");
      const comm = cell("Provize|Provízia|Commission|Provision|Prowizja|Jutalék|Comision".split("|").find((l) => tr.includes(`data-header="${l}"`)) || "Provize");
      const attr = cell("Atribuční okno|Atribučné okno|Attribution window|Attributionsfenster|Okno atrybucji|Attribúciós ablak|Fereastra de atribuire".split("|").find((l) => tr.includes(`data-header="${l}"`)) || "Atribuční okno");
      const market = cell("Trh|Market|Markt|Rynek|Piac|Piață".split("|").find((l) => tr.includes(`data-header="${l}"`)) || "Trh");
      const logo = (tr.match(/<img src="([^"]+)"/) || [])[1] || null;
      const pcts = [...comm.matchAll(/([\d]+(?:[.,]\d+)?)\s*%/g)].map((x) => parseFloat(x[1].replace(",", ".")));
      const models = [...comm.matchAll(/\b(PPS|PPL|PPC|CPA|CPL|CPS)\b/g)].map((x) => x[1]).filter((v, i, a) => a.indexOf(v) === i);
      return {
        key: id, program_name: name || null, domain: /\.[a-z]{2,}$/i.test(name) && !/\s/.test(name) ? name.toLowerCase().replace(/^www\./, "") : `ehub.${id}`,
        signup_url: `${this.base}/${cc === "cz" ? "" : cc + "/"}${id}-${m[2]}`, landing_url: null, logo_url: logo, network: "eHUB", vertical: cat || null, categories: cat ? [cat] : null,
        commission: comm || null, commission_type: models.join(", ") || null, commission_types: models.length ? models : null,
        pct_min: pcts.length ? Math.min(...pcts) : null, pct_max: pcts.length ? Math.max(...pcts) : null,
        cookie_days: attr ? parseInt(attr, 10) || null : null, cookie_length_raw: attr || null,
        geo: market || null, country: cc.toUpperCase(),
        extra: { ehub_id: id, market_page: cc },
      };
    }).filter(Boolean);
  },
};
