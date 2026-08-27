// cpa.rip/en/partners/<slug> — EN/RU catalogue of ~480 affiliate networks (gambling-heavy):
// description, user rating, socials, payouts (minimum, timing), payout systems.
const { text, between, decode, ldjson } = require("./_common");
module.exports = {
  name: "cpa_rip", lang: "en", region: "CIS", base: "https://cpa.rip",
  async list(af) {
    const r = await af.get(`${this.base}/affiliate-sitemap.xml`, { tries: 2 });
    return [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/cpa\.rip\/en\/partners\/([a-z0-9_-]+)\/)<\/loc>/g)].map((m) => ({ url: m[1], slug: m[2] }));
  },
  parse(html, url) {
    const h = String(html);
    const graph = ldjson(h).flatMap((j) => j["@graph"] || [j]);
    const page = graph.find((g) => g["@type"] === "WebPage") || {};
    const name = (page.name || text(between(h, "<h1", "</h1>").replace(/^<h1[^>]*>/, ""))).replace(/\s+[–-]\s+Reviews.*$/i, "");
    const block = (title) => between(h, `block__crd_pg_prt_title">${title}</div>`, "block__crd_pg_prt_title");
    const pay = [...block("Payouts").matchAll(/<li class="grp__pg_crd">([^<]*)<\/li>/g)].map((m) => text(m[1]));
    const systems = [...block("Payout systems").matchAll(/grp__pay_crd_text"><span>([^<]*)<\/span>/g)].map((m) => text(m[1]));
    const socials = [...block("Social networks").matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
    const avg = text((h.match(/cparip-stars-avg">([^<]*)</) || [])[1] || ""), cnt = +((h.match(/cparip-stars-count">\((\d+)\)/) || [])[1] || 0);
    const minp = (pay.find((p) => /Minimum payout/i.test(p)) || "").replace(/^Minimum payout:\s*/i, "").replace(/;$/, "");
    const timing = (pay.find((p) => /^Time/i.test(p)) || "").replace(/^Time:\s*/i, "").replace(/\.$/, "");
    const site = null; // outbound links are rip.af tracking redirects, not the network's site
    const tg = socials.find((s) => /t\.me|telegram/.test(s));
    return {
      program_name: name || null, domain: site ? new URL(site).hostname.replace(/^www\./, "") : `cparip.${url.replace(/\/$/, "").split("/").pop()}`,
      signup_url: url, landing_url: site, logo_url: page.thumbnailUrl || (graph.find((g) => g["@type"] === "ImageObject") || {}).url || null,
      description: page.description || null, min_payment_raw: minp || null, payment_frequency: timing || null,
      payment_methods: systems.length ? systems : null, socials: socials.length ? socials : null, telegram: tg ? tg.split("/").pop() : null,
      rating_avg: /^\d/.test(avg) && cnt ? parseFloat(avg) : null, rating_count: cnt || null, source_updated: page.dateModified ? page.dateModified.slice(0, 10) : null,
      extra: { payouts: pay, rating_scale: 5 },
    };
  },
};
