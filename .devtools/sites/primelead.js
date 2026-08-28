// primelead.com.ua/offer/<id> — PrimeLEAD, Ukrainian CPA network: ~185 public offers with
// payout (% or UAH), EPC (UAH/RUB), CR, start date, post-click, hold, allowed traffic sources,
// category, description. The "Похожие оферы" block belongs to other offers and is not read.
const { text, decode, between } = require("./_common");
module.exports = {
  name: "primelead", lang: "ru", region: "UA", base: "https://primelead.com.ua",
  // The catalogue pager is session-bound (the same ids come back for most `page=` values through
  // rotating exits), while offer ids are small and dense — so enumerate ids directly; 404s are
  // recorded as gone by the runner and never re-fetched.
  async list() {
    return Array.from({ length: 320 }, (_, i) => ({ url: `${this.base}/offer/${i + 1}`, slug: String(i + 1) }));
  },
  urlFor(slug) { return `${this.base}/offer/${slug}`; },
  parse(html, url) {
    const h = String(html);
    const box = between(h, '<div class="offer">', '<div class="block-2">') || "";
    const name = text(decode((box.match(/<div class="name">([\s\S]*?)<\/div>/) || [])[1] || ""));
    if (!name) throw new Error("no name");
    const cat = text(decode((box.match(/<div class="cat">([\s\S]*?)<\/div>/) || [])[1] || ""));
    const terms = text(decode((box.match(/<div class="terms">([\s\S]*?)<\/div>/) || [])[1] || ""));
    const kv = {};
    for (const m of box.matchAll(/<th>([^<]*)<\/th>\s*<td>([\s\S]*?)<\/td>/g)) kv[text(m[1]).replace(/:$/, "")] = text(decode(m[2]).replace(/<[^>]+>/g, " "));
    const traffic = [...(between(box, "Разрешенный трафик", '<div class="b4">') || "").matchAll(/<div class="r">([\s\S]*?)<\/div>/g)].map((m) => text(m[1]));
    const logo = (box.match(/<div class="logo"><img src="([^"]+)"/) || [])[1];
    const descHtml = between(h, '<div class="block-2">', "Похожие") || "";
    const desc = text(decode(descHtml.replace(/<div class="h">\s*Описание\s*<\/div>/, "").replace(/<\/(p|li|div)>|<br\s*\/?>/g, " · ").replace(/<[^>]+>/g, " "))).replace(/(\s*·\s*){2,}/g, " · ").replace(/^(\s*·\s*)+|(\s*·\s*)+$/g, "");
    const pay = kv["Выплата"] || "";
    const pct = pay.match(/([\d.,]+)\s*(?:-\s*([\d.,]+))?\s*%/);
    const uah = pay.match(/([\d\s.,]+)\s*грн/);
    const n = (s) => parseFloat(String(s).replace(/\s/g, "").replace(",", "."));
    const days = (s) => { const m = (s || "").match(/(\d+)/); return m ? +m[1] : null; };
    const start = (kv["Дата старта"] || "").match(/(\d{2})\.(\d{2})\.(\d{4})/);
    return {
      program_name: name, domain: `primelead.${url.split("/").pop()}`, signup_url: `${this.base}/master/sign-up`, logo_url: logo ? `${this.base}${logo}` : null,
      description: [terms, desc].filter(Boolean).join(" · ").slice(0, 4000) || null, network: "PrimeLEAD",
      commission: pay || null, commission_type: pct ? "CPS" : uah ? "CPA" : null,
      pct_min: pct ? n(pct[1]) : null, pct_max: pct ? n(pct[2] || pct[1]) : null,
      flat_min: uah ? n(uah[1]) : null, flat_max: uah ? n(uah[1]) : null, currency: uah ? "UAH" : null,
      cookie_days: days(kv["Постклик"]), cookie_length_raw: kv["Постклик"] || null,
      tags: cat ? cat.split(/\s*,\s*/).map((s) => s.toLowerCase()) : [],
      extra: { offer_id: url.split("/").pop(), category: cat || undefined, action: terms || undefined, epc: kv["EPC"], cr_pct: kv["CR"] ? n(kv["CR"]) : undefined, hold_days: days(kv["Холд конверсий"]), start_date: start ? `${start[3]}-${start[2]}-${start[1]}` : undefined, allowed_traffic: traffic.length ? traffic : undefined },
    };
  },
};
