// aff.studio/directory/affiliate-program/<slug> — ~785 iGaming programme profiles: a labelled
// details grid (commission type/details, payout frequency, min payout, admin fee, negative
// balance, cookie, licence, founded, software, branded traffic, NGR formula), target GEOs,
// brands, house grade, rating + review count, verification date, the programme's own site.
const { text, between, decode, host } = require("./_common");
module.exports = {
  name: "aff_studio", lang: "en", region: "global", base: "https://aff.studio",
  async list(af) {
    const r = await af.get(`${this.base}/sitemap.xml`, { tries: 2 });
    return [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/aff\.studio\/directory\/affiliate-program\/([a-z0-9-]+))<\/loc>/g)].map((m) => ({ url: m[1], slug: m[2] }));
  },
  parse(html, url) {
    const h = String(html);
    const name = text(between(h, "<h1", "</h1>").replace(/^<h1[^>]*>/, ""));
    if (!name) throw new Error("no name");
    const head = between(h, "<h1", 'id="claim"');
    const site = (head.match(/<a href="(https?:\/\/(?!aff\.studio)[^"]+)"[^>]*rel="[^"]*nofollow/) || [])[1] || null;
    const chips = [...head.matchAll(/capitalize text-foreground">([^<]+)</g)].map((m) => text(m[1]));
    const grade = text((head.match(/aria-haspopup="dialog"[^>]*>([^<]{2,20})<\/button>/) || [])[1] || "");
    const grid = Object.fromEntries([...h.matchAll(/uppercase tracking-wider text-muted-foreground mb-0\.5">([^<]*)<\/p>\s*<p class="[^"]*">([^<]*)</g)].map((m) => [text(m[1]), text(m[2])]));
    const rating = (text(h).match(/([\d.]+)\s*·\s*(\d+)\s*reviews?/) || []);
    const verified = (h.match(/Verified <!-- -->([A-Z][a-z]{2} \d{4})/) || h.match(/Verified\s+([A-Z][a-z]{2} \d{4})/) || [])[1] || null;
    const geos = [...between(h, "Target GEOs</p>", "</div>").matchAll(/>([^<>]{2,40})<\/span>/g)].map((m) => text(m[1])).filter(Boolean);
    const brands = [...between(h, "Brands in the program", "Reports (").matchAll(/View brand details/g)].length;
    const brandNames = [...between(h, "Brands</p>", "</div>").matchAll(/>([^<>]{2,60})<\/span>/g)].map((m) => text(m[1]));
    const highlights = text(between(h, "Program Highlights", "Program Details").replace(/^[^>]*>/, "").replace(/<\/(p|li|h\d)>/g, " · ")).replace(/^Program Highlights\s*·?\s*/, "");
    const details = grid["Commission Details"] || "";
    const pct = details.match(/RevShare\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?\s*%/i), cpa = details.match(/CPA\s*(\d+)\s*(USD|EUR|\$|€)/i);
    const types = (grid["Commission Type"] || "").split(/\s*,\s*/).map((t) => t.replace(/\s*Available$/i, "")).filter(Boolean);
    const cookie = (grid["Cookie Duration"] || "").match(/(\d+)\s*day/), founded = (grid["Founded"] || "").match(/(\d{4})/);
    const minp = grid["Min Payout"] || null;
    return {
      program_name: name, domain: site ? host(site) : `affstudio.${url.split("/").pop()}`, landing_url: site, signup_url: url,
      description: highlights.slice(0, 3000) || null, vertical: chips[0] || "iGaming", categories: chips.length ? chips : null,
      commission: details || null, commission_type: types.join(", ") || null, commission_types: types.length ? types : null,
      pct_min: pct ? +pct[1] : null, pct_max: pct ? +(pct[2] || pct[1]) : null, flat_max: cpa ? +cpa[1] : null, currency: cpa ? (cpa[2] === "$" ? "USD" : cpa[2] === "€" ? "EUR" : cpa[2].toUpperCase()) : null,
      payment_frequency: grid["Payout Frequency"] || null, min_payment_raw: minp, tracking_software: grid["Software"] || null,
      cookie_days: cookie ? +cookie[1] : null, cookie_length_raw: grid["Cookie Duration"] || null, established_year: founded ? +founded[1] : null,
      geo: geos.join(", ").slice(0, 600) || null, rating_avg: rating[1] ? parseFloat(rating[1]) : null, rating_count: rating[2] ? +rating[2] : null,
      extra: { details: grid, house_grade: grade || undefined, verified: verified || undefined, brands: brandNames.length ? brandNames : undefined, brands_count: brands || undefined, rating_scale: 5 },
    };
  },
};
