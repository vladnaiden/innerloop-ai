// afftank.com/review/<slug> — ~210 network reviews: offers count, commission rate,
// referral commission, tracking software, minimum payout, payment frequency and methods,
// named affiliate managers with emails (from the mail-link title attribute), socials,
// categories, commission types, join link, Product JSON-LD logo.
const { text, between, ldjson, decode, host } = require("./_common");
module.exports = {
  name: "afftank", lang: "en", region: "global", base: "https://afftank.com",
  async list(af) {
    const r = await af.get(`${this.base}/sitemap-networks.xml`, { tries: 2 });
    return [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/afftank\.com\/review\/([a-z0-9-]+))<\/loc>/g)].map((m) => ({ url: m[1], slug: m[2] }));
  },
  parse(html, url) {
    const h = String(html);
    const name = text(between(h, "<h1", "</h1>").replace(/^<h1[^>]*>/, ""));
    if (!name) throw new Error("no name");
    const kind = text((h.match(/<\/h1>\s*<span[^>]*>([^<]*)<\/span>/) || [])[1] || "");
    const tagline = text((h.match(/<\/h1>[\s\S]{0,400}?<p class="text-gray-700[^"]*">([\s\S]*?)<\/p>/) || [])[1] || "");
    const det = between(h, "Network Details</h2>", "</section>");
    const kv = Object.fromEntries([...det.matchAll(/font-medium mb-[12]">([^<]*)<\/p>\s*<(?:p|div)[^>]*>([\s\S]*?)<\/(?:p|div)>/g)].map((m) => [text(m[1]), text(m[2].replace(/<!--.*?-->/g, ""))]));
    const methods = [...between(det, "Payment Methods", "</div></div>").matchAll(/rounded-full font-medium">([^<]*)</g)].map((m) => text(m[1]));
    const mgrBlock = between(h, "Affiliate Manager<!-- -->s</p>", "</section>") || between(h, "Affiliate Managers</p>", "</section>");
    const titles = [...mgrBlock.matchAll(/title="([^"]+)"/g)].map((m) => decode(m[1]));
    const names = [...mgrBlock.matchAll(/truncate">([^<]*)<\/p>/g)].map((m) => text(m[1])).filter(Boolean);
    const emailsAll = titles.filter((t) => /@[^ ]+\.[a-z]{2,}$/i.test(t) && !/^telegram/i.test(t)).map((t) => t.toLowerCase());
    const handlesAll = titles.filter((t) => /^telegram:/i.test(t)).map((t) => t.replace(/^telegram:\s*/i, ""));
    const managers = names.map((n, i) => ({ name: n, email: emailsAll[i] || null, handle: handlesAll[i] || null }));
    const emails = [...new Set(emailsAll)];
    const join = (h.match(/href="(https?:\/\/(?!afftank\.com)[^"]+)"[^>]*>\s*<span[^>]*>Join Network/) || [])[1] || null;
    const socials = [...new Set([...h.matchAll(/href="(https?:\/\/(?:t\.me|www\.facebook\.com|twitter\.com|x\.com|www\.linkedin\.com|www\.instagram\.com)\/[^"]+)"/g)].map((m) => m[1]))].filter((u) => !/afftank/i.test(u));
    const ld = ldjson(h).find((j) => j && j["@type"] === "Product") || {};
    const tx = text(h);
    const cats = (tx.match(/Major Categories\s+(.+?)\s+Commission Types/) || [, ""])[1].split(/\s{2,}|(?<=[a-z])\s(?=[A-Z])/).map((x) => x.trim()).filter((x) => x && x.length < 40);
    const types = ((tx.match(/Commission Types\s+(.+?)\s+Join Network/) || [, ""])[1].match(/\b(CPA|CPI|CPS|CPL|CPC|CPM|RevShare|Hybrid|SOI|DOI|COD)\b/g) || []).filter((v, i, a) => a.indexOf(v) === i);
    const rate = kv["Commission Rate"] || "", pct = rate.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
    const offers = parseInt((kv["Number of Offers"] || "").replace(/\D/g, ""), 10) || null;
    return {
      program_name: name, domain: join ? host(join) : `afftank.${url.split("/").pop()}`, signup_url: join, landing_url: join ? `https://${host(join)}` : null, logo_url: ld.image || null,
      description: tagline || null, // the LD description is AffTank's own boilerplate vertical: kind || null, categories: cats.length ? cats : null,
      commission: rate || null, pct_min: pct ? +pct[1] : null, pct_max: pct ? +pct[1] : null,
      commission_type: types.join(", ") || null, commission_types: types.length ? types : null,
      referral_commission: kv["Referral Commission"] || null, tracking_software: kv["Tracking Software"] || null,
      min_payment_raw: kv["Minimum Payout"] || null, payment_frequency: kv["Payment Frequency"] || null, payment_methods: methods.length ? methods : null,
      offers_count: offers, managers: managers.length ? managers : null, affiliate_managers: managers.map((m) => m.name).join("; ") || null,
      contact_email: emails[0] || null, contact_emails: emails.length ? emails : null, socials: socials.length ? socials : null,
      telegram: (socials.find((u) => /t\.me\//.test(u)) || "").split("/").pop() || null,
      extra: { details: kv, kind: kind || undefined },
    };
  },
};
