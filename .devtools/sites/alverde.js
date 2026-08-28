// alverde.net/blog/directory-programmi-di-affiliazione/<category>/ — alVerde, the Italian
// affiliate-programme directory (catalogued since 2001, ~400 entries in 40 categories): one record
// per listed programme — name, summary, PPS / PPL / PPC terms as published (often per network),
// managing networks ("GESTITO DA"), tags, detail-sheet link. Category pages paginate (/page/N/).
const { text, decode, between } = require("./_common");
module.exports = {
  name: "alverde", lang: "it", region: "IT", base: "https://www.alverde.net",
  async list(af) {
    const r = await af.get(`${this.base}/blog/directory-programmi-di-affiliazione/`, { tries: 2 });
    const cats = [...new Set([...(r.html || r.text || "").matchAll(/href="https:\/\/www\.alverde\.net\/blog\/directory-programmi-di-affiliazione\/([a-z0-9-]+)\/"/g)].map((m) => m[1]))];
    return cats.map((c) => ({ url: `${this.base}/blog/directory-programmi-di-affiliazione/${c}/`, slug: c }));
  },
  next(html, url) {
    const m = String(html).match(new RegExp(`href="(${url.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}page\\/(\\d+)\\/)"`, "g"));
    if (!m) return null;
    const cur = +((url.match(/\/page\/(\d+)\//) || [])[1] || 1);
    const pages = [...String(html).matchAll(/\/page\/(\d+)\/"/g)].map((x) => +x[1]).filter((n) => n === cur + 1);
    return pages.length ? { url: url.replace(/\/page\/\d+\/$/, "/") + `page/${cur + 1}/`, slug: `${url.split("/").filter(Boolean).slice(-1)[0].replace(/^\d+$/, "")}-p${cur + 1}` } : null;
  },
  parse(html, url) {
    const h = String(html);
    const cat = text(decode((h.match(/<div class="page-header"><h1>([^<]*)<\/h1>/) || [])[1] || ""));
    return [...h.matchAll(/<article class="home-news ([^"]*)">([\s\S]*?)<\/article>/g)].map((m) => {
      const cls = m[1], a = m[2];
      const name = text(decode((a.match(/<h2 class="entry-title"><a href="([^"]+)">([\s\S]*?)<\/a>/) || [])[2] || ""));
      const sheet = (a.match(/<h2 class="entry-title"><a href="([^"]+)"/) || [])[1];
      if (!name) return null;
      const summary = text(decode((a.match(/<div class="entry-summary"><p>([\s\S]*?)<\/p>/) || [])[1] || "").replace(/<[^>]+>/g, " ")).replace(/\s*\[…\]\s*$/, "");
      const info = between(a, '<div class="custominfo">', '<div class="readmore">') || "";
      const terms = {};
      for (const t of info.matchAll(/<strong class="inline-help"[^>]*>(PP[SLC])<\/strong>:\s*([\s\S]*?)(?=<br|<strong|$)/g)) terms[t[1]] = text(decode(t[2]).replace(/<[^>]+>/g, " "));
      const nets = [...info.matchAll(/<strong>GESTITO DA<\/strong>:([\s\S]*)$/g)].flatMap((g) => [...g[1].matchAll(/>([^<]+)<\/a>/g)].map((x) => text(x[1])));
      const tags = [...cls.matchAll(/tag-([a-z0-9-]+)/g)].map((x) => x[1]).filter((t) => !/^pay-per/.test(t));
      const pps = terms.PPS || "";
      const pcts = [...pps.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)].map((x) => parseFloat(x[1].replace(",", ".")));
      const ppl = terms.PPL || "", eur = ppl.match(/€\s*([\d.,]+)/) || pps.match(/€\s*([\d.,]+)/);
      const type = pps ? (terms.PPL ? "Hybrid" : "CPS") : terms.PPL ? "CPL" : terms.PPC ? "CPC" : null;
      const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      return {
        key, program_name: name, domain: /\.[a-z]{2,}$/i.test(name) && !/\s/.test(name) ? name.toLowerCase() : `alverde.${key}`, signup_url: sheet ? `${this.base}${sheet}` : url,
        description: summary.slice(0, 2000) || null, network: nets[0] || null,
        commission: Object.entries(terms).map(([k, v]) => `${k}: ${v}`).join("; ") || null, commission_type: type,
        pct_min: pcts.length ? Math.min(...pcts) : null, pct_max: pcts.length ? Math.max(...pcts) : null,
        flat_min: eur ? parseFloat(eur[1].replace(",", ".")) : null, flat_max: eur ? parseFloat(eur[1].replace(",", ".")) : null, currency: eur ? "EUR" : null,
        tags: [cat.toLowerCase(), ...tags].filter(Boolean),
        extra: { category: cat || undefined, terms: Object.keys(terms).length ? terms : undefined, networks: nets.length ? nets : undefined, sheet_url: sheet ? `${this.base}${sheet}` : undefined },
      };
    }).filter(Boolean);
  },
};
