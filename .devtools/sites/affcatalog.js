// affcatalog.com/en/aff-program/<slug> — iGaming affiliate-programme directory (~1,460):
// overview with commission models, a terms table (minimum payout, frequency, negative
// balance, admin fee, software, licence, cookie, conversion window), payment methods,
// brands, target/forbidden GEOs, verticals, rating, contacts (emails kept only when they
// belong to the programme's own domain — the directory's own addresses are boilerplate).
const { text, between, decode, host } = require("./_common");
module.exports = {
  name: "affcatalog", lang: "en", region: "global", base: "https://affcatalog.com", maxChars: 3000000,
  async list(af) {
    // the HTML listing ignores ?page; the site's own public JSON API paginates (49 pages × 30)
    const out = new Map();
    for (let p = 1; p <= 200; p++) {
      let j; try { const r = await af.tool("fetch_url", { url: `https://api.affcatalog.com/api/v1/filters/aff-program?per_page=30&page=${p}`, returnBody: "text", maxChars: 900000, retries: 2, blockRules: ["http-status"] }); j = JSON.parse(r.text || "{}"); } catch { break; }
      const ld = (j.data || {}).listingsData || j.data || {};
      const items = Array.isArray((ld.meta || {}).data) ? ld.meta.data : Array.isArray(ld.data) ? ld.data : Object.values(ld).find(Array.isArray) || [];
      let fresh = 0;
      for (const it of items) { const slug = it.slug || it.alias || (typeof it.url === "string" ? it.url.replace(/\/$/, "").split("/").pop() : null); if (slug && !out.has(slug)) { out.set(slug, { url: `${this.base}/en/aff-program/${slug}/`, slug }); fresh++; } }
      const meta = ld.meta || {}; if (!items.length || !fresh || (meta.last_page && p >= meta.last_page)) break;
      await af.pace(1500);
    }
    return [...out.values()];
  },
  parse(html, url) {
    const h = String(html);
    const name = text(between(h, 'class="profile-info__name"', "</h1>").replace(/^[^>]*>/, "").replace(/<[^>]+>/g, " "));
    if (!name) throw new Error("no name");
    const status = text((h.match(/profile-info__status"[^>]*>([^<]*)</) || [])[1] || "");
    const rating = parseFloat((h.match(/profile-info__rating-value"[^>]*>([\d.]+)</) || [])[1] || ""), reviews = parseInt((h.match(/profile-info__reviews"[^>]*>\((\d+)/) || [])[1] || "", 10);
    const block = (title) => { const i = h.indexOf(`${title}</h2>`); if (i < 0) return ""; const j = h.indexOf('class="information-block', i + 10); return h.slice(i, j > 0 ? j : i + 20000); };
    const spans = (seg) => [...seg.matchAll(/<span data-v-[a-z0-9]+>([^<]{1,60})<\/span>/g)].map((m) => text(m[1])).filter((v, i, a) => v && a.indexOf(v) === i);
    const about = text(block("Program Overview").replace(/^[^>]*>/, "").replace(/<\/(p|li|h\d)>/g, " · ")).replace(/^Program Overview\s*·?\s*/, "").replace(/\s*Streamline daily searches.*$/, "");
    const cond = Object.fromEntries([...h.matchAll(/condition-item__title"[^>]*>([^<]*)<\/div>\s*<div class="condition-item__value"[^>]*>([^<]*)</g)].map((m) => [text(m[1]), text(m[2])]));
    const methods = spans(block("Payment methods"));
    const brands = [...block("Brands").matchAll(/href="\/en\/brands\/([a-z0-9-]+)\/"/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i);
    const panels = [...block("GEOs").matchAll(/<div class="tabs__panel"[^>]*>([\s\S]*?)(?=<div class="tabs__panel"|$)/g)].map((m) => [...m[1].matchAll(/<p data-v-[a-z0-9]+>([^<]+)<\/p>/g)].map((x) => text(x[1])));
    const verticals = spans(between(h, "Verticals:</div>", "</div></div>"));
    const last = (h.match(/Last update:\s*(\d{4}-\d{2}-\d{2})/) || [])[1] || null;
    const tracking = (h.match(/href="(https?:\/\/(?!affcatalog\.com)[^"]+)"[^>]*rel="[^"]*(?:nofollow|sponsored)/) || [])[1] || null;
    const brandTok = name.toLowerCase().replace(/partners?|affiliates?|program|\s/g, "").slice(0, 5);
    const emails = [...new Set([...h.matchAll(/mailto:([^"?]+)/g)].map((m) => decode(m[1]).toLowerCase()))].filter((e) => !/affcatalog/.test(e) && brandTok.length >= 3 && e.includes(brandTok));
    const pct = (cond["RevShare"] || "").match(/(\d{1,3})\s*%/), cpa = (cond["CPA"] || "").match(/(\d+)\s*(USD|EUR|\$)/i);
    const models = Object.keys(cond).filter((k) => /^(RevShare|CPA|Hybrid|CPL|CPS|Sub-Affiliate)$/.test(k) && cond[k] && !/^(no|none|-)$/i.test(cond[k]));
    const cookie = (cond["Cookies expiration date"] || "").match(/(\d+)\s*day/);
    const founded = (cond["Founded"] || "").match(/(\d{4})/);
    return {
      program_name: name, domain: `affcatalog.${url.replace(/\/$/, "").split("/").pop()}`, landing_url: null, signup_url: url,
      logo_url: (h.match(/<meta property="og:image" content="([^"]+)"/) || [])[1] || null, description: about.slice(0, 3000) || null,
      vertical: verticals[0] || "iGaming", categories: verticals.length ? verticals : null,
      commission: models.map((k) => `${k}: ${cond[k]}`).join("; ").slice(0, 300) || null,
      commission_type: models.join(", ") || null, commission_types: models.length ? models : null,
      pct_max: pct ? +pct[1] : null, flat_max: cpa ? +cpa[1] : null, currency: cpa ? (cpa[2] === "$" ? "USD" : cpa[2].toUpperCase()) : null,
      min_payment_raw: cond["Minimum payout"] || null, payment_frequency: cond["Payout frequency"] || null, tracking_software: cond["Software"] || null,
      cookie_days: cookie ? +cookie[1] : null, cookie_length_raw: cond["Cookies expiration date"] || null, established_year: founded ? +founded[1] : null,
      payment_methods: methods.length ? methods : null, geo: (panels[0] || []).join(", ").slice(0, 600) || null,
      rating_avg: Number.isFinite(rating) && reviews ? rating : null, rating_count: reviews || null, source_updated: last,
      contact_email: emails[0] || null, contact_emails: emails.length ? emails : null,
      extra: { status: status || undefined, conditions: cond, brands: brands.length ? brands : undefined, forbidden_geos: (panels[1] || []).join(", ").slice(0, 600) || undefined, tracking_link: tracking || undefined, rating_scale: 5 },
    };
  },
};
