// topranked.io/all-listings/<slug>/ — TopRanked.io affiliate-programme directory: ~310 listings
// with a headline commission teaser ("Earn 30% Rev Share"), category, review count, official
// affiliate-registration link, merchant link (tracked redirect — not stored as a domain), programme
// overview, editorial review sections. Listing: listing-sitemapN.xml.
const { text, decode, between, host } = require("./_common");
module.exports = {
  name: "topranked", lang: "en", region: "global", base: "https://topranked.io",
  async list(af) {
    const out = [];
    for (let n = 1; n <= 10; n++) {
      let r; try { r = await af.get(`${this.base}/listing-sitemap${n}.xml`, { tries: 2, maxChars: 3000000 }); } catch (e) { if (/HTTP 404/.test(e.message)) break; throw e; }
      const locs = [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/topranked\.io\/all-listings\/([a-z0-9-]+)\/)<\/loc>/g)];
      if (!locs.length) break;
      for (const m of locs) out.push({ url: m[1], slug: m[2] });
    }
    return out;
  },
  urlFor(slug) { return `${this.base}/all-listings/${slug}/`; },
  parse(html, url) {
    const h = String(html);
    const head = text(decode((h.match(/<h1 class="category-block__heading">([\s\S]*?)<\/h1>/) || [])[1] || ""));
    if (!head) throw new Error("no heading");
    const [rawName, ...rest] = head.split(/\s*[|:–-]\s*(?=Earn|Get|Join|Up to|\d)/i);
    const name = rawName.replace(/\s+(Affiliate Program|Affiliates?|Partners? Program|Program)\b.*$/i, "").trim() || rawName.trim();
    const teaser = rest.join(" ").trim();
    const cat = text((h.match(/category-block__tag">([^<]*)</) || [])[1] || "");
    const reviews = (h.match(/<span>(\d+) Reviews?<\/span>/) || [])[1];
    const signup = (h.match(/href="([^"]+)"[^>]*>\s*<span class="btn__label">Affiliate Registration/) || [])[1] || null;
    const merchant = (h.match(/href="([^"]+)"[^>]*>\s*<span class="btn__label">Merchant Website/) || [])[1] || null;
    const overview = text(decode((between(h, "Program Overview</h2>", "</div></div>") || "").replace(/<[^>]+>/g, " ")));
    const body = between(h, "Program Overview</h2>", "<footer") || "";
    const sections = [...body.matchAll(/<h[23][^>]*>([^<]{3,80})<\/h[23]>\s*([\s\S]*?)(?=<h[23]|<footer)/g)].map((m) => [text(m[1]), text(decode(m[2]).replace(/<[^>]+>/g, " ")).slice(0, 1500)]).filter(([, v]) => v);
    const commText = (sections.find(([k]) => /commission|payment/i.test(k)) || [])[1] || teaser;
    const pct = [...(teaser + " " + commText).matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => +m[1]);
    const flat = (teaser.match(/\$\s*([\d,]+(?:\.\d+)?)/) || [])[1];
    const rs = /rev(?:enue)? ?share|lifetime commission/i.test(teaser + " " + commText);
    const direct = signup && !/redirect|\/go\/|track|\?a=|aff|pid=/i.test(signup) ? host(signup) : null;
    return {
      program_name: name, domain: direct || `topranked.${url.split("/").filter(Boolean).pop()}`, signup_url: signup || url,
      description: [overview.replace(/^Program Overview\s*/, ""), ...sections.map(([k, v]) => `${k}: ${v}`)].filter(Boolean).join(" · ").slice(0, 4000) || null,
      commission: teaser || null, commission_type: rs ? (flat ? "Hybrid" : "RevShare") : /per (lead|application|signup)|CPL/i.test(teaser) ? "CPL" : pct.length ? "CPS" : flat ? "CPA" : null,
      pct_min: pct.length ? Math.min(...pct) : null, pct_max: pct.length ? Math.max(...pct) : null, flat_max: flat ? parseFloat(flat.replace(/,/g, "")) : null, currency: flat ? "USD" : null,
      recurring: rs ? true : null, rating_count: reviews ? +reviews : null,
      tags: cat ? [cat.toLowerCase()] : [],
      extra: { category: cat || undefined, merchant_link: merchant || undefined, headline: head },
    };
  },
};
