// offers.help/<uuid> — an English-language iGaming/CPA offer aggregator (~2,700 offers,
// 25 networks). Pages are Next.js; the full offer object sits in __NEXT_DATA__:
// title, network, GEOs, goals (type, price, currency), verticals, allowed traffic types.
// The embedded partnerAssociation carries the network's API credentials — never stored.
const { text, decode } = require("./_common");
module.exports = {
  name: "offers_help", lang: "en", region: "global", base: "https://offers.help",
  async list(af) {
    const out = [];
    for (let i = 1; i <= 6; i++) {
      let r; try { r = await af.get(`${this.base}/sitemap-offers-${i}.xml`, { tries: 2 }); } catch { break; }
      const locs = [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/offers\.help\/([0-9a-f-]{36}))<\/loc>/g)];
      if (!locs.length) break;
      for (const m of locs) out.push({ url: m[1], slug: m[2] });
      await af.pace(2000);
    }
    return out;
  },
  parse(html, url) {
    const h = String(html);
    const i = h.indexOf("__NEXT_DATA__"); if (i < 0) throw new Error("no __NEXT_DATA__");
    const j = h.indexOf(">", i) + 1, k = h.indexOf("</script>", j);
    const o = (JSON.parse(h.slice(j, k)).props || {}).pageProps?.offer; if (!o) throw new Error("no offer");
    const goals = (o.goals || []).map((g) => ({ type: g.type, price: g.price, currency: g.currency_price }));
    const money = goals.filter((g) => typeof g.price === "number" && g.currency && g.currency !== "%");
    const pcts = goals.filter((g) => g.currency === "%").map((g) => g.price);
    const cur = money.length ? money.map((g) => g.currency).sort((a, b) => money.filter((x) => x.currency === b).length - money.filter((x) => x.currency === a).length)[0] : null;
    const inCur = money.filter((g) => g.currency === cur).map((g) => g.price);
    const geos = (o.geos || []).map((g) => g.code).filter(Boolean);
    const types = [...new Set(goals.map((g) => g.type).filter(Boolean))];
    const desc = text(String((o.description && o.description.description) || "").replace(/<\/(p|li|h\d)>|<br\s*\/?>/g, " · "));
    return {
      program_name: o.title || null, domain: `offers-help.${o.slug || o.id}`, signup_url: url, landing_url: null, logo_url: o.image || null,
      description: desc.slice(0, 3000) || null, network: o.partner || null, vertical: (o.verticals || [])[0]?.title || null,
      categories: (o.verticals || []).map((v) => v.title).filter(Boolean),
      commission_type: types.join(", ") || null, commission_types: types.length ? types : null,
      currency: cur, flat_min: inCur.length ? Math.min(...inCur) : null, flat_max: inCur.length ? Math.max(...inCur) : null,
      pct_min: pcts.length ? Math.min(...pcts) : null, pct_max: pcts.length ? Math.max(...pcts) : null,
      countries: geos.length ? geos : null, source_updated: o.createdAt ? o.createdAt.slice(0, 10) : null,
      numbers: goals.length ? { goals } : null,
      extra: { kind: "offer", traffic_types: (o.typeTraffics || []).map((t) => t.title), network_key: o.partnerKey, goals_count: goals.length },
    };
  },
};
