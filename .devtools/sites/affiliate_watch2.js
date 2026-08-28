// affiliate.watch/affiliate/<slug> — 916 programmes. The page is an Inertia app whose
// data-page attribute carries the whole programme record: website, join link, earnings
// teaser, description, minimum payout, cookie days, launch year, socials, AI rating /100,
// two-tier flag, payment methods, categories, tags. Replaces the thin legacy adapter.
const { decode, text, host, pctRange } = require("./_common");
const dec = (s) => decode(decode(String(s || "")));
module.exports = {
  name: "affiliate_watch2", lang: "en", region: "global", base: "https://affiliate.watch",
  async list(af) {
    const r = await af.get(`${this.base}/sitemap.xml`, { tries: 2 });
    return [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/affiliate\.watch\/affiliate\/([a-z0-9-]+))<\/loc>/g)].map((m) => ({ url: m[1], slug: m[2] }));
  },
  parse(html, url) {
    const m = String(html).match(/data-page="([^"]+)"/); if (!m) throw new Error("no data-page");
    const a = (JSON.parse(dec(m[1])).props || {}).affiliate; if (!a || !a.name) throw new Error("no affiliate");
    const soc = { facebook: "https://facebook.com/", twitter: "https://x.com/", youtube: "https://youtube.com/", instagram: "https://instagram.com/", linkedin: "https://linkedin.com/company/", tiktok: "https://tiktok.com/@", telegram: "https://t.me/", medium: "https://medium.com/@", pinterest: "https://pinterest.com/", github: "https://github.com/" };
    const socials = Object.entries(soc).map(([k, p]) => a[`social_${k}`] ? (String(a[`social_${k}`]).startsWith("http") ? a[`social_${k}`] : p + a[`social_${k}`]) : null).filter(Boolean);
    const teaser = dec(a.teaser_affiliate || "");
    const pct = /%/.test(teaser) ? pctRange(teaser) : {}; const usd = teaser.match(/\$\s*([\d,]+(?:\.\d+)?)(?:\s*-\s*\$?\s*([\d,]+(?:\.\d+)?))?/);
    const desc = text(dec(a.description || "").replace(/<\/(p|li|h\d)>/g, " · "));
    return {
      program_name: dec(a.name), domain: a.website ? host(a.website) : `affiliate-watch.${a.slug}`, landing_url: a.website || null,
      signup_url: a.website_affiliate_join || a.website_affiliate || url, logo_url: a.logoUrls && (a.logoUrls.thumb_lg || a.logoUrls.thumb_md) || null,
      description: [dec(a.teaser_company), desc].filter(Boolean).join(" — ").slice(0, 3000) || null,
      commission: teaser || null, pct_min: pct.pct_min ?? null, pct_max: pct.pct_max ?? null,
      flat_min: usd ? parseFloat(usd[1].replace(/,/g, "")) : null, flat_max: usd ? parseFloat((usd[2] || usd[1]).replace(/,/g, "")) : null, currency: usd ? "USD" : null,
      cookie_days: a.cookie_days || null, cookie_length_raw: a.cookie_days ? `${a.cookie_days} days` : null, min_payment_raw: a.minimum_payout ? String(a.minimum_payout) : null,
      established_year: a.launch_year ? parseInt(a.launch_year, 10) || null : null, tier2_pct: a.is_two_tier ? null : null,
      payment_methods: (a.all_payment_methods || []).map((p) => p.name).filter(Boolean),
      categories: (a.categories || []).map((c) => c.name).filter(Boolean), vertical: ((a.categories || [])[0] || {}).name || null,
      tags: (a.tags || []).map((t) => t.name).filter(Boolean).slice(0, 20), socials: socials.length ? socials : null,
      telegram: a.social_telegram || null, rating_avg: a.rating_ai ? parseFloat(a.rating_ai) : null,
      source_updated: (a.updated_at || "").slice(0, 10) || null, tracking_link: a.go || null,
      extra: { rating_scale: 100, rating_kind: "AI rating", two_tier: !!a.is_two_tier, status: a.status, youtube_review: a.youtube_review_id || undefined, aw_id: a.id },
    };
  },
};
