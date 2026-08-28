// cpa.leadgid.ru/offers/<category>/<id> — Leadgid CPA (RU/CIS finance network): ~600 public
// offers with payout span + currency, CR / AR / EPC / EPL, verticals, product type, traffic
// type, payment frequency, target action, join link. Only the offer's own #metrics block is
// read — the "Похожие офферы" carousel below it belongs to other offers.
const { text, decode, between, num } = require("./_common");
module.exports = {
  name: "leadgid", lang: "ru", region: "RU", base: "https://cpa.leadgid.ru",
  async list(af) {
    const r = await af.get(`${this.base}/sitemap-offers.xml`, { tries: 2 });
    return [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/cpa\.leadgid\.ru\/offers\/([a-z0-9-]+)\/(\d+))<\/loc>/g)].map((m) => ({ url: m[1], slug: m[3], cat: m[2] }));
  },
  parse(html, url) {
    const h = String(html).replace(/<!--[^>]*?-->/g, "");
    const name = text(decode((h.match(/<h1 class="--h1 banner__title"[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || ""));
    if (!name) throw new Error("no name");
    const id = url.split("/").pop();
    const cat = text((h.match(/class="banner__category"[^>]*>([^<]*)</) || [])[1] || "");
    const logo = (h.match(/<picture class="banner__logo"[^>]*>\s*<img[^>]+src="([^"]+)"/) || [])[1] || null;
    const block = between(h, '<div id="metrics"', '<div id="similar"');
    const kv = {};
    for (const m of block.matchAll(/<li class="metrics__item"[^>]*><span[^>]*>([^<]*)<\/span><span[^>]*>([^<]*)<\/span>/g)) { const k = text(m[1]), v = text(decode(m[2])); if (k === "Выплата" && /раз|месяц|недел|ежедн/i.test(v)) kv["Периодичность выплат"] = v; else kv[k] = v; }
    const pay = kv["Выплата"] || "";
    const pm = pay.match(/от\s*([\d\s]+(?:[.,]\d+)?)\s*(?:([^\d\s]+)\s*)?(?:до\s*([\d\s]+(?:[.,]\d+)?)\s*([^\d\s]+))?/);
    const n = (s) => (s ? parseFloat(s.replace(/\s/g, "").replace(",", ".")) : null);
    const cur = pm ? (pm[4] || pm[2] || "").trim() : "";
    const curMap = { "₽": "RUB", "$": "USD", "€": "EUR", "₸": "KZT", sum: "UZS", "₴": "UAH", "zł": "PLN" };
    const pct = (s) => (s && /%/.test(s) ? n(s.replace("%", "")) : null);
    const type = /CPS/.test(name) && /CPL/.test(name) ? "Hybrid" : /CPL/.test(name) ? "CPL" : /CPS|CPA/.test(name) ? "CPA" : null;
    return {
      program_name: name, domain: `leadgid.${id}`, signup_url: `https://my.leadgid.com/offers/${id}/common`, logo_url: logo,
      network: "Leadgid", commission: pay || null, commission_type: type,
      flat_min: pm ? n(pm[1]) : null, flat_max: pm ? n(pm[3] || pm[1]) : null, currency: curMap[cur] || (cur || null),
      tags: [...new Set([cat, kv["Вертикаль"], kv["Тип продукта"]].filter(Boolean).map((s) => s.toLowerCase()))],
      extra: { offer_id: id, category: cat || undefined, cr_pct: pct(kv["CR"]), ar_pct: pct(kv["AR"]), epc: kv["EPC"], epl: kv["EPL"], geo: kv["Направление"], traffic_type: kv["Тип трафика"], product_type: kv["Тип продукта"], payment_frequency: kv["Периодичность выплат"], target_action: kv["Целевое действие"], stats: kv["Статистика"] },
    };
  },
};
