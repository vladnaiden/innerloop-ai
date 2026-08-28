// partner-ads.com/dk/showprogram2.php?id=<id> — Partner-ads, Denmark's largest affiliate
// network: ~1,500 DK programmes (via 20 category lists) with the public sale commission %
// (or per-lead amount), programme description, advertiser website. Source is ISO-8859-1;
// Danish letters may arrive as U+FFFD — numbers and names are unaffected.
const { text, decode, host, between } = require("./_common");
module.exports = {
  name: "partner_ads", lang: "da", region: "DK", base: "https://www.partner-ads.com",
  async list(af) {
    const root = await af.get(`${this.base}/dk/partnerprogrammer.php`, { tries: 2 });
    const cats = [...new Set([...(root.html || root.text || "").matchAll(/href="(kategori-[a-z0-9-]+\.php)"/g)].map((m) => m[1]))];
    const ids = new Set();
    for (const c of cats) {
      const r = await af.get(`${this.base}/dk/${c}`, { tries: 2, maxChars: 1500000 });
      for (const m of (r.html || r.text || "").matchAll(/showprogram2\.php\?id=(\d+)/g)) ids.add(m[1]);
      await af.pace(2000);
    }
    return [...ids].map((id) => ({ url: `${this.base}/dk/showprogram2.php?id=${id}`, slug: id }));
  },
  urlFor(slug) { return `${this.base}/dk/showprogram2.php?id=${slug}`; },
  parse(html, url) {
    const h = String(html);
    const name = text((h.match(/<h1 class="product__title">([\s\S]*?)<\/h1>/) || [])[1] || "");
    if (!name) throw new Error("no name");
    const lead = text((h.match(/<p class="product__lead">([^<]*)<\/p>/) || [])[1] || "");
    const price = text(decode((h.match(/<h3 class="product__price">([\s\S]*?)<\/h3>/) || [])[1] || "").replace(/<[^>]+>/g, " "));
    const site = (h.match(/href="(https?:\/\/(?!www\.partner-ads\.com)[^"]+)"[^>]*>Se annonc/) || [])[1] || null;
    const art = between(h, 'class="article__content', '<div class="website-link">').replace(/<img[^>]*>/g, "");
    const desc = text(decode(art.replace(/<br\s*\/?>/g, " · ").replace(/<[^>]+>/g, " "))).replace(/^[^·]*·\s*·?\s*/, "").replace(/(\s*·\s*)+$/, "").replace(/(\s*·\s*){2,}/g, " · ");
    const pct = price.match(/([\d.,]+)\s*%/);
    const kr = price.match(/([\d.,]+)\s*(?:kr|DKK)/i);
    const isLead = /lead/i.test(lead);
    return {
      program_name: name, domain: site ? host(site) : `partner-ads.${url.split("=").pop()}`, landing_url: site, signup_url: `${this.base}/dk/addpartner.php`,
      description: desc.slice(0, 4000) || null, network: "Partner-ads",
      commission: price ? `${price}${isLead ? " per lead" : " per sale"}` : null, commission_type: isLead ? "CPL" : pct ? "CPS" : kr ? "CPA" : null,
      pct_min: pct && !isLead ? parseFloat(pct[1].replace(",", ".")) : null, pct_max: pct && !isLead ? parseFloat(pct[1].replace(",", ".")) : null,
      flat_min: kr ? parseFloat(kr[1].replace(/\./g, "").replace(",", ".")) : null, flat_max: kr ? parseFloat(kr[1].replace(/\./g, "").replace(",", ".")) : null, currency: kr ? "DKK" : null,
      extra: { commission_label: lead || undefined, elite: /elite\.png/.test(h) || undefined, encoding_note: "source is ISO-8859-1; Danish letters may be lost" },
    };
  },
};
