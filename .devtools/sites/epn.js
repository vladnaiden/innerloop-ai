// epn.bz/ru/offers/<slug> — ePN's public programme pages: rate, approval %, conversion,
// payment term, cookie lifetime, legal entity, plus the long description tabs.
const { text, between, decode, host } = require("./_common");
module.exports = {
  name: "epn", lang: "ru", region: "CIS", base: "https://epn.bz",
  async list(af) {
    const r = await af.get(`${this.base}/sitemap.xml`, { tries: 2 });
    return [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/epn\.bz\/ru\/offers\/([a-z0-9_-]+)\/?)<\/loc>/g)].map((m) => ({ url: m[1], slug: m[2] }));
  },
  parse(html, url) {
    const h = String(html);
    const tiles = Object.fromEntries([...h.matchAll(/text-blueGray-500[^"]*">([^<]*)<\/p><p class="[^"]*">([^<]*)<\/p>/g)].map((m) => [text(m[1]), text(m[2])]));
    const name = text(between(h, "<h1", "</h1>").replace(/^<h1[^>]*>/, "")).replace(/^Партнерская программа\s+/, "").replace(/\s+—.*$/, "");
    const landing = (h.match(/href="(https?:\/\/(?!epn\.bz)[^"]+)"[^>]*>\s*https?:\/\//) || h.match(/>\s*(https?:\/\/(?!epn\.bz)[^<\s]+)\s*</) || [])[1] || null;
    const legal = (text(h).match(/(ООО|АО|ПАО|ИП)\s+"[^"]+"\s+ИНН\s*\d+/) || [])[0] || null;
    const rate = tiles["Ставка"] || "";
    const pr = rate.match(/([\d.,]+)\s*%/);
    const rub = rate.match(/([\d\s.,]+)\s*₽/);
    const cookie = tiles["Время жизни cookie"] || null;
    const desc = text(between(h, "Общая информация</", "Обратите внимание").replace(/^[^>]*>/, "")).slice(0, 3000);
    return {
      program_name: name || null, domain: landing ? host(landing) : `epn.${url.replace(/\/$/, "").split("/").pop()}`, landing_url: landing, signup_url: url,
      description: desc || null, network: "ePN", commission: rate || null, commission_type: /%/.test(rate) ? "CPS" : /₽/.test(rate) ? "CPA" : null,
      pct_min: pr ? parseFloat(pr[1].replace(",", ".")) : null, pct_max: pr ? parseFloat(pr[1].replace(",", ".")) : null,
      flat_min: rub ? parseFloat(rub[1].replace(/\s/g, "").replace(",", ".")) : null, flat_max: rub ? parseFloat(rub[1].replace(/\s/g, "").replace(",", ".")) : null, currency: rub ? "RUB" : null,
      cookie_length_raw: cookie, cookie_days: cookie ? parseInt(cookie, 10) || null : null,
      hold_days: (tiles["Срок оплаты"] || "").match(/(\d+)\s*дн/) ? +(tiles["Срок оплаты"].match(/(\d+)\s*дн/)[1]) : null,
      numbers: { approval: tiles["% подтверждения"] || null, conversion: tiles["Конверсия"] || null },
      extra: { tiles, legal_entity: legal || undefined },
    };
  },
};
