// directory.tradedoubler.com — Tradedoubler's public programme directory (~2,700 programmes,
// EU-wide, one per country market). Labelled cards: country, categories, start date, website,
// commissions per segment, cookie period, keyword policy, currency, publishing conditions.
const { text, host, between, decode, pctRange } = require("./_common");
module.exports = {
  name: "tradedoubler", lang: "en", region: "EU", base: "https://directory.tradedoubler.com",
  async list(af) {
    const out = new Map();
    for (let p = 1; p <= 400; p++) {
      let r; try { r = await af.get(`${this.base}/en/programs?page=${p}`, { tries: 2 }); } catch { break; }
      const links = [...(r.html || "").matchAll(/href="\/en\/programs\/(\d+)-([^"]+)"/g)];
      if (!links.length) break;
      for (const m of links) out.set(m[1], { url: `${this.base}/en/programs/${m[1]}-${m[2]}`, slug: m[1] });
      await af.pace(2000);
    }
    return [...out.values()];
  },
  parse(html, url) {
    const h = String(html);
    const card = (label) => { const m = h.match(new RegExp(`<div class="card-body">\\s*${label}\\s*<div[^>]*>([\\s\\S]*?)<\\/div>`)); return m ? text(m[1]) : null; };
    const side = (label) => { const m = h.match(new RegExp(`${label}\\s*<\\/strong>\\s*<\\/div>\\s*([\\s\\S]*?)<\\/div>`)); return m ? text(m[1]) : null; };
    const name = card("Name") || text(between(h, "<h1", "</h1>").replace(/^<h1[^>]*>/, ""));
    const website = card("Website");
    const desc = text(between(h, 'class="program-short-texts program-short-texts-en"', "</p>").replace(/^[^>]*>/, ""));
    const comms = [...between(h, "General segment commissions", "Vouchers").matchAll(/data-bs-title="([^"]*)"[^>]*>[\s\S]*?<div class="fw-bold fs-5 pt-0">\s*([^<]*)</g)].map((m) => ({ segment: decode(m[1]), value: text(m[2]) }));
    const pcts = comms.map((c) => c.value).filter((v) => /%/.test(v)).map((v) => parseFloat(v)).filter((n) => Number.isFinite(n));
    const flats = comms.map((c) => c.value).filter((v) => !/%/.test(v)).map((v) => parseFloat(v.replace(/[^\d.]/g, ""))).filter((n) => Number.isFinite(n));
    const cookie = side("Cookie period");
    const cond = between(h, "Publishing conditions", "Cookie period");
    const bucket = (label, stop) => text(between(cond, label, stop)).replace(new RegExp(`^${label}\\s*`), "").split(/\s{2,}|(?<=[a-z])\s(?=[A-Z])/).map((s) => s.trim()).filter(Boolean);
    const allowed = text(between(cond, "Allowed", "Conditional")).replace(/^Allowed\s*/, "");
    const conditional = text(between(cond, "Conditional", "Forbidden")).replace(/^Conditional\s*/, "");
    const forbidden = text(between(cond, "Forbidden", "</div></div></div>")).replace(/^Forbidden\s*/, "");
    const country = card("Country");
    const cc = (h.match(/flags\/countries\/svg\/4x3\/([a-z]{2})\.svg/) || [])[1];
    const cats = (card("Categories") || "").split(/\s*,\s*/).filter(Boolean);
    return {
      program_name: name ? `${name}` : null, domain: website ? website.toLowerCase().replace(/^www\./, "") : null,
      landing_url: website ? `https://${website}` : null, signup_url: url,
      description: desc || null, network: "Tradedoubler", categories: cats.length ? cats : null,
      country: cc ? cc.toUpperCase() : null, countries: cc ? [cc.toUpperCase()] : null,
      commission: comms.map((c) => `${c.segment}: ${c.value}`).join("; ").slice(0, 300) || null,
      commission_type: pcts.length && flats.length ? "CPS / CPA" : pcts.length ? "CPS" : flats.length ? "CPA" : null,
      pct_min: pcts.length ? Math.min(...pcts) : null, pct_max: pcts.length ? Math.max(...pcts) : null,
      flat_min: flats.length ? Math.min(...flats) : null, flat_max: flats.length ? Math.max(...flats) : null,
      currency: side("Currency") || null, cookie_days: cookie ? parseInt(cookie, 10) || null : null, cookie_length_raw: cookie,
      extra: { td_id: card("Id"), country_name: country, start_date: card("Start date"), languages: card("Languages"), commissions: comms,
        vouchers: side("Vouchers"), banners: side("Banners"), keyword_policy: side("Keyword policy"),
        traffic_allowed: allowed || undefined, traffic_conditional: conditional || undefined, traffic_forbidden: forbidden || undefined },
    };
  },
};
