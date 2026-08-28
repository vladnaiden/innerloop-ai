// statsdrone.com/affiliate-programs/<slug>/ — 3,637 iGaming affiliate programmes reviewed by
// StatsDrone: labelled review sections (Commission Details, Carryover Policy, CPA,
// Sub-affiliates, Game Types…), tracking software + which stats it exposes, brands with
// sites, contact card (email/phone/Telegram — usually blank), join link.
// Commission numbers are only stored when the review states them explicitly.
const { text, decode, host, meta, pctRange } = require("./_common");
module.exports = {
  name: "statsdrone", lang: "en", region: "global", base: "https://statsdrone.com",
  async list(af) {
    const r = await af.get(`${this.base}/program-sitemap.xml`, { tries: 2 });
    return [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/statsdrone\.com\/affiliate-programs\/([a-z0-9-]+)\/)<\/loc>/g)].map((m) => ({ url: m[1], slug: m[2] }));
  },
  parse(html, url) {
    const h = String(html);
    const name = text((h.match(/<h1 class="program-review-title">([\s\S]*?)<\/h1>/) || [])[1] || "").replace(/\s+Review$/i, "");
    if (!name) throw new Error("no name");
    const join = (h.match(/<a href="([^"]+)" class="join-btn"/) || [])[1] || null;
    const brands = [...h.matchAll(/<div class="brand-details">\s*<h6>([^<]*)<\/h6>\s*(?:<a href="([^"]+)")?/g)].map((m) => ({ name: text(m[1]), url: m[2] || null })).filter((b) => b.name);
    const site = (brands.find((b) => b.url) || {}).url || null;
    const sections = {};
    for (const m of h.matchAll(/<p><strong>([^<]{3,60})<\/strong><\/p>([\s\S]*?)(?=<p><strong>|<h2|<\/section>|<div class="(?:brands|contact))/g)) {
      const v = text(decode(m[2]).replace(/<\/p>/g, " ").replace(/<[^>]+>/g, "")); if (v) sections[text(m[1])] = v.slice(0, 2000);
    }
    const software = (h.match(/<span>Software:<\/span>[\s\S]*?class="d-inline text-decoration-underline">([^<]+)</) || [])[1];
    const stats = [...h.matchAll(/<li class="(existent|non-existent)">([^<]+)<\/li>/g)].filter((m) => m[1] === "existent").map((m) => text(m[2]));
    const contacts = {};
    for (const m of h.matchAll(/contact-detail-item-contacts">\s*<strong>([^<]+)<\/strong>\s*<div>([\s\S]*?)<\/div>/g)) { const v = text(decode(m[2]).replace(/<[^>]+>/g, "")); if (v && v !== "-") contacts[text(m[1])] = v; }
    const comm = sections["Commission Details"] || "";
    const pct = /%/.test(comm) ? pctRange(comm) : {};
    const hasRS = /revenue share|rev ?share/i.test(comm), hasCPA = /\bCPA\b/i.test(comm);
    const desc = Object.entries(sections).map(([k, v]) => `${k}: ${v}`).join("\n\n");
    return {
      program_name: name, domain: site ? host(site) : `statsdrone.${url.split("/").filter(Boolean).pop()}`, landing_url: site, signup_url: join || url,
      logo_url: meta(h, "og:image") || null, description: desc.slice(0, 4000) || null,
      commission: comm ? comm.slice(0, 300) : null, commission_type: hasRS && hasCPA ? "Hybrid" : hasRS ? "RevShare" : hasCPA ? "CPA" : null,
      pct_min: pct.pct_min ?? null, pct_max: pct.pct_max ?? null,
      recurring: hasRS ? true : null, tags: ["igaming"],
      extra: { sections, software: software ? text(software) : undefined, stats_available: stats.length ? stats : undefined, brands: brands.length ? brands : undefined, contacts: Object.keys(contacts).length ? contacts : undefined },
    };
  },
};
