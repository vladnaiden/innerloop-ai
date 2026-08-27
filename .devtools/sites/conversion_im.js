// conversion.im/affiliate_networks/<slug> — Russian rating of CPA networks: description,
// verticals, payout block (frequency, hold, minimum, referral), payout methods, reviews.
const { text, between, decode } = require("./_common");
module.exports = {
  name: "conversion_im", lang: "ru", region: "CIS", base: "https://conversion.im",
  async list(af) {
    const r = await af.get(`${this.base}/sitemap.xml`, { tries: 2 });
    return [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/conversion\.im\/affiliate_networks\/([a-z0-9_-]+))<\/loc>/g)].map((m) => ({ url: m[1], slug: m[2] }));
  },
  parse(html, url) {
    const h = String(html);
    const name = text(between(h, "<h1", "</h1>").replace(/^<h1[^>]*>/, ""));
    const desc = text(between(h, 't-body"><p>', "</div>").replace(/^[^>]*>/, ""));
    const section = (title) => between(h, `<h3 class="t-h1">${title}</h3>`, "</h3>");
    const verticals = [...section("Вертикали").matchAll(/<div class="t-body">([^<]*)<\/div>/g)].map((m) => text(m[1]));
    const pay = Object.fromEntries([...section("Выплаты").matchAll(/shrink-0">([^<]*)<\/div>\s*<div[^>]*>([^<]*)<\/div>/g)].map((m) => [text(m[1]), text(m[2])]));
    const methods = [...section("Способы вывода средств").matchAll(/<img alt="([^"]+)"/g)].map((m) => decode(m[1]));
    const rating = (h.match(/star-rating__rating_hidden[^>]*>(\d)<span[^>]*>\.(?:<!-- -->)?(\d)/) || []);
    const rv = Object.fromEntries([...h.matchAll(/<span>(Отрицательные|Положительные|Нейтральные)<\/span><span[^>]*>(\d+)</g)].map((m) => [m[1], +m[2]]));
    const go = (h.match(/href="(\/go\/[A-Za-z0-9+/=]+)"/) || [])[1];
    let landing = null; if (go) { try { landing = Buffer.from(go.replace("/go/", ""), "base64").toString("utf8"); if (!/^https?:/.test(landing)) landing = null; } catch {} }
    const cnt = Object.values(rv).reduce((a, b) => a + b, 0);
    const hold = (pay["Наличие холда"] || "").match(/(\d+)/);
    return {
      program_name: name || null, domain: landing ? (new URL(landing).hostname.replace(/^www\./, "")) : `conversion.${url.split("/").pop()}`,
      signup_url: url, landing_url: landing ? landing.split("?")[0] : null, description: desc || null,
      vertical: verticals[0] || null, categories: verticals.length ? verticals : null,
      payment_frequency: pay["Периодичность выплат"] || null, hold_days: hold ? +hold[1] : null,
      min_payment_raw: pay["Минимальная выплата"] || null, referral_commission: pay["Реферальная система"] || null,
      payment_methods: methods.length ? methods : null,
      rating_avg: rating[1] != null && cnt ? +`${rating[1]}.${rating[2]}` : null, rating_count: cnt || null,
      extra: { reviews_by_tone: cnt ? rv : undefined, rating_scale: 5 },
    };
  },
};
