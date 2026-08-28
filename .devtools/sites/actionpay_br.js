// actionpay.com.br/en/wmOffers/view/<id>/<slug> — Actionpay Brazil (performance network):
// ~300 public offers with per-aim rows (aim, payment % or amount, currency, processing days,
// post-click window, accept rate), geo, minimal level, rating, description. The "Offer news"
// feed is not stored. List = paginated wmOffers/page:N (a CSV export also exists).
const { text, decode, between, host } = require("./_common");
module.exports = {
  name: "actionpay_br", lang: "en", region: "BR", base: "https://actionpay.com.br",
  async list(af) {
    const out = new Map();
    for (let p = 1; p <= 30; p++) {
      const r = await af.get(`${this.base}/en/wmOffers/page:${p}`, { tries: 2 });
      const h = r.html || r.text || "";
      const links = [...h.matchAll(/href="(https:\/\/actionpay\.com\.br\/en\/wmOffers\/view\/(\d+)\/[^"]+)"/g)];
      for (const m of links) out.set(m[2], { url: m[1], slug: m[2] });
      if (!links.length || !h.includes(`/wmOffers/page:${p + 1}`)) break;
      await af.pace(2000);
    }
    return [...out.values()];
  },
  parse(html, url) {
    const h = String(html);
    const art = between(h, "<article>", "</article>") || h;
    const name = text(decode((art.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || ""));
    if (!name) throw new Error("no name");
    const site = (art.match(/<h1[\s\S]*?<a target="_blank" href="([^"]+)"/) || [])[1] || null;
    const id = (art.match(/Offer Id:\s*(\d+)/) || [])[1] || url.split("/")[6];
    const logo = (art.match(/<img src="([^"]+)" class="offer-logo"/) || [])[1];
    const aims = [];
    const tbl = between(art, 'id="wmOffers-aims-table"', "</table>");
    for (const m of tbl.matchAll(/<tr>\s*<td>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/g)) {
      const c = (s) => text(decode(s).replace(/<[^>]+>/g, " "));
      const first = m[1];
      aims.push({ aim: c((first.match(/<b>([\s\S]*?)<\/b>/) || [])[1] || ""), payment: c(m[2]), currency: (first.match(/Currency:\s*([A-Z]{3})/) || [])[1], processing: c(m[3]), postclick: c(m[4]), accept_rate: c(m[5]), active: /\(Active\)/.test(first) });
    }
    const geo = text(decode(between(art, 'id="wmOffers-geo-info"', "</div>").replace(/<[^>]+>/g, " "))).replace(/^Geo targeting:\s*/, "");
    const desc = text(decode(between(art, "<h4>Description:</h4>", /<h4>(Landings|Additional conditions|Offer news)/.test(art) ? "<h4>" + (art.match(/<h4>(Landings|Additional conditions|Offer news)/) || [])[1] : "</article>").replace(/<\/(p|li|br)>|<br\s*\/?>/g, " · ").replace(/<[^>]+>/g, " "))).replace(/(\s*·\s*){2,}/g, " · ").replace(/^(\s*·\s*)+|(\s*·\s*)+$/g, "");
    const cond = text(decode(between(art, "<h4>Additional conditions:</h4>", "<h4>").replace(/<[^>]+>/g, " ")));
    const pcts = aims.filter((a) => /%/.test(a.payment)).map((a) => parseFloat(a.payment)).filter((x) => !isNaN(x));
    const flats = aims.filter((a) => !/%/.test(a.payment)).map((a) => parseFloat(a.payment.replace(/[^\d.]/g, ""))).filter((x) => !isNaN(x));
    const comm = aims.map((a) => `${a.aim}: ${a.payment}${a.currency && !/%/.test(a.payment) ? " " + a.currency : ""}`).join("; ");
    const type = /\bCPL\b/.test(name) ? "CPL" : pcts.length ? "CPS" : flats.length ? "CPA" : null;
    return {
      program_name: name.replace(/\s*-\s*(CPA|CPL|CPS)\s*$/, ""), domain: site ? host(site) : `actionpay.${id}`, landing_url: site, signup_url: `${this.base}/en/register`, logo_url: logo ? logo.replace(/^\/\//, "https://") : null,
      description: desc.replace(/^Description:\s*/, "").slice(0, 4000) || null, network: "Actionpay", commission: comm || null, commission_type: type,
      pct_min: pcts.length ? Math.min(...pcts) : null, pct_max: pcts.length ? Math.max(...pcts) : null,
      flat_min: flats.length ? Math.min(...flats) : null, flat_max: flats.length ? Math.max(...flats) : null, currency: aims[0]?.currency || null,
      tags: ["brazil"],
      extra: { offer_id: id, aims: aims.length ? aims : undefined, geo: geo || undefined, conditions: cond || undefined, postclick: aims[0]?.postclick, processing: aims[0]?.processing, accept_rate: aims[0]?.accept_rate },
    };
  },
};
