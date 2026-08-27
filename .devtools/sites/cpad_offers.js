// cpad.pro/offer/<id> — one advertiser offer as monitored across CPA networks: every
// goal row is (type, GEO, payout, hold, postclick, approval %, network, status).
const { text, between, ldjson, decode } = require("./_common");
module.exports = {
  name: "cpad_offers", lang: "ru", region: "CIS", base: "https://cpad.pro",
  async list(af) {
    const r = await af.get(`${this.base}/sitemap.xml`, { tries: 2 });
    return [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/cpad\.pro\/offer\/(\d+))<\/loc>/g)].map((m) => ({ url: m[1], slug: m[2] }));
  },
  parse(html, url) {
    const h = String(html);
    const ld = ldjson(h).find((j) => j["@type"] === "CollectionPage") || {};
    const crumbs = ((ldjson(h).find((j) => j["@type"] === "BreadcrumbList") || {}).itemListElement || []).map((x) => x.name).slice(1, -1);
    const tbody = between(h, "Цена по ленде", "</table>");
    const rows = [...tbody.matchAll(/<tr>\s*((?:<td[\s\S]*?<\/td>\s*){9,})<\/tr>/g)].map((m) => {
      const cells = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]);
      const geo = (cells[2].match(/alt="([^"]*)"/) || [])[1] || text(cells[2]);
      const netm = cells[8].match(/href="\/network\/(\d+)"[^>]*>[\s\S]*?cpad-tip--pp">([^<]*)</);
      const netId = (cells[8].match(/data-copy-id="([^"]*)"/) || [])[1];
      const last = (cells[9] && cells[9].match(/Встречался последний раз:\s*([^<]*)/) || [])[1];
      const nd = (s) => { const t = text(s); return /Нет данных/.test(t) ? null : t; };
      return { goal: text(cells[0]), type: text(cells[1]), geo, payout: text(cells[3]), lead_price: nd(cells[4]), hold: nd(cells[5]), postclick: nd(cells[6]), approval_pct: nd(cells[7]),
        network: netm ? text(netm[2]) : null, network_id: netm ? netm[1] : null, offer_id_in_network: netId || null, last_seen: last ? text(last).slice(0, 19) : null };
    });
    const money = rows.map((r) => r.payout.match(/([\d.,]+)\s*([A-Z]{3})/)).filter(Boolean);
    const byCur = {}; for (const m of money) { (byCur[m[2]] = byCur[m[2]] || []).push(parseFloat(m[1].replace(",", "."))); }
    const cur = Object.keys(byCur).sort((a, b) => byCur[b].length - byCur[a].length)[0] || null;
    const nets = rows.map((r) => r.network).filter((v, i, a) => v && a.indexOf(v) === i);
    const geos = rows.map((r) => r.geo).filter((v, i, a) => v && a.indexOf(v) === i);
    const types = rows.map((r) => r.type).filter((v, i, a) => v && a.indexOf(v) === i);
    const intro = text(between(h, 'class="offer-intro', "</p>").replace(/^[^>]*>/, ""));
    return {
      program_name: ld.name || text(between(h, "<h1", "</h1>").replace(/^<h1[^>]*>/, "")) || null,
      domain: `cpad-offer.${url.split("/").pop()}`, signup_url: url, landing_url: null,
      description: [ld.description, intro].filter(Boolean).join(" — ").slice(0, 3000) || null,
      network: nets.join(", ").slice(0, 200) || null, vertical: ld.category || crumbs[crumbs.length - 1] || null, categories: crumbs.length ? crumbs : null,
      commission_type: types.join(", ") || null, commission_types: types.length ? types : null,
      currency: cur, flat_min: cur ? Math.min(...byCur[cur]) : null, flat_max: cur ? Math.max(...byCur[cur]) : null,
      countries: geos.length ? geos.slice(0, 50) : null, offers_count: null,
      numbers: rows.length ? { goals: rows } : null,
      extra: { kind: "offer", networks: nets, goals_count: rows.length, last_seen: rows.map((r) => r.last_seen).filter(Boolean).sort().pop() || null },
    };
  },
};
