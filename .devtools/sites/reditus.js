// getreditus.com/affiliate-programs/<slug> — B2B SaaS programme directory (~165):
// commission, commission length, cookie window, network it runs on, payout terms,
// application, cost to join, official apply link, "why promote" copy.
const { text, between, decode, host, pctRange } = require("./_common");
module.exports = {
  name: "reditus", lang: "en", region: "global", base: "https://getreditus.com",
  async list(af) {
    const r = await af.get(`${this.base}/sitemaps/affiliate-programs/sitemap.xml`, { tries: 2 });
    return [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/getreditus\.com\/affiliate-programs\/([a-z0-9-]+))<\/loc>/g)].filter((m) => !/^(recurring|saas|b2b)$/.test(m[2])).map((m) => ({ url: m[1], slug: m[2] }));
  },
  parse(html, url) {
    const h = String(html);
    const name = text(between(h, "<h1", "</h1>").replace(/^<h1[^>]*>/, "").replace(/<!--.*?-->/g, "")).replace(/\s+Affiliate Program$/i, "");
    if (!name) throw new Error("no name");
    const kv = Object.fromEntries([...h.matchAll(/text-xs text-neutral600 mb-1">([^<]*)<\/p>\s*<p class="font-semibold text-primary800">([^<]*)</g)].map((m) => [text(m[1]), text(m[2])]));
    const apply = (h.match(/<a href="(https?:\/\/(?!getreditus\.com)[^"]+)"[^>]*rel="nofollow sponsored/) || [])[1] || null;
    const clean = apply ? apply.split("?")[0] : null;
    const logo = (h.match(/<img src="(https:\/\/logo\.clearbit\.com\/[^"]+)"/) || [])[1] || null;
    const prose = text(between(h, 'class="prose-styles', 'id="similar-programs"').replace(/^[^>]*>/, "").replace(/<\/(p|li|h\d)>/g, " · "));
    const comm = kv["Commission"] || "";
    const pct = /%/.test(comm) ? pctRange(comm) : {}; const flat = comm.match(/\$\s*([\d,]+(?:\.\d+)?)/);
    const cookie = (kv["Cookie window"] || "").match(/(\d+)\s*day/);
    const len = kv["Commission length"] || "";
    const recurring = /recurring|lifetime|months|year/i.test(comm + " " + len) && !/one-time/i.test(comm) ? true : null;
    return {
      program_name: name, domain: clean ? host(clean) : `reditus.${url.split("/").pop()}`, landing_url: clean ? `https://${host(clean)}` : null, signup_url: clean || url, logo_url: logo,
      description: prose.slice(0, 3000) || null, network: kv["Runs on"] && !/^Reditus$/i.test(kv["Runs on"]) ? kv["Runs on"] : (kv["Runs on"] || null),
      commission: comm || null, commission_type: /per signup|per lead/i.test(comm) ? (/%/.test(comm) ? "Hybrid" : "CPL") : /%/.test(comm) ? "CPS" : /\$/.test(comm) ? "CPA" : null,
      pct_min: pct.pct_min ?? null, pct_max: pct.pct_max ?? null, flat_min: flat ? parseFloat(flat[1].replace(/,/g, "")) : null, flat_max: flat ? parseFloat(flat[1].replace(/,/g, "")) : null, currency: flat ? "USD" : null,
      recurring, cookie_days: cookie ? +cookie[1] : null, cookie_length_raw: kv["Cookie window"] && !/See program/i.test(kv["Cookie window"]) ? kv["Cookie window"] : null,
      extra: { terms: kv, commission_length: len && !/See program/i.test(len) ? len : undefined, payouts: kv["Payouts"], application: kv["Application"], cost_to_join: kv["Cost to join"] },
    };
  },
};
