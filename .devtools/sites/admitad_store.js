// admitad.ru/store/offers/<slug> — Admitad's public programme showcase (~680): EPC, CR,
// approval %, average processing time, regions, tools, categories, description, landing.
// Commission rates are shown only to logged-in users — deliberately not extracted.
const { text, between, decode, host } = require("./_common");
module.exports = {
  name: "admitad_store", lang: "ru", region: "CIS", base: "https://www.admitad.ru",
  async list(af) {
    const out = [];
    for (let i = 1; i <= 8; i++) {
      let r; try { r = await af.get(`${this.base}/offers-sitemap${i === 1 ? "" : i}.xml`, { tries: 2 }); } catch { break; }
      const locs = [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/www\.admitad\.ru\/store\/offers\/([a-z0-9-]+)\/)<\/loc>/g)];
      if (!locs.length) break;
      for (const m of locs) out.push({ url: m[1], slug: m[2] });
      await af.pace(2000);
    }
    return out;
  },
  parse(html, url) {
    const h = String(html);
    const name = text((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "").replace(/^Партнерская программа\s+/, "");
    const logoBlock = between(h, 'class="offer__description__logo"', "</div>");
    const landing = (logoBlock.match(/<a href="([^"]+)"/) || [])[1] || null;
    const logo = (logoBlock.match(/<img[^>]+src="([^"]+)"/) || [])[1] || null;
    const items = Object.fromEntries([...h.matchAll(/list__item__label">([^<]*)<\/span>\s*<span class="offer__description__list__item__value">([^<]*)<\/span>/g)].map((m) => [text(m[1]), text(m[2])]));
    const side = (kind) => { const i = h.indexOf(`offer__sidebar--item-${kind}"`); if (i < 0) return ""; const j = h.indexOf('offer__sidebar--item ', i + 40); return h.slice(i, j > 0 ? j : i + 6000); };
    const regions = [...side("regions").matchAll(/<a[^>]*>([^<]*)<\/a>/g)].map((m) => text(m[1])).filter((v) => v && !/Показать/.test(v));
    const tools = [...side("tools").matchAll(/<a[^>]*>([^<]*)<\/a>/g)].map((m) => text(m[1])).filter(Boolean);
    const cats = [...side("categories").matchAll(/<a[^>]*>(?:<strong>)?([^<]*?):?(?:<\/strong>)?<\/a>/g)].map((m) => text(m[1])).filter((v, i, a) => v && a.indexOf(v) === i && !/^(Начать сотрудничество|Подключиться|Показать все)$/.test(v));
    const desc = text(between(h, 'class="offer__content__details"', "</div>").replace(/^[^>]*>/, "").replace(/<\/(p|li|h\d)>|<br\s*\/?>/g, " · "));
    const proc = (items["Средн. обработка"] || "").match(/(\d+)/);
    return {
      program_name: name || null, domain: landing ? host(landing) : `admitad.${url.replace(/\/$/, "").split("/").pop()}`, landing_url: landing, signup_url: url, logo_url: logo,
      description: desc.slice(0, 3000) || null, network: "Admitad", geo: regions.join(", ") || null, countries: regions.includes("Россия") ? ["RU"] : null, categories: cats.length ? cats : null, vertical: cats[0] || null,
      hold_days: proc ? +proc[1] : null,
      numbers: Object.keys(items).length ? { epc: items["EPC"] || null, cr: items["CR"] || null, approval: items["Подтверждение"] || null, processing: items["Средн. обработка"] || null } : null,
      extra: { items, tools: tools.length ? tools : undefined, rates: "login-only on source" },
    };
  },
};
