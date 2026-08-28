// afftrends.com/partner/<slug> — Russian editorial reviews of ~100 networks: editorial
// rating /5, review count, short description, info rows (CPA, RevShare, verticals,
// GEO, minimum payout, founded), the network's site, logo.
const { text, between, decode, host, ldjson } = require("./_common");
module.exports = {
  name: "afftrends", lang: "ru", region: "CIS", base: "https://afftrends.com",
  async list(af) {
    const root = await af.get(`${this.base}/vertical/tovarka/`, { tries: 2 });
    const verts = [...(root.html || "").matchAll(/href="(?:https:\/\/afftrends\.com)?\/vertical\/([a-z0-9-]+)\/"/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i);
    const out = new Map();
    const add = (html) => { for (const m of String(html || "").matchAll(/href="(?:https:\/\/afftrends\.com)?\/partner\/([a-z0-9-]+)\/"/g)) out.set(m[1], { url: `${this.base}/partner/${m[1]}/`, slug: m[1] }); };
    add(root.html);
    for (const v of verts) { await af.pace(2000); try { add((await af.get(`${this.base}/vertical/${v}/`, { tries: 2 })).html); } catch {} }
    return [...out.values()];
  },
  parse(html, url) {
    const h = String(html);
    const card = between(h, 'class="strict-review-card"', 'class="review-footer"');
    const name = text(between(h, "<h1", "</h1>").replace(/^<h1[^>]*>/, ""));
    const score = (card.match(/stars-score">\s*([\d.,]+)\s*\/\s*5/) || [])[1];
    const cnt = (card.match(/Отзывов пользователей:\s*<strong>(\d+)/) || [])[1];
    const desc = text(between(card, 'class="review-description">', "</div>").replace(/^[^>]*>/, ""));
    const rows = Object.fromEntries([...card.replace(/<span class="tooltip"[\s\S]*?<\/span>\s*<\/span>/g, "").matchAll(/<strong>([^<]*?):<\/strong>\s*([^<]*)/g)].map((m) => [text(m[1]), text(m[2])]));
    const site = (between(h, 'class="review-footer"', "</div>").match(/href="([^"]+)"/) || [])[1];
    const landing = site ? site.split("?")[0] : null;
    const logo = (card.match(/class="review-logo">\s*<img[^>]+src="([^"]+)"/) || [])[1] || null;
    const graph = ldjson(h).flatMap((j) => j["@graph"] || [j]); const page = graph.find((g) => g["@type"] === "WebPage") || {};
    const cpa = rows["CPA"] || "", usd = cpa.match(/\$\s*([\d.,]+)/);
    const year = (rows["Год основания"] || "").match(/(\d{4})/);
    return {
      program_name: name || null, domain: landing ? host(landing) : `afftrends.${url.replace(/\/$/, "").split("/").pop()}`, landing_url: landing, signup_url: url, logo_url: logo,
      description: desc || null, rating_avg: score ? parseFloat(score.replace(",", ".")) : null, rating_count: cnt ? +cnt : null,
      commission: [rows["CPA"] && `CPA: ${rows["CPA"]}`, rows["RevShare"] && `RevShare: ${rows["RevShare"]}`].filter(Boolean).join("; ") || null,
      commission_type: [rows["CPA"] && "CPA", rows["RevShare"] && "RevShare"].filter(Boolean).join(", ") || null,
      flat_max: usd ? parseFloat(usd[1].replace(",", ".")) : null, currency: usd ? "USD" : null,
      vertical: (rows["Вертикали"] || "").split(/\s*,\s*/)[0] || null, categories: rows["Вертикали"] ? rows["Вертикали"].split(/\s*,\s*/) : null,
      geo: rows["ГЕО"] || null, min_payment_raw: rows["Минимальная сумма к выводу"] || null, established_year: year ? +year[1] : null,
      source_updated: (page.dateModified || "").slice(0, 10) || null,
      extra: { rows, rating_scale: 5, editorial: true },
    };
  },
};
