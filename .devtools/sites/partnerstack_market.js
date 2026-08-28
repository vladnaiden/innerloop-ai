// market.partnerstack.com/page/<slug> — PartnerStack's public programme marketplace (~400
// B2B SaaS programmes): company, category chips, about, offer structure (the commission
// sentence), commission length, cookie days, payout method and timing, attribution, features.
const { text, between, decode, pctRange } = require("./_common");
module.exports = {
  name: "partnerstack_market", lang: "en", region: "global", base: "https://market.partnerstack.com",
  async list(af) {
    const r = await af.get(`${this.base}/sitemap.xml`, { tries: 2 });
    return [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/market\.partnerstack\.com\/page\/([a-z0-9-]+))<\/loc>/g)].map((m) => ({ url: m[1], slug: m[2] }));
  },
  parse(html, url) {
    const h = String(html);
    const name = text(between(h, 'id="company-name"', "</div>").replace(/^[^>]*>/, ""));
    if (!name) throw new Error("no name");
    const chips = [...between(h, 'id="company-name"', "<section").matchAll(/white-space:nowrap;">([^<]+)</g)].map((m) => text(m[1]));
    const about = text(between(h, `About ${name}</h3>`, "</section>").replace(/^[^>]*>/, ""));
    const offer = text(between(h, "Offer structure</h3>", "</div>").replace(/^[^>]*>/, ""));
    const tx = text(h);
    const cookie = tx.match(/cookies? last for (\d+) days/i);
    const months = (offer + " " + tx).match(/first (\d+) months/i);
    const payout = (tx.match(/How do I get paid\?\s*(.+?)\s*When do I get paid/) || [])[1] || null;
    const timing = (tx.match(/When do I get paid\?\s*(.+?)\s*How long do cookies/) || [])[1] || null;
    const attribution = text(between(h, 'data-test="referral-container"', "</div>").replace(/<[^>]+>/g, " ")).replace(/^This program accepts customer referrals by:\s*/, "");
    const features = text(between(h, 'data-test="features-container"', "</div>").replace(/<[^>]+>/g, " ")).replace(/^Program features:\s*/, "");
    const pct = /%/.test(offer) ? pctRange(offer) : {}; const usd = offer.match(/\$\s*([\d,]+(?:\.\d+)?)/);
    const methods = payout ? ["PayPal", "Stripe", "Wire", "Payoneer"].filter((m) => new RegExp(m, "i").test(payout)) : [];
    return {
      program_name: name, domain: `partnerstack.${url.split("/").pop()}`, landing_url: null, signup_url: url,
      description: about.slice(0, 2000) || null, vertical: chips[0] || null, categories: chips.length ? chips : null, network: "PartnerStack",
      commission: offer || null, commission_type: /%/.test(offer) ? "CPS" : usd ? "CPA" : null,
      pct_min: pct.pct_min ?? null, pct_max: pct.pct_max ?? null, flat_min: usd ? parseFloat(usd[1].replace(/,/g, "")) : null, flat_max: usd ? parseFloat(usd[1].replace(/,/g, "")) : null, currency: usd ? "USD" : null,
      recurring: months ? true : null, recurring_months: months ? +months[1] : null,
      cookie_days: cookie ? +cookie[1] : null, cookie_length_raw: cookie ? `${cookie[1]} days` : null,
      payment_methods: methods.length ? methods : null, payment_frequency: timing ? "Monthly" : null,
      extra: { attribution: attribution || undefined, features: features || undefined, payout_note: payout || undefined, payout_timing: timing || undefined },
    };
  },
};
