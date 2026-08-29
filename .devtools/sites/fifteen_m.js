// 15m.com/affiliate-programs/<slug>/ — 15M (iGaming media) programme reviews: overview grid
// (verticals, traffic sources, commission models, sub-affiliate, languages, min payout, founded,
// GEOs, cookie duration, support), licence, contact email, tracked sign-up link, RevShare / CPA
// prose with explicit % ranges, teaser. Listing: public WP REST API (post type affiliate_programs),
// English links only (the /ru/ copies are translations of the same records).
const { text, decode, between, meta } = require("./_common");
module.exports = {
  name: "fifteen_m", lang: "en", region: "global", base: "https://15m.com",
  async list(af) {
    const out = [];
    for (let p = 1; p <= 30; p++) {
      let r; try { r = await af.get(`${this.base}/wp-json/wp/v2/affiliate_programs?per_page=100&page=${p}&_fields=slug,link`, { tries: 1, maxChars: 900000 }); } catch (e) { break; }
      let a = []; try { a = JSON.parse(r.html || r.text || "[]"); } catch (e) { break; }
      if (!Array.isArray(a) || !a.length) break;
      for (const x of a) if (x.link && !/\/ru\//.test(x.link)) out.push({ url: x.link.replace(/\\\//g, "/"), slug: x.slug });
      await af.pace(800);
    }
    return out;
  },
  urlFor(slug) { return `${this.base}/affiliate-programs/${slug}/`; },
  parse(html, url) {
    const h = String(html);
    const title = text(decode((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "").replace(/<[^>]+>/g, " "));
    const name = text((h.match(/ui-breadcrumbs__current"[^>]*>([^<]*)</) || [])[1] || "") || title.replace(/\s+Review.*$/i, "").replace(/\s+Affiliate Program.*$/i, "");
    if (!name) throw new Error("no name");
    const kv = {};
    for (const m of h.matchAll(/<div class="overview__label[^"]*">([^<]*)<\/div>\s*<ul class="overview__value[^"]*">([\s\S]*?)<\/ul>/g)) kv[text(m[1])] = [...m[2].matchAll(/ui-btn__primary">([^<]*)</g)].map((x) => text(x[1])).filter(Boolean);
    const rows = {}; for (const m of h.matchAll(/rating-row_item_label">([^<]*)<\/div>\s*<div class="rating-row_item_value">([\s\S]*?)<\/div>\s*<\/div>/g)) { const v = text(decode(m[2]).replace(/<[^>]+>/g, " ")); if (v) rows[text(m[1])] = v; }
    const email = (h.match(/href="mailto:([^"]+)"/) || [])[1] || null;
    const signup = (h.match(/href="(https:\/\/goto\.15m\.com[^"]+)"/) || [])[1] || null;
    const sect = (icon) => { const m = h.match(new RegExp(`<i class="ph-bold ${icon}"[^>]*><\\/i>\\s*([^<]*)<\\/h3>\\s*<div class="overview-content__value">([\\s\\S]*?)<\\/div>`)); return m ? text(decode(m[2]).replace(/<[^>]+>/g, " ")) : ""; };
    const rs = sect("ph-percent"), cpa = sect("ph-target");
    const pct = [...rs.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => +m[1]);
    const teaser = meta(h, "og:description") || "";
    const desc = text(decode((between(h, "About " + name, "<h2") || "").replace(/<\/(p|li)>|<br\s*\/?>/g, " · ").replace(/<[^>]+>/g, " "))).replace(new RegExp("^About " + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*"), "").replace(/(\s*·\s*){2,}/g, " · ").replace(/^(\s*·\s*)+|(\s*·\s*)+$/g, "");
    const models = kv["Commission Models"] || [];
    const minp = (kv["Min Payout"] || [])[0] || "", mn = minp.match(/(\$|€|£)\s*([\d,]+)/);
    const cookie = ((kv["Cookie Duration"] || [])[0] || "").match(/(\d+)\s*Day/i);
    const founded = ((kv["Founded"] || [])[0] || "").match(/^\d{4}$/);
    return {
      program_name: name, domain: `15m.${url.split("/").filter(Boolean).pop()}`, signup_url: signup || url, contact_email: email, logo_url: (h.match(/property="og:image(?::secure_url)?" content="([^"]+)"/) || [])[1] || null,
      description: [teaser, desc].filter(Boolean).join(" · ").slice(0, 4000) || null,
      commission: [rs && `RevShare: ${rs}`, cpa && `CPA: ${cpa}`].filter(Boolean).join(" | ").slice(0, 600) || null,
      commission_type: models.length > 1 ? "Hybrid" : /revenue share|revshare/i.test(models[0] || "") ? "RevShare" : /cpa/i.test(models[0] || "") ? "CPA" : null,
      commission_types: models.length ? models : null, recurring: models.some((m) => /revenue share|revshare/i.test(m)) ? true : null,
      pct_min: pct.length ? Math.min(...pct) : null, pct_max: pct.length ? Math.max(...pct) : null,
      min_payout: mn ? parseInt(mn[2].replace(/,/g, ""), 10) : null, min_payment_raw: minp || null, currency: mn ? { "$": "USD", "€": "EUR", "£": "GBP" }[mn[1]] : null,
      cookie_days: cookie ? +cookie[1] : null, cookie_length_raw: (kv["Cookie Duration"] || [])[0] || null,
      established_year: founded ? +founded[0] : null,
      tags: ["igaming", ...(kv["Verticals"] || []).map((v) => v.toLowerCase())],
      extra: { verticals: kv["Verticals"], traffic_sources: kv["Traffic Sources"], sub_affiliate: (kv["Sub-affiliate"] || [])[0], languages: (kv["Languages"] || [])[0], geos: (kv["GEOs"] || [])[0], support: (kv["Support"] || [])[0], licence: rows["License"], review_title: title },
    };
  },
};
