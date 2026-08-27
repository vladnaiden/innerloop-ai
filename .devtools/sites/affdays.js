// affdays.com/programs/<niche> — editorial comparison tables: one row per programme
// (type, since, offer scope, GEOs, payment models, registration, review + sign-up).
const { text, between, decode } = require("./_common");
module.exports = {
  name: "affdays", lang: "en", region: "global", base: "https://affdays.com",
  async list(af) {
    const r = await af.get(`${this.base}/`, { tries: 2 });
    const urls = [...(r.html || "").matchAll(/href="(https:\/\/affdays\.com\/programs\/[a-z0-9-]+)\/?"/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i);
    return urls.map((url) => ({ url, slug: url.split("/").pop() }));
  },
  parse(html, url) {
    const h = String(html);
    const niche = url.split("/").pop();
    const cell = (tr, col) => { const m = tr.match(new RegExp(`class="affcl-col-${col}">([\\s\\S]*?)</td>`)); return m ? m[1] : ""; };
    return [...between(h, 'class="affcl-table"', "</table>").matchAll(/<tr itemprop="itemListElement"[\s\S]*?<\/tr>/g)].map((m) => {
      const tr = m[0];
      const name = text((tr.match(/screen-reader-text">([^<]*)</) || [])[1] || (tr.match(/alt="([^"]*) logo"/) || [])[1] || "");
      const logo = (tr.match(/<img src="([^"]+)"/) || [])[1] || null;
      const models = text(cell(tr, "payment_models").replace(/<br\s*\/?>/g, ", ")).split(/\s*,\s*/).filter(Boolean);
      const geos = text(cell(tr, "geos"));
      const links = [...cell(tr, "actions").matchAll(/href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((l) => ({ url: l[1], label: text(l[2]) }));
      const review = links.find((l) => /review/i.test(l.label)), signup = links.find((l) => /sign|join|register/i.test(l.label));
      const since = parseInt(text(cell(tr, "operating_since")), 10) || null;
      return {
        key: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        program_name: name || null, domain: `affdays.${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        signup_url: signup ? signup.url : null, landing_url: review ? review.url : null, logo_url: logo,
        vertical: niche, established_year: since, commission_type: models.join(", ") || null, commission_types: models.length ? models : null,
        geo: geos || null, countries: /^[A-Z]{2}(,\s*[A-Z]{2})*$/.test(geos) ? geos.split(/,\s*/) : null,
        extra: { type: text(cell(tr, "type")) || null, offer_scope: text(cell(tr, "offer_scope")) || null, registration: text(cell(tr, "registration_process")) || null, review_url: review ? review.url : null },
      };
    }).filter((r) => r.program_name);
  },
};
