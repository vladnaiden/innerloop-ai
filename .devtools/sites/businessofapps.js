// businessofapps.com/affiliate/<slug> — Business of Apps' affiliate-network profiles (~125):
// name, tagline, rating /10 with vote count, logo, partner sign-up link, profile text.
const { text, between, ldjson, decode } = require("./_common");
module.exports = {
  name: "businessofapps", lang: "en", region: "global", base: "https://www.businessofapps.com",
  async list(af) {
    const r = await af.get(`${this.base}/affiliate_network-sitemap.xml`, { tries: 2 });
    return [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/www\.businessofapps\.com\/affiliate\/([a-z0-9-]+)\/)<\/loc>/g)].map((m) => ({ url: m[1], slug: m[2] }));
  },
  parse(html, url) {
    const h = String(html);
    const head = between(h, '<h1 class="entry-title', "profile_section");
    const name = text((head.match(/<a[^>]*>([^<]*)<\/a>\s*<\/h1>/) || head.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "");
    if (!name) throw new Error("no name");
    const signup = (head.match(/data-layer-link-type="visit website"[^>]*href="([^"]+)"/) || head.match(/href="([^"]+)"[^>]*data-layer-link-type="visit website"/) || [])[1] || null;
    const tagline = text((head.match(/<\/h1>\s*<p>([\s\S]*?)<\/p>/) || [])[1] || "");
    const rating = (head.match(/r-average">([\d.]+)</) || [])[1], votes = (head.match(/\((\d+) votes\)/) || [])[1];
    const logo = (head.match(/<img src="([^"]+)"/) || [])[1] || null;
    const body = text(between(h, 'class="network-single', 'class="main__r').replace(/<\/(p|li|h\d)>/g, " · ")).replace(/^[^·]*Overview\s*·?\s*/, "");
    const models = [...new Set([...body.matchAll(/\b(RevShare|Revenue Share|CPA|CPL|CPS|CPI|Hybrid)\b/gi)].map((m) => m[1].replace(/Revenue Share/i, "RevShare")))].slice(0, 6);
    return {
      program_name: name, domain: signup ? new URL(signup).hostname.replace(/^www\./, "") : `boa.${url.replace(/\/$/, "").split("/").pop()}`, signup_url: signup, landing_url: null, logo_url: logo,
      description: [tagline, body.slice(0, 2500)].filter(Boolean).join(" — ") || null,
      rating_avg: rating ? parseFloat(rating) : null, rating_count: votes ? +votes : null,
      commission_type: models.join(", ") || null, commission_types: models.length ? models : null,
      extra: { rating_scale: 10, profile_url: url },
    };
  },
};
