// partnerkin.com — the largest Russian-language catalogue of affiliate networks and
// programmes. Category listings (/c/<id>?page=N) give the detail URLs; a detail page
// (/c/<cat>/<slug>) has the "Параметры" list, criteria ratings, reviews and the rep.
const { text, between, decode, host } = require("./_common");
module.exports = {
  name: "partnerkin", lang: "ru", region: "CIS", base: "https://partnerkin.com",
  async list(af) {
    // two roots: the network rating (/c/7) and the programme catalogue (/site/partners) — together they list every /c/<id> category
    const cats = [];
    for (const root of ["/c/7", "/site/partners"]) {
      try { const r = await af.get(`${this.base}${root}`, { tries: 2 }); for (const m of (r.html || "").matchAll(/href="\/c\/(\d+)"/g)) if (!cats.includes(m[1])) cats.push(m[1]); } catch {}
      await af.pace(2000);
    }
    const out = new Map();
    for (const cat of cats) {
      for (let p = 1; p <= 40; p++) {
        let r; try { r = await af.get(`${this.base}/c/${cat}${p > 1 ? `?page=${p}` : ""}`, { tries: 2 }); } catch { break; }
        const links = [...(r.html || "").matchAll(/class="table_cat_partner_name"[^>]*href="\/c\/(\d+)\/([a-z0-9_-]+)"/g)];
        if (!links.length) break;
        let fresh = 0;
        for (const m of links) if (!out.has(m[2])) { out.set(m[2], { url: `${this.base}/c/${m[1]}/${m[2]}`, slug: m[2] }); fresh++; }
        await af.pace(2500);
        if (!/href="\/c\/\d+\?page=\d+"/.test(r.html || "") || (p > 1 && !fresh)) break;
      }
    }
    return [...out.values()];
  },
  parse(html, url) {
    const h = String(html);
    const name = text(between(h, "<h1", "</h1>").replace(/^<h1[^>]*>/, "")).replace(/\s+отзывы$/i, "");
    const params = Object.fromEntries([...h.matchAll(/<li class="item_param">\s*<div class="item_name">\s*<span[^>]*>([^<]*)<\/span>\s*<\/div>\s*<div class="item_value">([\s\S]*?)<\/div>/g)].map((m) => [text(m[1]), text(m[2])]));
    const info = text(between(h, "Общая информация", "Параметры"));
    const year = (info.match(/Год открытия:\s*(\d{4})/) || [])[1];
    const site = (h.match(/Официальный сайт:\s*(?:<[^>]+>\s*)*([^<\s]+)/) || [])[1];
    const desc = text(between(between(h, "Общая информация", "Параметры"), "</p>", '<div class="hidden-sm'));
    const reviews = (h.match(/(\d+)\s+отзыв[а-я]*\s+/) || [])[1];
    const rating = (h.match(/<div class="rating"\s*>\s*(\d{1,2}(?:\.\d)?)\s*</) || [])[1];
    const crit = Object.fromEntries([...h.matchAll(/rating_cat">([^<]*)<\/div>\s*<div class="[^"]*rating_val">\s*([\d.]+)\s*</g)].map((m) => [text(m[1]), +m[2]]));
    const awards = [...h.matchAll(/class="award [^"]*"[^>]*data-content="([^"]*)"/g)].map((m) => decode(m[1]).replace(/&nbsp;/g, " "));
    const rep = text(between(h, "Представитель партнерки", "Последний раз")).replace(/^Представитель партнерки\s*/, "");
    const signup = (h.match(/href="(\/c\/p\/[a-z0-9_-]+\/referal[^"]*)"/) || [])[1];
    const logo = (h.match(/<meta property="og:image" content="([^"]+)"/) || [])[1];
    const cat = (url.match(/\/c\/(\d+)\//) || [])[1];
    const methods = params["Способы выплат"] ? params["Способы выплат"].split(/\s*,\s*/) : null;
    const ref = params["Реферальная программа"];
    return {
      program_name: name || null, domain: site ? (host(/^https?:/.test(site) ? site : `https://${site}`) || site.toLowerCase()) : `partnerkin.${url.split("/").pop()}`,
      landing_url: site ? (/^https?:/.test(site) ? site : `https://${site}`) : null, signup_url: signup ? this.base + signup : null,
      logo_url: logo ? (logo.startsWith("http") ? logo : this.base + logo) : null,
      description: desc.slice(0, 3000) || null, established_year: year ? +year : null,
      geo: params["Доступные ГЕО"] || null, min_payment_raw: params["Минимальная выплата"] || null,
      payment_methods: methods, referral_commission: ref && /\d/.test(ref) ? ref : null,
      rating_avg: rating ? +rating : null, rating_count: reviews ? +reviews : null,
      extra: { params, criteria: Object.keys(crit).length ? crit : undefined, representative: rep || undefined, awards: awards.length ? awards : undefined, category_id: cat, rating_scale: 10 },
    };
  },
};
