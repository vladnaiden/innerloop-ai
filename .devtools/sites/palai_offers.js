// palai.media/offers — individual CPA offers (mostly iGaming) with payout, model, GEO,
// the network that runs them and the advertiser's full conditions text.
const { text, host, meta, between } = require("./_common");
module.exports = {
  name: "palai_offers", lang: "uk", region: "UA", base: "https://palai.media",
  async list(af) {
    const r = await af.get(`${this.base}/sitemaps/offers.xml`, { tries: 2 });
    return [...(r.html || r.text || "").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
      .filter((u) => u.includes("/offers/")).map((url) => ({ url, slug: url.split("/").pop() }));
  },
  parse(html, url) {
    const h = String(html);
    const title = text(between(h, '<h1 class="offer-content__title">', "</h1>").replace(/^<h1[^>]*>/, ""));
    const meta_ = Object.fromEntries([...h.matchAll(/<div class="offer-content__meta">\s*<strong>([^<]*)<\/strong>\s*<span>([\s\S]*?)<\/span>/g)].map((m) => [text(m[1]).replace(/:$/, ""), text(m[2])]));
    const net = between(h, 'class="offer-content__provider"', "</strong>");
    const network = text((net.match(/<a[^>]*>([^<]*)<\/a>/) || [])[1] || "") || null;
    const status = text(between(h, '<span class="offer-content__status">', "</span>").replace(/^<span[^>]*>/, ""));
    const logo = (between(h, 'class="offer-content__left"', "</div>").match(/<img[^>]+src="([^"]+)"/) || [])[1] || null;
    const pay = meta_["Виплата"] || "";
    const pm = pay.match(/([\d.,]+)\s*([A-Z]{3})/);
    const conditions = text(between(h, "Offer conditions", '<div class="offer-content__bottom').replace(/<\/(p|li|div|h\d)>|<br\s*\/?>/g, " · "));
    const geo = meta_["GEO"] || null;
    return {
      program_name: title || null, domain: `palai-offer.${url.split("/").pop()}`, signup_url: url, landing_url: null,
      logo_url: logo, description: conditions ? conditions.slice(0, 4000) : null,
      network, vertical: meta_["Вертикалі"] || null, commission: pay || null, commission_type: meta_["Тип виплат"] || null,
      flat_min: pm ? parseFloat(pm[1].replace(",", ".")) : null, flat_max: pm ? parseFloat(pm[1].replace(",", ".")) : null, currency: pm ? pm[2] : null,
      geo, countries: geo ? geo.split(/\s*,\s*/).filter((x) => /^[A-Z]{2}$/.test(x)) : null,
      extra: { status: status || null, meta: meta_, kind: "offer" },
    };
  },
};
