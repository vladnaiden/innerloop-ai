// nutriprofits.com/offers.html — NutriProfits (nutra CPS network, own products): one public
// table of ~60 products with category, target countries (flag alts), commission %, average
// commission in USD, logo. No detail pages; one record per table row.
const { text, decode, between } = require("./_common");
module.exports = {
  name: "nutriprofits", lang: "en", region: "global", base: "https://nutriprofits.com",
  async list() { return [{ url: `${this.base}/offers.html`, slug: "offers" }]; },
  parse(html) {
    const h = String(html);
    return [...h.matchAll(/<div class="table-row">([\s\S]*?)<\/div>\s*<\/div>\s*(?=<div class="table-row">|<\/div>)/g)].map((m) => {
      const row = m[1];
      const col = (n) => text(decode((row.match(new RegExp(`tbl-col-${n}">([\\s\\S]*?)</div>`)) || [])[1] || "").replace(/<span class="tbl-show-mobile">[^<]*<\/span>/, "").replace(/<[^>]+>/g, " "));
      const name = col(2); if (!name) return null;
      const cat = col(3);
      const countries = [...row.matchAll(/flags\/([A-Z]{2})\.png/g)].map((x) => x[1]);
      const logo = (row.match(/tbl-col-1"><img src="([^"]+)"/) || [])[1];
      const pct = (col(5).match(/([\d.]+)\s*%/) || [])[1];
      const avg = (col(6).match(/\$\s*([\d.,]+)/) || [])[1];
      return {
        key: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        program_name: name, domain: `nutriprofits.${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, signup_url: `${this.base}/register.html`, logo_url: logo ? `${this.base}${logo}` : null,
        network: "NutriProfits", commission: pct ? `${pct}%` : null, commission_type: "CPS", pct_min: pct ? +pct : null, pct_max: pct ? +pct : null,
        tags: ["nutra", cat.toLowerCase()].filter(Boolean),
        extra: { category: cat || undefined, countries: countries.length ? countries : undefined, avg_commission_usd: avg ? parseFloat(avg.replace(/,/g, "")) : undefined },
      };
    }).filter(Boolean);
  },
};
