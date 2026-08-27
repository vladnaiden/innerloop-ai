// postaffiliatepro.com/affiliate-program-directory — ~2,300 programmes as <dt>/<dd> pairs:
// industry, product type, programme type, cookie, traffic, countries, commission,
// payout frequency/methods/minimum, tracking software and the named affiliate manager.
const { text, between, decode, pctRange } = require("./_common");
module.exports = {
  name: "postaffiliatepro", lang: "en", region: "global", base: "https://www.postaffiliatepro.com",
  async list(af) {
    const out = new Map();
    for (let p = 1; p <= 80; p++) {
      let r; try { r = await af.get(`${this.base}/affiliate-program-directory/${p > 1 ? `page/${p}/` : ""}`, { tries: 2 }); } catch { break; }
      const links = [...(r.html || "").matchAll(/href="\/affiliate-program-directory\/([a-z0-9-]+)\/"/g)].map((m) => m[1]).filter((s) => !/^page$/.test(s));
      if (!links.length) break;
      for (const s of links) out.set(s, { url: `${this.base}/affiliate-program-directory/${s}/`, slug: s });
      if (!(r.html || "").includes(`/affiliate-program-directory/page/${p + 1}/`)) break;
      await af.pace(2000);
    }
    return [...out.values()];
  },
  parse(html, url) {
    const h = String(html);
    const pairs = {};
    for (const m of h.matchAll(/<dt[^>]*>\s*<span>([\s\S]*?)<\/span>\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)) {
      const k = text(m[1]); const vals = [...m[2].matchAll(/<span class="block">([\s\S]*?)<\/span>/g)].map((x) => text(x[1])).filter((v) => v && v !== "N/A");
      pairs[k] = vals.length ? vals : (text(m[2]) !== "N/A" ? [text(m[2])] : []);
    }
    const one = (k) => (pairs[k] || [])[0] || null;
    const name = text(between(h, "<h1", "</h1>").replace(/^<h1[^>]*>/, "")).replace(/\s+Affiliate Program$/i, "");
    const desc = text(between(between(h, "<h1", "</section>"), "<p class=\"mt-8", "</p>").replace(/^<p[^>]*>/, ""));
    const mgrBlock = between(h, ">Affiliate Manager</h2>", "</section>");
    const manager = text((mgrBlock.match(/<h3[^>]*>([^<]*)<\/h3>/) || [])[1] || "") || null;
    const site = (h.match(/href="(https?:\/\/[^"]+)"[^>]*>\s*(?:Visit|Join|Go to)[^<]{0,40}(?:website|program)/i) || [])[1] || null;
    const rate = one("Commission Rate");
    const pct = rate && /%/.test(rate) ? pctRange(rate) : {};
    const types = pairs["Affiliate Program Type"] || [];
    const cookie = one("Affiliate Cookie Duration");
    const logo = (h.match(/images\/processed\/affiliate-program-directory\/[^"]+\.(?:jpg|png|webp)/) || [])[0];
    return {
      program_name: name || null, domain: `pap.${url.replace(/\/$/, "").split("/").pop()}`, signup_url: url, landing_url: site,
      logo_url: logo ? `https://images.postaffiliatepro.com/${logo.split(/\s/)[0]}` : null, description: desc || null,
      vertical: one("Industry"), categories: [one("Industry"), one("Product Type")].filter(Boolean),
      commission: rate, commission_type: types.map((t) => t.split(" - ")[0]).join(", ") || null, commission_types: types.length ? types.map((t) => t.split(" - ")[0]) : null,
      pct_min: pct.pct_min ?? null, pct_max: pct.pct_max ?? null,
      cookie_days: cookie ? parseInt(cookie, 10) || null : null, cookie_length_raw: cookie,
      payment_frequency: one("Payout Frequency"), payment_methods: pairs["Payout Methods"] || null, min_payment_raw: one("Minimum Payout"),
      tracking_software: one("Affiliate Software"), affiliate_managers: manager, managers: manager ? [{ name: manager }] : null,
      geo: (pairs["Accepted countries"] || []).join(", ") || null,
      extra: { pairs, commission_structure: one("Commission Structure"), mlm: one("MLM"), promo_materials: pairs["Promotional Materials"], traffic_sources: pairs["Accepted traffic source"] },
    };
  },
};
