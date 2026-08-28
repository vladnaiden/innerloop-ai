// saleads.pro/offers/partnerskaya-programma/<slug> — Saleads.pro, RU CPA network (finance, HR,
// courses, surveys, insurance…): ~510 public offers with payout per action (RUB, sometimes a span),
// target action, category, description, logo; EPC / approval shown as "coming soon" (not stored).
// Listing: /offers?sort=created_at&page=N (38 pages).
const { text, decode, between } = require("./_common");
module.exports = {
  name: "saleads", lang: "ru", region: "RU", base: "https://saleads.pro",
  async list(af) {
    const out = new Map(); let last = 1;
    for (let p = 1; p <= Math.min(last, 80); p++) {
      const r = await af.get(`${this.base}/offers?sort=created_at&page=${p}`, { tries: 2 });
      const h = r.html || r.text || "";
      for (const m of h.matchAll(/href="https:\/\/saleads\.pro\/offers\/partnerskaya-programma\/([a-z0-9_-]+)"/g)) out.set(m[1], { url: `${this.base}/offers/partnerskaya-programma/${m[1]}`, slug: m[1] });
      for (const m of h.matchAll(/page=(\d+)/g)) last = Math.max(last, +m[1]);
      await af.pace(1200);
    }
    return [...out.values()];
  },
  urlFor(slug) { return `${this.base}/offers/partnerskaya-programma/${slug}`; },
  parse(html, url) {
    const h = String(html);
    const name = text(decode((h.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1] || "")).replace(/^Партнерская программа\s+/i, "");
    if (!name) throw new Error("no name");
    const cat = text(decode((h.match(/class="about__tags">\s*<a[^>]*>([^<]*)<\/a>/) || [])[1] || ""));
    const desc = text(decode((h.match(/<p class="about__content-text[^"]*">([\s\S]*?)<\/p>/) || [])[1] || "").replace(/<[^>]+>/g, " "));
    const logo = (h.match(/<img src="(\/storage\/logos\/[^"]+)"/) || [])[1];
    const payouts = [...h.matchAll(/<div class="about-item-offer">\s*<div class="about-item__top">[\s\S]*?<\/span>\s*([^<]*?)\s*<\/div>\s*([^<]*?)\s*<\/div>/g)]
      .map((m) => ({ amount: text(m[1]), action: text(decode(m[2])) })).filter((p) => p.amount && !/Скоро/.test(p.amount) && /[\d]/.test(p.amount));
    const nums = payouts.flatMap((p) => [...p.amount.matchAll(/([\d\s]+(?:[.,]\d+)?)/g)].map((x) => parseFloat(x[1].replace(/\s/g, "").replace(",", ".")))).filter((n) => !isNaN(n));
    const cur = (payouts[0]?.amount.match(/\b(RUB|USD|EUR|KZT|UAH)\b/) || [])[1] || (nums.length ? "RUB" : null);
    const pct = payouts.some((p) => /%/.test(p.amount));
    return {
      program_name: name, domain: `saleads.${url.split("/").pop()}`, signup_url: `${this.base}/register`, logo_url: logo ? `${this.base}${logo}` : null,
      description: desc.slice(0, 4000) || null, network: "Saleads.pro",
      commission: payouts.map((p) => `${p.amount}: ${p.action}`).join("; ") || null,
      commission_type: pct ? "CPS" : /регистрац|заявк|анкет/i.test(payouts[0]?.action || "") ? "CPL" : payouts.length ? "CPA" : null,
      flat_min: !pct && nums.length ? Math.min(...nums) : null, flat_max: !pct && nums.length ? Math.max(...nums) : null, currency: !pct && nums.length ? cur : null,
      tags: cat ? [cat.toLowerCase()] : [],
      extra: { category: cat || undefined, payouts: payouts.length ? payouts : undefined },
    };
  },
};
