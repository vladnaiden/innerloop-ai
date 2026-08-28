// affiliateroll.com/programs/<slug> — curated directory (~165): commission, type, cookie
// duration, minimum payout, payment methods, launch year, benefits, SoftwareApplication LD.
const { text, between, ldjson, decode, host, pctRange } = require("./_common");
module.exports = {
  name: "affiliateroll", lang: "en", region: "global", base: "https://www.affiliateroll.com",
  async list(af) {
    const r = await af.get(`${this.base}/sitemap.xml`, { tries: 2 });
    return [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/www\.affiliateroll\.com\/programs\/([a-z0-9-]+))<\/loc>/g)].map((m) => ({ url: m[1], slug: m[2] }));
  },
  parse(html, url) {
    const h = String(html).replace(/<svg[\s\S]*?<\/svg>/g, "");
    const name = text(between(h, "<h1", "</h1>").replace(/^<h1[^>]*>/, ""));
    if (!name) throw new Error("no name");
    const det = between(h, "Commission Details</h3>", "</section>");
    const kv = Object.fromEntries([...det.matchAll(/text-muted-foreground[^"]*">\s*([^<]*?)\s*<\/span>\s*<span class="font-(?:semibold|medium) text-foreground">([\s\S]*?)<\/span>/g)].map((m) => [text(m[1]), text(m[2].replace(/<!--.*?-->/g, ""))]));
    const methods = [...between(det, "Payment Methods", "Launch Year").matchAll(/bg-secondary text-muted-foreground">([^<]*)</g)].map((m) => text(m[1]));
    const vi = h.indexOf("Visit Website"); const visit = vi > 0 ? (h.slice(Math.max(0, vi - 4000), vi).match(/href="(https?:\/\/(?!www\.affiliateroll\.com)[^"]+)"[^>]*>\s*$/) || [])[1] : null;
    const ld = ldjson(h).find((j) => j && j["@type"] === "SoftwareApplication") || {};
    const benefits = [...between(h, "Benefits</h3>", "</ul>").matchAll(/shrink-0"><\/span>([^<]*)</g)].map((m) => text(m[1]));
    const cat = text((h.match(/href="\/programs\?category=[^"]+"><div[^>]*>([^<]*)</) || [])[1] || "");
    const comm = kv["Commission"] || "", pct = /%/.test(comm) ? pctRange(comm) : {}, usd = comm.match(/\$\s*([\d,]+(?:\.\d+)?)/);
    const cookie = (kv["Cookie Duration"] || "").match(/(\d+)/), year = (kv["Launch Year"] || "").match(/(\d{4})/);
    const clean = visit ? visit.split("?")[0] : null;
    return {
      program_name: name, domain: clean ? host(clean) : `affiliateroll.${url.split("/").pop()}`, landing_url: clean, signup_url: url, logo_url: null,
      description: [ld.description, benefits.join(" · ")].filter(Boolean).join(" — ").slice(0, 3000) || null,
      vertical: cat || null, categories: cat ? [cat] : null,
      commission: comm || null, commission_type: /percent/i.test(kv["Type"] || "") ? "CPS" : /flat|fixed/i.test(kv["Type"] || "") ? "CPA" : (kv["Type"] || null),
      pct_min: pct.pct_min ?? null, pct_max: pct.pct_max ?? null, flat_min: usd ? parseFloat(usd[1].replace(/,/g, "")) : null, flat_max: usd ? parseFloat(usd[1].replace(/,/g, "")) : null, currency: usd ? "USD" : null,
      cookie_days: cookie ? +cookie[1] : null, cookie_length_raw: kv["Cookie Duration"] || null, min_payment_raw: kv["Min Payout"] || null,
      payment_methods: methods.length ? methods : null, established_year: year ? +year[1] : null,
      extra: { details: kv, benefits: benefits.length ? benefits : undefined },
    };
  },
};
