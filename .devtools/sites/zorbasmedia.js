// zorbasmedia.ru/programs/<slug>/ — ZorbasMedia (RU arbitrage media) network/programme reviews:
// ~300 profiles with founded year, verticals, description, network site, Telegram, chart card
// (offers count, payment models, GEO, payment systems, minimum payout, forbidden traffic),
// named managers with Telegram. Listing: WP REST post type `programs`.
const { text, decode, between, host } = require("./_common");
module.exports = {
  name: "zorbasmedia", lang: "ru", region: "RU", base: "https://zorbasmedia.ru",
  async list(af) {
    const out = new Map();
    for (let p = 1; p <= 20; p++) {
      let r; try { r = await af.get(`${this.base}/wp-json/wp/v2/programs?per_page=100&page=${p}&_fields=slug`, { tries: 1, maxChars: 900000 }); } catch (e) { break; }
      let a = []; try { a = JSON.parse(r.html || r.text || "[]"); } catch (e) { break; }
      if (!Array.isArray(a) || !a.length) break;
      for (const x of a) if (x.slug) out.set(x.slug, { url: `${this.base}/programs/${x.slug}/`, slug: x.slug });
      await af.pace(800);
    }
    return [...out.values()];
  },
  urlFor(slug) { return `${this.base}/programs/${slug}/`; },
  parse(html, url) {
    const h = String(html);
    const card = between(h, '<div class="teaser-info-block"', '<div class="cont') || between(h, '<div class="teaser-info-block"', "</section>") || "";
    const name = text(decode((card.match(/<div class="name">\s*([\s\S]*?)\s*<\/div>/) || [])[1] || ""));
    if (!name) throw new Error("no name");
    const founded = (card.match(/Дата основания:\s*<span[^>]*>(\d{4})</) || [])[1];
    const tags = [...card.matchAll(/programs-tag\/[^"]+"[^>]*>([^<]+)</g)].map((m) => text(m[1]));
    const desc = text(decode((card.match(/<div class="desc-company">([\s\S]*?)<\/div>/) || [])[1] || "").replace(/<[^>]+>/g, " "));
    const site = (card.match(/<div class="company-links">\s*<a target="_blank" href="([^"]+)"/) || [])[1] || null;
    const tg = (card.match(/href="(https:\/\/t\.me\/[^"]+)"/) || [])[1] || null;
    const kv = {}; for (const m of card.matchAll(/<div class="title">([^<]*)<\/div>\s*<div class="desc">([\s\S]*?)<\/div>/g)) kv[text(m[1])] = text(decode(m[2]).replace(/<[^>]+>/g, " "));
    const managers = [...card.matchAll(/<a class="item" target="_blank" href="([^"]+)">[\s\S]*?<div class="name">([^<]*)<\/div>/g)].map((m) => ({ name: text(m[2]), telegram: /t\.me/.test(m[1]) ? m[1] : undefined, url: /t\.me/.test(m[1]) ? undefined : m[1] }));
    const logo = (card.match(/data-lazy-src="([^"]+)"/) || card.match(/<noscript><img src="([^"]+)"/) || [])[1] || null;
    const models = (kv["Модели оплаты"] || "").split(/\s*,\s*|\s+и\s+/).map((s) => s.trim()).filter(Boolean);
    const minp = kv["Минимальная выплата"] || "", mn = minp.match(/(\d[\d\s]*)\s*(USD|\$|EUR|€|RUB|руб)/i);
    const cur = mn ? (/USD|\$/i.test(mn[2]) ? "USD" : /EUR|€/.test(mn[2]) ? "EUR" : "RUB") : null;
    const offers = (kv["Офферы"] || "").match(/(\d+)/);
    return {
      program_name: name, domain: site ? host(site) : `zorbasmedia.${url.split("/").filter(Boolean).pop()}`, landing_url: site, signup_url: site || url, logo_url: logo, telegram: tg,
      description: desc.slice(0, 4000) || null,
      commission_type: models.length > 1 ? "Hybrid" : /revshare/i.test(models[0] || "") ? "RevShare" : /cpl/i.test(models[0] || "") ? "CPL" : /cps/i.test(models[0] || "") ? "CPS" : /cpa/i.test(models[0] || "") ? "CPA" : null,
      commission_types: models.length ? models : null, recurring: models.some((m) => /revshare/i.test(m)) ? true : null,
      min_payout: mn ? parseInt(mn[1].replace(/\s/g, ""), 10) : null, min_payment_raw: minp || null, currency: cur,
      payment_methods: kv["Платёжные системы"] ? kv["Платёжные системы"].split(/\s*,\s*/) : null, offers_count: offers ? +offers[1] : null,
      established_year: founded ? +founded : null, managers: managers.length ? managers : null,
      tags: tags.map((t) => t.toLowerCase()),
      extra: { verticals: tags, geo: kv["ГЕО"], forbidden_traffic: kv["Запрещённый трафик"], offers_raw: kv["Офферы"], card: kv },
    };
  },
};
