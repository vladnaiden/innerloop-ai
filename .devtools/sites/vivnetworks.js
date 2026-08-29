// vivnetworks.com/affiliate-katalog/<slug>/ — VIVnetworks (CEE affiliate network, CZ/SK/PL/HU/RO…):
// ~300 public programme pages with commission, cookie length, per-channel commission tiers
// (coupons/cashback, content), condition grid (SEM, brand SEM, XML feed, coupon portals, S2S,
// cashback portals, own creatives, domain redirect), category, named affiliate manager + email,
// advertiser description. Listing: /affiliate-katalog/ paginated (/page/N/).
const { text, decode, between, meta } = require("./_common");
module.exports = {
  name: "vivnetworks", lang: "cs", region: "CEE", base: "https://www.vivnetworks.com",
  async list(af) {
    const out = new Map(); let stale = 0;
    for (let p = 1; p <= 40 && stale < 2; p++) {
      let r; try { r = await af.get(p === 1 ? `${this.base}/affiliate-katalog/` : `${this.base}/affiliate-katalog/page/${p}/`, { tries: 2, maxChars: 2000000 }); } catch (e) { if (/HTTP 404/.test(e.message)) break; throw e; }
      const slugs = [...new Set([...(r.html || r.text || "").matchAll(/affiliate-katalog\/([a-z0-9-]+)\//g)].map((m) => m[1]))].filter((s) => !/^(page|feed)$/.test(s));
      const fresh = slugs.filter((s) => !out.has(s)); stale = fresh.length ? 0 : stale + 1;
      for (const s of fresh) out.set(s, { url: `${this.base}/affiliate-katalog/${s}/`, slug: s });
      await af.pace(1200);
    }
    return [...out.values()];
  },
  urlFor(slug) { return `${this.base}/affiliate-katalog/${slug}/`; },
  parse(html, url) {
    const h = String(html);
    const name = text(decode((h.match(/<h1 class="entry-title">([\s\S]*?)<\/h1>/) || [])[1] || ""));
    if (!name) throw new Error("no name");
    const cat = text(decode((h.match(/<span class="entry-subtitle">\s*<a[^>]*>([^<]*)</) || [])[1] || ""));
    const mgr = between(h, "AFFILIATE MANAGER", "</aside>") || "";
    const mname = text(decode((mgr.match(/<b>([^<]*)<\/b>/) || [])[1] || "")), memail = (mgr.match(/mailto:([^"]+)"/) || [])[1] || null;
    const table = between(h, '<table class="advertiser-single__table">', "</table>") || "";
    const kv = {};
    for (const m of table.matchAll(/<th>([^<]*)<\/th>\s*<td>([\s\S]*?)<\/td>/g)) kv[text(m[1]).replace(/:$/, "")] = text(decode(m[2]).replace(/<[^>]+>/g, " "));
    const about = between(h, "<h2>O inzerentovi</h2>", "<h3>Podmínky") || "";
    const tiers = [...about.matchAll(/PROVIZE([^:<]*):\s*([^<]+)/g)].map((m) => ({ channel: text(m[1]).replace(/^pro\s+/, "") || "base", value: text(m[2]) }));
    const desc = text(decode(about.replace(/<p>\s*PROVIZE[\s\S]*$/, "").replace(/<\/(p|li)>|<br\s*\/?>/g, " · ").replace(/<[^>]+>/g, " "))).replace(/(\s*·\s*){2,}/g, " · ").replace(/^(\s*·\s*)+|(\s*·\s*)+$/g, "");
    const comm = kv["Provize"] || "";
    const pct = [...comm.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)].map((m) => parseFloat(m[1].replace(",", ".")));
    const allPct = pct.concat(tiers.flatMap((t) => [...t.value.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)].map((m) => parseFloat(m[1].replace(",", ".")))));
    const czk = comm.match(/(\d[\d\s]*)\s*Kč/);
    const cookie = (kv["Délka cookies"] || "").match(/(\d+)/);
    const flag = (k) => (kv[k] ? (/✅/.test(kv[k]) ? true : /❌/.test(kv[k]) ? false : kv[k]) : undefined);
    const site = name.includes(".") && !/\s/.test(name) ? name.toLowerCase() : null;
    return {
      program_name: name, domain: site || `vivnetworks.${url.split("/").filter(Boolean).pop()}`, landing_url: site ? `https://${site}` : null, signup_url: url, logo_url: meta(h, "og:image") || null,
      description: desc.replace(/^O inzerentovi\s*·?\s*/, "").slice(0, 4000) || null, network: "VIVnetworks",
      commission: [comm && `base ${comm}`, ...tiers.filter((t) => t.channel !== "base").map((t) => `${t.channel}: ${t.value}`)].filter(Boolean).join("; ") || null,
      commission_type: pct.length || allPct.length ? "CPS" : czk ? "CPA" : null,
      pct_min: allPct.length ? Math.min(...allPct) : null, pct_max: allPct.length ? Math.max(...allPct) : null,
      flat_min: czk ? parseInt(czk[1].replace(/\s/g, ""), 10) : null, flat_max: czk ? parseInt(czk[1].replace(/\s/g, ""), 10) : null, currency: czk ? "CZK" : null,
      cookie_days: cookie ? +cookie[1] : null, cookie_length_raw: kv["Délka cookies"] || null,
      managers: mname ? [{ name: mname, email: memail, role: "Affiliate manager" }] : null,
      tags: cat ? [cat.toLowerCase()] : [],
      extra: { category: cat || undefined, tiers: tiers.length ? tiers : undefined, sem: flag("SEM"), sem_brand: flag("SEM na brand"), xml_feed: flag("XML Feed"), coupon_portals: flag("Slevové portály"), s2s: flag("S2S tracking"), cashback_portals: flag("Cashback portály"), own_creatives: flag("Vlastní kreativy"), domain_redirect: flag("Přesměrování domény") },
    };
  },
};
