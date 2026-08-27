// cpad.pro (CPA Daily) — the CIS offer monitor since 2014. Network pages carry offer
// counts, payout methods, minimum/frequency, referral % and three community ratings.
const { text, between, decode, host } = require("./_common");
module.exports = {
  name: "cpad", lang: "ru", region: "CIS", base: "https://cpad.pro",
  async list(af) {
    const r = await af.get(`${this.base}/network`, { tries: 2 });
    const ids = [...(r.html || "").matchAll(/href="\/network\/(\d+)"/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i);
    return ids.map((id) => ({ url: `${this.base}/network/${id}`, slug: id }));
  },
  parse(html, url) {
    const h = String(html);
    const name = text(between(h, "<h1", "</h1>").replace(/^<h1[^>]*>/, "").replace(/<span[\s\S]*$/, ""));
    const item = (label) => between(between(h, `offer-item__title">${label}`, "</div> </div>"), "", "");
    const offersBlock = item("Офферов");
    const nums = (re) => { const m = h.match(re); if (!m) return null; const n = parseInt(m[1].replace(/[^\d]/g, ""), 10); return Number.isFinite(n) ? n : null; };
    const active = nums(/Активных:\s*([\d\s]+)</), archive = nums(/В архиве:\s*([\d\s]+)</), total = nums(/Итого:\s*([\d\s]+)</);
    const methods = [...between(h, 'offer-item__title">Вывод средств', "</div> </div>").matchAll(/<span class="info-point__tooltip"><span>([^<]*)</g)].map((m) => text(m[1]));
    const pay = text(between(h, 'offer-item__title">Платежи', "</div> </div>"));
    const minp = (pay.match(/Минимум:\s*([^|]+?)\s*(?:Периодичность|$)/) || [])[1] || null;
    const freq = (pay.match(/Периодичность:\s*(\S+)/) || [])[1] || null;
    const ref = (text(between(h, 'offer-item__title">Реферальный', "</div> </div>")).match(/([\d.,]+)\s*%/) || [])[1];
    const ratings = Object.fromEntries([...h.matchAll(/adnet-rating-crit__label">([^<]*)<\/span>\s*<button[^>]*><span class="_js_vote-val">(\d+)</g)].map((m) => [text(m[1]), +m[2]]));
    const signup = (h.match(/href="(\/out\/\d+)"[^>]*class="btn btn-accent"/) || [])[1];
    const bullets = [...between(h, "Также в", "Рейтинг сети").matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1])).filter((s) => s.length > 10 && s.length < 300);
    const medal = (h.match(/net-medal--(gold|silver|bronze)/) || [])[1] || null;
    const categories = [...between(h, "Распределение офферов по категориям", "</table>").matchAll(/<a[^>]+href="\/cat\/\d+"[^>]*>([^<]*)<\/a>/g)].map((m) => text(m[1])).filter((v, i, a) => v && a.indexOf(v) === i);
    const rv = Object.values(ratings);
    return {
      program_name: name || null, domain: `cpad.${url.split("/").pop()}`, signup_url: signup ? this.base + signup : null, landing_url: null,
      description: [text(between(h, "Регистрация в", 'class="b-shadow').replace(/^[^>]*>/, "").replace(/^[^<]*→\s*<\/a>/, "")).slice(0, 1500), bullets.join(" · ")].filter((x) => x && x.length > 20).join(" — ") || (h.match(/<meta name="description" content="([^"]*)"/) || [])[1] || null,
      offers_count: active ?? total, payment_methods: methods.length ? methods : null, min_payment_raw: minp ? text(minp) : null,
      payment_frequency: freq ? `${freq} в месяц` : null, referral_commission: ref ? `${ref}%` : null,
      rating_avg: rv.length ? Math.round(rv.reduce((a, b) => a + b, 0) / rv.length * 10) / 10 : null,
      categories: categories.length ? categories.slice(0, 30) : null, vertical: "CPA network",
      extra: { offers_active: active, offers_archive: archive, offers_total: total, ratings, medal, rating_scale: 100 },
    };
  },
};
