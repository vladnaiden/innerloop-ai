// leads.su — Russian financial CPA network's public offer catalogue (~720 offers):
// payouts per action, EPC/EPL/CR/AR indicators, hold, offer description.
const { text, between, decode, ldjson } = require("./_common");
module.exports = {
  name: "leads_su", lang: "ru", region: "CIS", base: "https://leads.su",
  async list(af) {
    const r = await af.get(`${this.base}/sitemap.xml`, { tries: 2 });
    return [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/leads\.su\/offers\/(\d+))<\/loc>/g)].map((m) => ({ url: m[1], slug: m[2] }));
  },
  parse(html, url) {
    const h = String(html);
    const ind = Object.fromEntries([...h.matchAll(/indicator__name">\s*([^<]*?)\s*<\/span>\s*<span class="indicator__value">\s*([^<]*?)\s*</g)].map((m) => [text(m[1]), text(m[2])]));
    const conds = [...h.matchAll(/offer-hero__condition-name">\s*([\s\S]*?)<\/span>\s*<span class="offer-hero__condition-value">\s*([\s\S]*?)<\/span>/g)].map((m) => ({ action: text(m[1]), payout: text(m[2]) }));
    const h1 = text(between(h, "<h1", "</h1>").replace(/^<h1[^>]*>/, "")).replace(/^Оффер\s+/, "");
    const name = h1 || text(between(h, '<div class="h4">', "</div>").replace(/^[^>]*>/, "")).replace(/^Оффер\s+/, "");
    const desc = text(between(h, 'class="user-text"', 'offer-hero__conditions').replace(/^[^>]*>/, "").replace(/<\/?html>|<\/?body>/g, "")).replace(/^Оффер\s+\S+\s*/, "").replace(/\s*Условия выплат\s*$/, "");
    const logo = (between(h, 'class="offer-hero', "offer-hero__connect").match(/<img[^>]+src="([^"]+)"/) || [])[1] || null;
    const crumbs = ((ldjson(h).find((j) => j["@type"] === "BreadcrumbList") || (ldjson(h).flatMap((j) => j["@graph"] || []).find((j) => j["@type"] === "BreadcrumbList")) || {}).itemListElement || []).map((x) => x.name);
    const rub = conds.map((c) => parseFloat(String(c.payout).replace(/\s/g, "").replace(",", "."))).filter((n) => Number.isFinite(n) && n > 0);
    const hold = ((ind["Hold"] || ind["Холд"] || "").match(/(\d+)/) || [])[1];
    return {
      program_name: name || null, domain: `leads-su.${url.split("/").pop()}`, signup_url: url, landing_url: null, logo_url: logo && logo.startsWith("http") ? logo : logo ? this.base + logo : null,
      description: desc.slice(0, 3000) || null, network: "LEADS.SU", vertical: crumbs.length >= 3 ? crumbs[crumbs.length - 2] : "Finance",
      commission: conds.map((c) => `${c.action}: ${c.payout}`).join("; ").slice(0, 400) || null, commission_type: "CPA",
      currency: rub.length ? "RUB" : null, flat_min: rub.length ? Math.min(...rub) : null, flat_max: rub.length ? Math.max(...rub) : null,
      hold_days: hold ? +hold : null, countries: ["RU"],
      numbers: Object.keys(ind).length ? { indicators: ind } : null,
      extra: { conditions: conds, indicators: ind, kind: "offer" },
    };
  },
};
