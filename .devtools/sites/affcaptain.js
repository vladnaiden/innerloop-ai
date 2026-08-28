// affcaptain.com — programme reviews (/affiliate-program/<slug>) and network reviews
// (/affiliate-network/<slug>): a details table (base commission, commission type, minimum,
// payment frequency/method, referral commission, tracking software, cookie, GEOs, managers,
// accepted traffic), an editorial rating /5, join link, pros and cons.
const { text, between, ldjson, decode, host, pctRange } = require("./_common");
module.exports = {
  name: "affcaptain", lang: "en", region: "global", base: "https://affcaptain.com",
  async list(af) {
    const out = [];
    for (const sm of ["affiliate-program-sitemap1.xml", "affiliate-program-sitemap2.xml", "affiliate-program-sitemap3.xml", "affiliate-network-sitemap1.xml", "affiliate-network-sitemap2.xml", "affiliate-network-sitemap3.xml"]) {
      let r; try { r = await af.get(`${this.base}/${sm}`, { tries: 1 }); } catch { continue; }
      for (const m of (r.html || r.text || "").matchAll(/<loc>(https:\/\/affcaptain\.com\/(affiliate-program|affiliate-network)\/([a-z0-9-]+)\/)<\/loc>/g)) out.push({ url: m[1], slug: `${m[2] === "affiliate-program" ? "p" : "n"}-${m[3]}` });
      await af.pace(1500);
    }
    return out;
  },
  parse(html, url) {
    const h = String(html).replace(/<svg[\s\S]*?<\/svg>/g, "");
    const kind = /\/affiliate-network\//.test(url) ? "network" : "program";
    const crumbs = (ldjson(h).flatMap((j) => j["@graph"] || [j]).find((g) => g["@type"] === "BreadcrumbList") || {}).itemListElement || [];
    const name = (crumbs.length ? decode(crumbs[crumbs.length - 1].item.name) : text((h.match(/<title>([^<]*?)\s+(?:Review|Affiliate)/) || [])[1] || "")).replace(/\s+Affiliate Program$/i, "");
    if (!name) throw new Error("no name");
    const rows = Object.fromEntries([...h.matchAll(/<tr class="kb-table-row[^"]*">\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g)].map((m) => [text(m[1].replace(/<[^>]+>/g, " ")), text(m[2].replace(/<\/a>\s*,?\s*<a/g, "</a>, <a").replace(/<[^>]+>/g, " ")).replace(/\s+,/g, ",")]).filter(([k, v]) => k && v));
    const rating = parseFloat((h.match(/wp-block-kadence-advancedheading"[^>]*>\s*([0-5](?:\.\d)?)\s*<\/p>\s*<div class="kb-progress-bar-container/) || [])[1] || "");
    const join = (h.match(/href="(https?:\/\/[^"]+)"[^>]*>\s*<span class="kt-btn-inner-text">Join Now/) || [])[1] || null;
    const external = join && !/affcaptain\.com/.test(join) ? join : null;
    const pros = [...between(h, ">Pros<", ">Cons<").matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1])).filter(Boolean);
    const cons = [...between(h, ">Cons<", "</ul>").matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1])).filter(Boolean);
    const cats = [...h.matchAll(/href="https:\/\/affcaptain\.com\/(?:category|major-categories|categories)\/[^"]+"[^>]*>([^<]+)</g)].map((m) => text(m[1])).filter((v, i, a) => v && a.indexOf(v) === i);
    const comm = rows["Base Commission"] || "", pct = /%/.test(comm) ? pctRange(comm) : {}, usd = comm.match(/\$\s*([\d,]+(?:\.\d+)?)/);
    const types = (rows["Commission Type"] || "").split(/\s*,\s*/).map((t) => t.replace(/\s*\(.*\)$/, "")).filter(Boolean);
    const cookie = (rows["Cookie Length"] || "").match(/(\d+)/), minp = rows["Minimum Payment"] || rows["Minimum Payout"] || null;
    const methods = (rows["Payment Method"] || "").split(/\s*,\s*/).filter(Boolean);
    const geos = (rows["Top GEO's"] || rows["Top GEOs"] || rows["Top GEO’s"] || "").split(/\s*,\s*/).filter(Boolean);
    const site = external ? external.split("?")[0] : null;
    return {
      program_name: name, domain: site ? host(site) : `affcaptain.${url.replace(/\/$/, "").split("/").pop()}`, landing_url: null, signup_url: external || url,
      description: [pros.length ? `Pros: ${pros.join("; ")}` : "", cons.length ? `Cons: ${cons.join("; ")}` : ""].filter(Boolean).join(" · ").slice(0, 3000) || null,
      vertical: cats[0] || (rows["Major Categories"] || "").split(/\s*,\s*/)[0] || null, categories: cats.length ? cats : (rows["Major Categories"] ? rows["Major Categories"].split(/\s*,\s*/) : null),
      commission: comm || null, commission_type: types.join(", ") || null, commission_types: types.length ? types : null,
      pct_min: pct.pct_min ?? null, pct_max: pct.pct_max ?? null, flat_min: usd ? parseFloat(usd[1].replace(/,/g, "")) : null, flat_max: usd ? parseFloat(usd[1].replace(/,/g, "")) : null, currency: usd ? "USD" : null,
      min_payment_raw: minp && !/set by/i.test(minp) ? minp : null, payment_frequency: rows["Payment Frequency"] || null, payment_methods: methods.length ? methods : null,
      referral_commission: rows["Referral Commission"] && !/^N\/A$/i.test(rows["Referral Commission"]) ? rows["Referral Commission"] : null, tracking_software: rows["Tracking Software"] || null,
      cookie_days: cookie ? +cookie[1] : null, cookie_length_raw: rows["Cookie Length"] || null, geo: geos.join(", ") || null,
      affiliate_managers: rows["Affiliate Managers"] && !/dedicated manager/i.test(rows["Affiliate Managers"]) ? rows["Affiliate Managers"] : null,
      rating_avg: Number.isFinite(rating) ? rating : null,
      extra: { kind, details: rows, pros: pros.length ? pros : undefined, cons: cons.length ? cons : undefined, accepted_traffic: rows["Accepted Traffic"] || undefined, support: rows["Affiliate Support"] || undefined, rating_scale: 5, rating_kind: "editorial", redirect_link: join && !external ? join : undefined },
    };
  },
};
