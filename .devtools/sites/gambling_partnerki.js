// gambling-partnerki.com/affiliates/<slug>/ — RU rating of gambling affiliate programmes: ~25
// reviews with rating /5, launch year, income models, minimum payout, offers, GEO, software,
// reporting period, payout speed, payment systems, sub-affiliate commission, tools.
const { text, decode, between } = require("./_common");
module.exports = {
  name: "gambling_partnerki", lang: "ru", region: "RU", base: "https://gambling-partnerki.com",
  async list(af) {
    const r = await af.get(`${this.base}/`, { tries: 2 });
    return [...new Set([...(r.html || r.text || "").matchAll(/href="\/affiliates\/([a-z0-9-]+)\/"/g)].map((m) => m[1]))].map((s) => ({ url: `${this.base}/affiliates/${s}/`, slug: s }));
  },
  urlFor(slug) { return `${this.base}/affiliates/${slug}/`; },
  parse(html, url) {
    const h = String(html);
    const name = text(decode((h.match(/<span class="partner-card-name">([^<]*)</) || [])[1] || ""));
    if (!name) throw new Error("no name");
    const rating = parseFloat((h.match(/<span class="score">([\d.]+)</) || [])[1]);
    const meta = {}; for (const m of h.matchAll(/<span class="meta-label">([^<]*)<\/span>\s*([^<]*)/g)) meta[text(m[1]).replace(/:$/, "")] = text(m[2]);
    const kv = {}; for (const m of h.matchAll(/<span class="review-info-label">([^<]*)<\/span>\s*<span class="review-info-value">([\s\S]*?)<\/span>/g)) kv[text(m[1])] = text(decode(m[2]).replace(/<[^>]+>/g, " "));
    const desc = text(decode((between(h, "<h2", "<h2") || "").replace(/<\/(p|li)>/g, " · ").replace(/<[^>]+>/g, " "))).replace(/^[^·]*?·\s*/, "").slice(0, 3000);
    const models = (meta["Варианты дохода"] || "").split(/\s*,\s*/).filter(Boolean);
    const minp = meta["Мин. выплата"] || "", mn = minp.match(/(\$|€)\s*(\d+)/);
    const year = (meta["Дата выхода"] || "").match(/(\d{4})/);
    return {
      program_name: name, domain: `gambling-partnerki.${url.split("/").filter(Boolean).pop()}`, signup_url: url,
      description: desc || null, rating_avg: isNaN(rating) ? null : rating,
      commission_type: models.length > 1 ? "Hybrid" : /revshare/i.test(models[0] || "") ? "RevShare" : /cpa/i.test(models[0] || "") ? "CPA" : null, commission_types: models.length ? models : null, recurring: models.some((m) => /revshare/i.test(m)) ? true : null,
      min_payout: mn ? +mn[2] : null, min_payment_raw: minp || null, currency: mn ? { "$": "USD", "€": "EUR" }[mn[1]] : null,
      payment_methods: kv["Платежки"] ? kv["Платежки"].split(/\s*,\s*/) : null, payment_frequency: kv["Отчетный период"] || null, tracking_software: kv["Софт партнерки"] || null,
      established_year: year ? +year[1] : null, tags: ["igaming"],
      extra: { offers: kv["Офферы"], geo: kv["ГЕО"], payout_speed: kv["Скорость выплат"], sub_affiliate: kv["Суб-афф комиссия"], tools: kv["Маркетинг-инструменты"], props: kv },
    };
  },
};
