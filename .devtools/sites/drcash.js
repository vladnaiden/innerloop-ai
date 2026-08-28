// dr.cash/offers/<id> — dr.cash (nutra / health & beauty CPA network, COD + SS): thousands of
// public offers with payout + currency, product price, model, approve rate, GEO, niche, status,
// top-promo landing, rules text. Listing is the site's own /v1/offers?limit=30&offset=N fragment.
const { text, decode, between } = require("./_common");
module.exports = {
  name: "drcash", lang: "en", region: "global", base: "https://dr.cash",
  async list(af) {
    const out = new Map();
    for (let off = 0; off < 60000; off += 30) {
      let r; try { r = await af.get(`${this.base}/v1/offers?limit=30&offset=${off}`, { tries: 2, maxChars: 600000 }); } catch (e) { if (/empty-body/.test(String(e.message))) break; throw e; }
      const ids = [...(r.html || r.text || "").matchAll(/href="\/offers\/(\d+)" class="offer"/g)].map((m) => m[1]);
      if (!ids.length) break;
      for (const id of ids) out.set(id, { url: `${this.base}/offers/${id}`, slug: id });
      await af.pace(1200);
    }
    return [...out.values()];
  },
  urlFor(slug) { return `${this.base}/offers/${slug}`; },
  parse(html, url) {
    const h = String(html);
    const box = between(h, '<div class="current-offer">', '<div class="current-offer__rules">') || "";
    const name = text(decode((box.match(/current-offer__name">([\s\S]*?)<\/p>/) || [])[1] || ""));
    if (!name) throw new Error("no offer on page");
    const id = (box.match(/current-offer__id">ID (\d+)/) || [])[1] || url.split("/").pop();
    const niche = text((box.match(/current-offer__niche">([\s\S]*?)<\/p>/) || [])[1] || "");
    const status = text((box.match(/current-offer__status-text">([^<]*)/) || [])[1] || "");
    const img = (box.match(/current-offer__image">\s*<img src="([^"]+)"/) || [])[1];
    const kv = {};
    for (const m of box.matchAll(/<p class="title">([^<]*)<\/p>\s*<p class="value">([\s\S]*?)<\/p>/g)) kv[text(m[1])] = text(decode(m[2]).replace(/<[^>]+>/g, " "));
    const promo = (box.match(/current-offer__promo-name">([^<]*)/) || [])[1];
    const rules = text(decode((between(h, '<div class="current-offer__rules">', "</div>") || "").replace(/current-offer__rules-title">Rules<\/p>/, "").replace(/<[^>]+>/g, " "))).slice(0, 3000);
    const pay = (kv["Payout"] || "").match(/([\d\s.,]+)\s*([A-Z]{3})/);
    const price = (kv["Price"] || "").match(/([\d\s.,]+)\s*([A-Z]{3})/);
    const n = (s) => parseFloat(String(s).replace(/\s/g, "").replace(",", "."));
    const geo = (kv["Geo"] || "").split(/\s*,\s*/).filter(Boolean);
    const appr = (kv["Approve"] || "").match(/([\d.]+)\s*%/);
    const model = (kv["Model"] || "").toUpperCase();
    return {
      program_name: name, domain: `drcash.${id}`, signup_url: `${this.base}/sign-up/`, logo_url: img || null,
      description: [niche && `Niche: ${niche}`, rules].filter(Boolean).join(" · ").slice(0, 4000) || null, network: "dr.cash",
      commission: kv["Payout"] ? `${kv["Payout"]} ${model || ""}`.trim() : null, commission_type: /CPL/.test(model) ? "CPL" : /CPS|REV/.test(model) ? "CPS" : model ? "CPA" : null,
      flat_min: pay ? n(pay[1]) : null, flat_max: pay ? n(pay[1]) : null, currency: pay ? pay[2] : null,
      tags: ["nutra", niche.toLowerCase()].filter(Boolean),
      extra: { offer_id: id, status: status || undefined, niche: niche || undefined, model: model || undefined, geo: geo.length ? geo : undefined, approve_pct: appr ? +appr[1] : undefined, product_price: price ? { amount: n(price[1]), currency: price[2] } : undefined, top_promo: promo ? text(promo) : undefined },
    };
  },
};
