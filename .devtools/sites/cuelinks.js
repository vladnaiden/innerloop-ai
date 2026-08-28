// cuelinks.com/campaigns/<slug> — Cuelinks, India's largest content-monetisation affiliate
// platform: 1000+ public campaign pages with payout (upto % / ₹ per action), 3-month + 1-week
// EPC, tracking / validation / payment timings, categories, cookie duration, deeplink,
// incentive + social-media allowance, merchant site, FAQ commission range. Listing: /campaigns?page=N
// (30 per page) — walked until no new slug appears.
const { text, decode, between, host, ldjson } = require("./_common");
module.exports = {
  name: "cuelinks", lang: "en", region: "IN", base: "https://www.cuelinks.com",
  async list(af) {
    const seen = new Map(); let stale = 0;
    for (let p = 1; p <= 400 && stale < 2; p++) {
      const r = await af.get(`${this.base}/campaigns?page=${p}`, { tries: 2, maxChars: 900000 });
      const slugs = [...new Set([...(r.html || r.text || "").matchAll(/href='\/campaigns\/([a-z0-9-]+)'/g)].map((m) => m[1]))];
      const fresh = slugs.filter((s) => !seen.has(s));
      if (!slugs.length) break;
      stale = fresh.length ? 0 : stale + 1;
      for (const s of fresh) seen.set(s, { url: `${this.base}/campaigns/${s}`, slug: s });
      await af.pace(1200);
    }
    return [...seen.values()];
  },
  urlFor(slug) { return `${this.base}/campaigns/${slug}`; },
  parse(html, url) {
    const h = String(html);
    const name = text(decode((h.match(/id="merchant-name-display">([\s\S]*?)<\/h1>/) || [])[1] || "")).replace(/\s+Affiliate Program$/i, "");
    if (!name) throw new Error("no name");
    const site = (h.match(/href="([^"]+)"\s+id="merchant-url-display"/) || [])[1] || null;
    const logo = (h.match(/src="(https:\/\/cdn0\.cuelinks\.com\/merchant\/[^"]+)"/) || [])[1] || null;
    const payout = text((h.match(/<span class="px-6 line-clamp-1">(Payout Upto[^<]*)<\/span>/) || [])[1] || "").replace(/^Payout Upto\s*/i, "");
    const epc3 = (h.match(/3 Months EPC\s*:\s*₹\s*([\d.,]+)/) || [])[1], epc1 = (h.match(/1 Week EPC\s*<span[^>]*>:\s*₹\s*([\d.,]+)/) || [])[1];
    const plain = h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const timing = (k) => (plain.match(new RegExp(`${k}\\s+(\\d+\\s*(?:min|mins|hour|hours|day|days|month|months)(?:\\s+(?:from|after)[^|<]{0,30}?)?)(?=\\s+(?:Validation|Payment|Join))`)) || [])[1];
    const card = (label) => { const m = h.match(new RegExp(`<p class="text-gray-600 text-sm mb-2">\\s*${label}\\s*</p>[\\s\\S]*?<p class="text-primary-2[^"]*">\\s*([^<]*?)\\s*</p>`)); return m ? text(m[1]) : ""; };
    const cats = text((h.match(/Categories\s*<\/div>\s*<div class="text-primary-2[^"]*">\s*([^<]*)/) || [])[1] || "");
    const cookie = card("Cookie Duration"), deeplink = card("Deeplink"), incentive = card("Incentive / cashback"), social = card("Social media");
    const faq = ldjson(h).find((j) => j && j["@type"] === "FAQPage");
    const faqComm = faq ? (faq.mainEntity || []).map((q) => q.acceptedAnswer?.text || "").find((t) => /commission rate is/i.test(t)) : null;
    const range = faqComm ? faqComm.match(/rate is ((?:₹\s*)?[\d.,]+\s*%?(?:\s*to\s*(?:₹\s*)?[\d.,]+\s*%?)?(?: per [A-Za-z]+)?)/i) : null;
    const pct = payout.match(/([\d.]+)\s*%/), inr = payout.match(/₹\s*([\d.,]+)/);
    const pmin = range && range[1].match(/([\d.]+)\s*%\s*to/) ? parseFloat(range[1].match(/([\d.]+)\s*%\s*to/)[1]) : null;
    const cd = cookie.match(/(\d+)\s*Day/i);
    return {
      program_name: name, domain: site ? host(site) : `cuelinks.${url.split("/").pop()}`, landing_url: site, signup_url: url, logo_url: logo,
      network: "Cuelinks", commission: payout || null, commission_type: /per sale/i.test(payout) ? "CPS" : /per (lead|install|signup|action|order)/i.test(payout) ? (/install/i.test(payout) ? "CPI" : "CPL") : pct ? "CPS" : inr ? "CPA" : null,
      pct_min: pct ? (pmin ?? +pct[1]) : null, pct_max: pct ? +pct[1] : null, flat_min: inr ? parseFloat(inr[1].replace(/,/g, "")) : null, flat_max: inr ? parseFloat(inr[1].replace(/,/g, "")) : null, currency: inr ? "INR" : null,
      cookie_days: cd ? +cd[1] : null, cookie_length_raw: cookie || null,
      tags: cats ? cats.split(/\s*,\s*/).map((s) => s.toLowerCase()) : [],
      extra: { categories: cats || undefined, epc_3m_inr: epc3 ? parseFloat(epc3.replace(/,/g, "")) : undefined, epc_1w_inr: epc1 ? parseFloat(epc1.replace(/,/g, "")) : undefined, tracking: timing("Tracking"), validation: timing("Validation"), payment: timing("Payment"), deeplink: deeplink || undefined, incentive_allowed: incentive || undefined, social_media_allowed: social || undefined, commission_range_raw: range ? text(range[1]) : undefined },
    };
  },
};
