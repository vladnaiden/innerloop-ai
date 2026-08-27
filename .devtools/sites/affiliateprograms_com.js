// affiliateprograms.com/p/<slug> — editorial directory (~300 programmes): base commission,
// payment frequency/type, accepted countries, review text.
const { text, between, ldjson, pctRange } = require("./_common");
module.exports = {
  name: "affiliateprograms_com", lang: "en", region: "global", base: "https://affiliateprograms.com",
  async list(af) {
    const r = await af.get(`${this.base}/program-sitemap.xml`, { tries: 2 });
    return [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/affiliateprograms\.com\/p\/([a-z0-9-]+)\/)<\/loc>/g)].map((m) => ({ url: m[1], slug: m[2] }));
  },
  parse(html, url) {
    const h = String(html);
    const graph = ldjson(h).flatMap((j) => j["@graph"] || [j]);
    const page = graph.find((g) => g["@type"] === "WebPage") || {};
    const name = (page.name || text(between(h, "<h1", "</h1>").replace(/^<h1[^>]*>/, ""))).replace(/\s+Affiliate Program.*$/i, "").replace(/\s*\|.*$/, "");
    const det = Object.fromEntries([...between(h, 'class="program-details"', "</table>").matchAll(/<td><strong>([^<]*)<\/strong[^>]*>\s*<td>([\s\S]*?)<\/td>/g)].map((m) => [text(m[1]), text(m[2])]));
    const learn = (h.match(/href="([^"]+)"[^>]*class="learn-more"/) || [])[1] || null;
    const base = det["Base Commission"] || null;
    const pct = base && /%/.test(base) ? pctRange(base) : {};
    const desc = text(between(h, "Overview</h2>", "</p>").replace(/^[^>]*>/, ""));
    return {
      program_name: name || null, domain: learn && !/affiliateprograms\.com/.test(learn) ? new URL(learn).hostname.replace(/^www\./, "") : `apc.${url.replace(/\/$/, "").split("/").pop()}`,
      signup_url: url, landing_url: learn && !/affiliateprograms\.com/.test(learn) ? learn : null, logo_url: page.thumbnailUrl || null,
      description: desc || page.description || null, commission: base, pct_min: pct.pct_min ?? null, pct_max: pct.pct_max ?? null,
      commission_type: base ? (/%/.test(base) ? "CPS" : "CPA") : null, payment_frequency: det["Payment Frequency"] || null,
      payment_methods: det["Payment Type"] ? det["Payment Type"].split(/\s*,\s*/) : null, geo: det["Accepted Countries"] || null,
      source_updated: (page.dateModified || page.datePublished || "").slice(0, 10) || null,
      extra: { details: det },
    };
  },
};
