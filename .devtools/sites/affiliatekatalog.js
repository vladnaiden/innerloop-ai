// affiliatekatalog.com/kampane — Czech/Slovak catalogue (~900 programmes, since 2014):
// description, commission %, cookie days, programme sign-up link, product site, logo.
const { text, between, decode, host } = require("./_common");
module.exports = {
  name: "affiliatekatalog", lang: "cs", region: "CZ", base: "https://affiliatekatalog.com",
  async list(af) {
    const out = new Map();
    for (let p = 1; p <= 150; p++) {
      let r; try { r = await af.get(`${this.base}/kampane/?page=${p}`, { tries: 2 }); } catch { break; }
      const links = [...(r.html || "").matchAll(/href="https:\/\/affiliatekatalog\.com\/kampane\/([a-z0-9][a-z0-9-]*)\/"/g)].map((m) => m[1]).filter((s) => s !== "nova");
      let fresh = 0; for (const s of links) if (!out.has(s)) { out.set(s, { url: `${this.base}/kampane/${s}/`, slug: s }); fresh++; }
      if (!links.length || (p > 1 && !fresh)) break;
      await af.pace(2000);
    }
    return [...out.values()];
  },
  parse(html, url) {
    const h = String(html);
    const name = text(between(h, '<h1 class="subheader__caption">', "</h1>").replace(/^[^>]*>/, ""));
    const desc = text(between(h, "<h2>POPIS PROGRAMU</h2>", "</div>").replace(/^<h2>POPIS PROGRAMU<\/h2>/, "").replace(/<br\s*\/?>/g, " · "));
    const nums = Object.fromEntries([...h.matchAll(/<strong>([^<]*)<\/strong><small>([^<]*)<\/small>/g)].map((m) => [text(m[2]), text(m[1])]));
    const signup = (h.match(/href="([^"]+)"[^>]*class="detail-info__btn text-uppercase"/) || [])[1] || null;
    const landing = (h.match(/href="([^"]+)"[^>]*class="detail-info__btn detail-info__btn--secondary[^"]*"/) || [])[1] || null;
    const logo = (h.match(/class="detail-info__image">\s*<img src="([^"]+)"/) || [])[1] || null;
    const prov = nums["Provize"] || "";
    const pct = prov.match(/([\d.,]+)\s*%/), czk = prov.match(/([\d\s.,]+)\s*Kč/);
    const cookie = nums["Cookies"] ? parseInt(nums["Cookies"], 10) || null : null;
    return {
      program_name: name || null, domain: landing ? host(landing) : `affiliatekatalog.${url.replace(/\/$/, "").split("/").pop()}`,
      signup_url: signup, landing_url: landing, logo_url: logo, description: desc || null, country: "CZ", countries: ["CZ", "SK"],
      commission: prov || null, commission_type: pct ? "CPS" : czk ? "CPA" : null,
      pct_min: pct ? parseFloat(pct[1].replace(",", ".")) : null, pct_max: pct ? parseFloat(pct[1].replace(",", ".")) : null,
      flat_min: czk ? parseFloat(czk[1].replace(/\s/g, "").replace(",", ".")) : null, flat_max: czk ? parseFloat(czk[1].replace(/\s/g, "").replace(",", ".")) : null, currency: czk ? "CZK" : null,
      cookie_days: cookie, cookie_length_raw: nums["Cookies"] || null,
      extra: { numbers: nums, detail_url: url },
    };
  },
};
