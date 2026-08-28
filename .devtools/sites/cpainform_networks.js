// cpainform.ru/networks/<slug> — ~225 CPA networks: site, opened, offers count, CPAinform
// rating /100, payout methods (icon titles), payout terms, minimum, engine, features,
// offer distribution by vertical, description.
const { text, between, decode, host } = require("./_common");
module.exports = {
  name: "cpainform_networks", lang: "ru", region: "CIS", base: "https://cpainform.ru",
  async list(af) {
    const r = await af.get(`${this.base}/sitemap.xml`, { tries: 2 });
    return [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/cpainform\.ru\/networks\/([a-z0-9_-]+)\/)<\/loc>/g)].map((m) => ({ url: m[1], slug: m[2] }));
  },
  parse(html, url) {
    const h = String(html);
    const name = text(between(h, "<h1", "</h1>").replace(/^<h1[^>]*>/, "")).replace(/^СРА сеть\s+/i, "").replace(/^CPA сеть\s+/i, "");
    const stat = between(h, 'class="networksStat"', 'Диаграмма офферов');
    const kv = Object.fromEntries([...stat.matchAll(/<tr>\s*<td>([^<]*)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => [text(m[1]), m[2]]));
    const v = (k) => kv[k] != null ? text(kv[k]) : null;
    const site = (kv["Адрес сайта"] || "").match(/url=([^"&]+)/);
    const landing = site ? decodeURIComponent(site[1]).split("?")[0] : null;
    const methods = [...(kv["Выплаты через"] || "").matchAll(/title="([^"]+)"/g)].map((m) => decode(m[1]));
    const offers = parseInt((v("Количество офферов") || "").replace(/\D/g, ""), 10) || null;
    const rating = parseInt((kv["Рейтинг CPAinform"] || "").match(/<strong>\s*(\d+)/)?.[1] || "", 10) || null;
    const year = (v("Дата открытия") || "").match(/(\d{4})/);
    const dist = [...between(h, "Диаграмма офферов", "Описание CPA").matchAll(/title="([^"]+?)\s*–\s*([\d.,]+)%"[^>]*>\s*<span>[^<]*<\/span>\s*<span>\s*(\d+)\s*шт/g)].map((m) => ({ vertical: decode(m[1]), share_pct: parseFloat(m[2].replace(",", ".")), offers: +m[3] }));
    const desc = text(between(h, "Описание CPA сети", "</div>").replace(/^[^>]*>/, "").replace(/^[^<]*<\/h2>/, ""));
    const features = [...(kv["Возможности"] || "").matchAll(/title="([^"]+)"|>([^<]{3,40})</g)].map((m) => decode(m[1] || m[2]).trim()).filter(Boolean);
    return {
      program_name: name || null, domain: landing ? host(landing) : `cpainform.${url.replace(/\/$/, "").split("/").pop()}`, landing_url: landing, signup_url: url,
      description: desc.slice(0, 3000) || null, offers_count: offers, established_year: year ? +year[1] : null,
      rating_avg: rating, payment_methods: methods.length ? methods : null, payment_frequency: v("Выплаты"), min_payment_raw: v("Минималка"),
      tracking_software: v("Движок сети"), vertical: dist[0] ? dist[0].vertical : null, categories: dist.length ? dist.map((d) => d.vertical) : null,
      extra: { rating_scale: 100, features: features.length ? features : undefined, offer_distribution: dist.length ? dist : undefined, opened: v("Дата открытия") },
    };
  },
};
