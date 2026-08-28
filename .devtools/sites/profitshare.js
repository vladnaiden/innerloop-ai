// profitshare.ro/affiliate-programs/<category>/<slug> — Profitshare (eMAG's Romanian affiliate
// network): ~65 public programmes with commission range, commission (cookie) period, average
// approval rate + approval time, product-feed flag, category, advertiser site, logo.
const { text, decode, between, host, pctRange } = require("./_common");
module.exports = {
  name: "profitshare", lang: "ro", region: "RO", base: "https://profitshare.ro",
  async list(af) {
    const out = new Map();
    for (let p = 1; p <= 20; p++) {
      const r = await af.get(`${this.base}/affiliate-programs/?page=${p}`, { tries: 2 });
      const h = r.html || r.text || "";
      const links = [...h.matchAll(/href="(\/affiliate-programs\/[a-z0-9-]+\/([a-z0-9-]+))"/g)];
      for (const m of links) out.set(m[2], { url: `${this.base}${m[1]}`, slug: m[2] });
      if (!links.length || !h.includes(`?page=${p + 1}`)) break;
      await af.pace(1500);
    }
    return [...out.values()];
  },
  parse(html, url) {
    const h = String(html);
    const name = text(decode((h.match(/<h1 class="title">([\s\S]*?)<\/h1>/) || [])[1] || "")).replace(/\s*-\s*Program de Afiliere$/i, "");
    if (!name) throw new Error("no name");
    const logo = (h.match(/advertiser-logos\/[^"]+/) || [])[0];
    const appr = (h.match(/aprobare valorică[^"]*?este de\s+([\d.,]+)%/) || [])[1];
    const apprDays = (h.match(/aprobarea comisioanelor[^"]*?este de\s+(\d+) zile/) || [])[1];
    const feed = /ofera feed-uri de produse/.test(h);
    const item = (label) => { const m = h.match(new RegExp(`<h3 class="title">\\s*${label}:?\\s*</h3>\\s*<h4 class="subtitle">([\\s\\S]*?)</h4>`)); return m ? text(decode(m[1])) : ""; };
    const cat = item("Categorie Advertiser"), period = item("Perioada de comisionare"), comm = item("Comisioane oferite");
    const site = (h.match(/<h3 class="title url"><a rel="nofollow" href="([^"]+)"/) || [])[1] || null;
    const pct = /%/.test(comm) ? pctRange(comm) : {};
    const lei = comm.match(/([\d.,]+)\s*lei(?:\s*-\s*([\d.,]+)\s*lei)?/);
    const n = (s) => parseFloat(String(s).replace(",", "."));
    const cd = (period.match(/(\d+)/) || [])[1];
    return {
      program_name: name, domain: site ? host(site) : `profitshare.${url.split("/").pop()}`, landing_url: site, signup_url: url, logo_url: logo ? `https://app.profitshare.ro/files_shared/${logo}` : null,
      network: "Profitshare", commission: comm || null, commission_type: comm ? "CPS" : null,
      pct_min: pct.pct_min ?? null, pct_max: pct.pct_max ?? null, flat_min: lei ? n(lei[1]) : null, flat_max: lei ? n(lei[2] || lei[1]) : null, currency: lei ? "RON" : null,
      cookie_days: cd ? +cd : null, cookie_length_raw: period || null,
      tags: cat ? [cat.toLowerCase()] : [],
      extra: { category: cat || undefined, approval_rate_pct: appr ? n(appr) : undefined, approval_days: apprDays ? +apprDays : undefined, product_feed: feed || undefined },
    };
  },
};
