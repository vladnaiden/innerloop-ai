// linkclicky.com/affiliate-program/<slug>/ — ~1,750 programmes (mostly US/CA consumer + SaaS):
// website, niches, affiliate platform (network), regions, commission, official join link.
// The "How can I join" steps are template text and are NOT stored as description.
const { text, decode, host, pctRange } = require("./_common");
module.exports = {
  name: "linkclicky", lang: "en", region: "US", base: "https://linkclicky.com",
  async list(af) {
    const out = [];
    for (let n = 1; n <= 20; n++) {
      let r; try { r = await af.get(`${this.base}/affiliate-program-sitemap${n}.xml`, { tries: 2 }); } catch (e) { if (/HTTP 404/.test(e.message)) break; throw e; }
      const locs = [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/linkclicky\.com\/affiliate-program\/([a-z0-9-]+)\/)<\/loc>/g)];
      if (!locs.length) break;
      for (const m of locs) if (m[2] !== "feed") out.push({ url: m[1], slug: m[2] });
    }
    return out;
  },
  parse(html, url) {
    const h = String(html);
    const name = text((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "").replace(/\s+Affiliate Program$/i, "");
    if (!name) throw new Error("no name");
    const table = (h.match(/affiliate_program_features[\s\S]*?<\/table>/) || [])[0] || "";
    const kv = {};
    for (const m of table.matchAll(/<tr><td><strong>([^<]+)<\/strong>:?<\/td><td>([\s\S]*?)<\/td><\/tr>/g)) kv[text(m[1])] = text(decode(m[2]).replace(/<[^>]+>/g, ""));
    const site = (table.match(/<strong>Website<\/strong>:?<\/td><td><a href="([^"]+)"/) || [])[1] || null;
    const joinRaw = (h.match(/wp-block-kadence-singlebtn"[^>]*href="([^"]+)"[^>]*>\s*<span class="kt-btn-inner-text">Join Now/) || [])[1] || null;
    const join = joinRaw ? decode(joinRaw).replace(/[?&]utm_[^&]*/g, "").replace(/\?$/, "") : null;
    const logo = (h.match(/<img[^>]+src="([^"]+)"[^>]+alt="[^"]*Affiliate Program"/) || [])[1] || null;
    const niches = [...table.matchAll(/affiliate-programs\/[a-z0-9-]+\/">([^<]+)<\/a>/g)].map((m) => text(m[1]));
    const commRaw = kv["Commission"] || "";
    const comm = [...new Set(commRaw.split(/\s*,\s*/).filter(Boolean))].join(", ");
    const pct = /%/.test(comm) ? pctRange(comm) : {};
    const flat = comm.match(/\$\s*([\d,]+(?:\.\d+)?)/);
    const platform = kv["Affiliate Platform"] || null;
    const d = site ? host(site) : null;
    return {
      program_name: name, domain: d || `linkclicky.${url.split("/").filter(Boolean).pop()}`, landing_url: site || null, signup_url: join || site || url, logo_url: logo,
      network: platform && !/^(in-house|direct|none)$/i.test(platform) ? platform : null,
      commission: comm || null,
      commission_type: /per sale/i.test(comm) ? "CPS" : /per lead|per signup/i.test(comm) ? "CPL" : /%/.test(comm) ? "CPS" : /\$/.test(comm) ? "CPA" : null,
      pct_min: pct.pct_min ?? null, pct_max: pct.pct_max ?? null, flat_min: flat ? parseFloat(flat[1].replace(/,/g, "")) : null, flat_max: flat ? parseFloat(flat[1].replace(/,/g, "")) : null, currency: flat ? "USD" : null,
      tags: niches.map((n) => n.toLowerCase()),
      extra: { regions: kv["Regions"] ? kv["Regions"].split(/\s*,\s*/) : undefined, platform: platform || undefined, terms: kv },
    };
  },
};
