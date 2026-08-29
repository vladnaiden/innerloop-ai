// leadpanda.media/partner/<slug>/ — Lead Panda Media (UA arbitrage portal) network reviews:
// ~150 profiles in Ukrainian with short description, rating /5 + review count, the network's own
// site (first content link with the review UTM), categories, payment models mentioned in the text.
// Listing: /partner-cat/all/page/N/ until no new slug.
const { text, decode, between, host } = require("./_common");
module.exports = {
  name: "leadpanda", lang: "uk", region: "UA", base: "https://leadpanda.media",
  async list(af) {
    const out = new Map(); let stale = 0;
    for (let p = 1; p <= 40 && stale < 2; p++) {
      let r; try { r = await af.get(p === 1 ? `${this.base}/partner-cat/all/` : `${this.base}/partner-cat/all/page/${p}/`, { tries: 2 }); } catch (e) { if (/HTTP 404/.test(e.message)) break; throw e; }
      const slugs = [...new Set([...(r.html || r.text || "").matchAll(/leadpanda\.media\/partner\/([a-z0-9-]+)\//g)].map((m) => m[1]))];
      const fresh = slugs.filter((s) => !out.has(s)); stale = fresh.length ? 0 : stale + 1;
      for (const s of fresh) out.set(s, { url: `${this.base}/partner/${s}/`, slug: s });
      await af.pace(1200);
    }
    return [...out.values()];
  },
  urlFor(slug) { return `${this.base}/partner/${slug}/`; },
  parse(html, url) {
    const h = String(html);
    const name = text(decode((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || ""));
    if (!name) throw new Error("no name");
    const short = text(decode((h.match(/class="grid-short-desc">[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/) || [])[1] || "").replace(/<[^>]+>/g, " "));
    const sc = h.match(/<div class="score">([\d.]+)\s*\((\d+)\)/);
    const content = between(h, '<div class="post-content-styles">', "</article>") || between(h, '<div class="post-content-styles">', 'class="comments') || "";
    const site = (content.match(/href="(https?:\/\/(?!leadpanda\.media)[^"]+)"/) || [])[1] || null;
    const cats = [...new Set([...h.matchAll(/leadpanda\.media\/partner-cat\/([a-z0-9-]+)\//g)].map((m) => m[1]).filter((c) => c !== "all"))];
    const desc = text(decode(content.replace(/<\/(p|li|h\d)>|<br\s*\/?>/g, " · ").replace(/<[^>]+>/g, " "))).replace(/(\s*·\s*){2,}/g, " · ").replace(/^(\s*·\s*)+|(\s*·\s*)+$/g, "");
    const models = [...new Set((desc.match(/\b(CPA|CPL|CPS|CPI|RevShare|Rev ?Share|Hybrid|SOI|DOI|PPS|CPM)\b/g) || []).map((m) => m.replace(/\s/g, "")))];
    const s = site ? site.replace(/\?utm_source=leadpandamediareview.*$/, "") : null;
    return {
      program_name: name, domain: s ? host(s) : `leadpanda.${url.split("/").filter(Boolean).pop()}`, landing_url: s, signup_url: s || url,
      description: [short, desc].filter(Boolean).join(" · ").slice(0, 4000) || null,
      rating_avg: sc ? +sc[1] : null, rating_count: sc ? +sc[2] : null,
      commission_types: models.length ? models : null, recurring: models.some((m) => /revshare/i.test(m)) ? true : null,
      tags: cats, extra: { models_mentioned: models.length ? models : undefined },
    };
  },
};
