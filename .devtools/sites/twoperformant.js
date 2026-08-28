// 2performant.com/affiliate-programs/<category>/<slug>/ — 2Performant, Romania's largest affiliate
// network: ~770 public programme pages with commission (% per sale or fixed), cookie life,
// currency, time to payment, network ranking (general + category), start month, countries,
// category, advertiser site, description excerpt. Enumerated from wp-sitemap-posts-program-N.xml.
const { text, decode, between, host, pctRange } = require("./_common");
module.exports = {
  name: "twoperformant", lang: "ro", region: "RO", base: "https://2performant.com",
  async list(af) {
    const out = [];
    for (let n = 1; n <= 10; n++) {
      let r; try { r = await af.get(`${this.base}/wp-sitemap-posts-program-${n}.xml`, { tries: 2, maxChars: 3000000 }); } catch (e) { if (/HTTP 404/.test(e.message)) break; throw e; }
      const locs = [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/2performant\.com\/affiliate-programs\/([a-z0-9-]+)\/([a-z0-9-]+)\/)<\/loc>/g)];
      if (!locs.length) break;
      for (const m of locs) out.push({ url: m[1], slug: m[3] });
    }
    return out;
  },
  parse(html, url) {
    const h = String(html);
    const name = text(decode((h.match(/<h1 class="entry-title">([\s\S]*?)<\/h1>/) || [])[1] || "")).replace(/\s+affiliate program$/i, "");
    if (!name) throw new Error("no name");
    const gen = between(h, 'class="program-general-info', "</ul>") || "";
    const cat = text((gen.match(/affiliate-programs\/[a-z0-9-]+\/" class="text-dark">([^<(]*)/) || [])[1] || "");
    const site = (gen.match(/href="(https?:\/\/(?!2performant\.com)[^"]+)" rel="nofollow"/) || [])[1] || null;
    const since = text((gen.match(/fa-calendar"><\/i>\s*([^<]*)/) || [])[1] || "");
    const countries = [...new Set(text((gen.match(/fa-globe"><\/i>\s*([^<]*)/) || [])[1] || "").split(/\s*,\s*/).filter(Boolean))];
    const set = between(h, 'class="row program-set-info', 'class="row program-description') || "";
    const block = (label) => { const m = set.match(new RegExp(`<p>${label}</p>\\s*<h6>([^<]*)</h6>(?:\\s*<p>([^<]*)</p>)?`)); return m ? { v: text(m[1]), u: text(m[2] || "") } : null; };
    const comm = block("Commission"), cookie = block("Cookie life"), cur = block("Currency"), pay = block("Time to payment");
    const ranks = [...set.matchAll(/<h6>([^<]*)<\/h6>\s*<p>(General|Category)<\/p>/g)].map((m) => [m[2].toLowerCase(), text(m[1])]);
    const desc = text(decode((between(h, 'class="program-content"', 'class="program-sidebar') || between(h, 'class="program-content"', "</div></div>") || "").replace(/^[^>]*>/, "").replace(/<\/(p|li|h\d)>|<br\s*\/?>/g, " · ").replace(/<[^>]+>/g, " "))).replace(/(\s*·\s*){2,}/g, " · ").replace(/^(\s*·\s*)+|(\s*·\s*)+$/g, "").replace(/\s*·\s*Read More.*$/, "");
    const cv = comm ? `${comm.v}${comm.u ? " " + comm.u : ""}` : "";
    const pct = /%/.test(cv) ? pctRange(cv) : {};
    const flat = !/%/.test(cv) ? cv.match(/([\d.,]+)/) : null;
    const cd = cookie ? (cookie.v.match(/(\d+)/) || [])[1] : null;
    return {
      program_name: name, domain: site ? host(site) : `2performant.${url.split("/").filter(Boolean).pop()}`, landing_url: site, signup_url: url,
      description: desc.slice(0, 4000) || null, network: "2Performant", commission: cv || null,
      commission_type: /per lead/i.test(cv) ? "CPL" : cv ? "CPS" : null,
      pct_min: pct.pct_min ?? null, pct_max: pct.pct_max ?? null, flat_min: flat ? parseFloat(flat[1].replace(",", ".")) : null, flat_max: flat ? parseFloat(flat[1].replace(",", ".")) : null, currency: cur ? cur.v : null,
      cookie_days: cd ? +cd : null, cookie_length_raw: cookie ? cookie.v : null,
      tags: cat ? [cat.toLowerCase()] : [],
      extra: { category: cat || undefined, since: since || undefined, countries: countries.length ? countries : undefined, ranking: ranks.length ? Object.fromEntries(ranks) : undefined, time_to_payment: pay ? pay.v : undefined },
    };
  },
};
