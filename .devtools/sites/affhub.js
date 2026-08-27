// affhub.media/affiliates/<slug> — Ukrainian media's catalogue of affiliate programmes:
// a short profile (bullets), the programme's site and a Telegram contact.
const { text, between, ldjson } = require("./_common");
module.exports = {
  name: "affhub", lang: "ru", region: "UA", base: "https://affhub.media",
  async list(af) {
    const r = await af.get(`${this.base}/affiliates-sitemap.xml`, { tries: 2 });
    return [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/affhub\.media\/affiliates\/([a-z0-9_-]+)\/)<\/loc>/g)].map((m) => ({ url: m[1], slug: m[2] }));
  },
  parse(html, url) {
    const h = String(html);
    const name = text(between(h, '<h1 class="title-article">', "</h1>").replace(/^[^>]*>/, ""));
    const site = (between(h, 'class="link-partners"', "</span>").match(/href="(https?:\/\/[^"]+)"/) || [])[1] || null;
    const body = between(h, 'class="article_text"', 'class="article-bottom-panel"').replace(/^[^>]*>/, "");
    const desc = text(body.replace(/<\/p>|<\/h3>/g, " · "));
    const tg = (body.match(/href="(https?:\/\/(?:t\.me|telegram\.me)\/[^"]+)"/) || [])[1] || null;
    const graph = ldjson(h).flatMap((j) => j["@graph"] || [j]);
    const page = graph.find((g) => g["@type"] === "WebPage") || {};
    const verticals = [...h.matchAll(/href="https:\/\/affhub\.media\/(?:ru\/|ua\/)?partners-tag\/([a-z0-9-]+)\/?"/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i);
    return {
      program_name: name || null, domain: site ? new URL(site).hostname.replace(/^www\./, "") : `affhub.${url.replace(/\/$/, "").split("/").pop()}`,
      signup_url: url, landing_url: site, logo_url: page.thumbnailUrl || null, description: desc.slice(0, 2000).replace(/\s*·\s*$/, "") || null,
      telegram: tg ? tg.split("/").pop() : null, contacts: tg ? [{ type: "telegram", value: tg }] : null,
      tags: verticals.length ? verticals : null, source_updated: page.dateModified ? page.dateModified.slice(0, 10) : null,
      extra: { published: page.datePublished || undefined },
    };
  },
};
