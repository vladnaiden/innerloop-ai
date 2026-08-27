// affiliate-marketing.de/partnerprogramme/<merchant-domain> — DACH merchant pages: one
// table row per programme (network, commission span, SEM, tracking, product feeds,
// sales territories) plus trivia (landing page, listed since, categories) and a profile.
const { text, between, decode, pctRange, num } = require("./_common");
module.exports = {
  name: "affiliate_marketing_de", lang: "de", region: "DACH", base: "https://www.affiliate-marketing.de",
  async list(af) {
    const root = await af.get(`${this.base}/partnerprogramme`, { tries: 2 });
    const cats = [...(root.html || "").matchAll(/href="\/partnerprogramme\/([a-z0-9-]+)"/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i && v !== "kw");
    const out = new Map();
    for (const c of cats) {
      for (let p = 1; p <= 60; p++) {
        let r; try { r = await af.get(`${this.base}/partnerprogramme/${c}${p > 1 ? `/${p}` : ""}`, { tries: 2 }); } catch { break; }
        const links = [...(r.html || "").matchAll(/href="\/partnerprogramme\/([a-z0-9.-]+\.[a-z]{2,})"/g)].map((m) => m[1]);
        let fresh = 0; for (const d of links) if (!out.has(d)) { out.set(d, { url: `${this.base}/partnerprogramme/${d}`, slug: d }); fresh++; }
        await af.pace(2000);
        if (!links.length || (p > 1 && !fresh) || !(r.html || "").includes(`/partnerprogramme/${c}/${p + 1}"`)) break;
      }
    }
    return [...out.values()];
  },
  parse(html, url) {
    const h = String(html);
    const name = text((h.match(/<title>([^<]*?)\s+Partnerprogramm/) || [])[1] || between(h, "<h1", "</h1>").replace(/^<h1[^>]*>/, ""));
    const rows = [...between(h, 'id="affiliateprograms"', "</table>").matchAll(/<tr\s+data-salesregions="([^"]*)"\s*>([\s\S]*?)<\/tr>/g)].map((m) => {
      const r = m[2];
      const net = (r.match(/netzwerke\/[^"]+"\s+title="[^"]*"\s+alt="([^"]*)"/) || [])[1] || null;
      const pname = text((r.match(/<span class="d-inline-block[^"]*"\s*>([^<]*)<\/span>/) || [])[1] || "");
      const comm = [...r.matchAll(/<span class="value"[^>]*>([\s\S]*?)<\/span>(?:<span class="value"[^>]*>([\s\S]*?)<\/span>)?/g)].map((x) => text(x[1] + " " + (x[2] || "")));
      const sem = (r.match(/title="(SEM[^"]*)"/) || [])[1] || null;
      const tracking = [...between(r, "Tracking:", "</td>").matchAll(/<li>([^<]*)<\/li>/g)].map((x) => text(x[1]));
      const feeds = (r.match(/title="(Produktdaten[^"]*)"/) || [])[1] || null;
      return { name: pname || null, network: net, regions: m[1], commissions: comm, sem, tracking: tracking.length ? tracking : null, product_feeds: feeds };
    });
    const trivia = between(h, "Trivia", "</ul>");
    const landing = (trivia.match(/Landingpage:[\s\S]*?href="([^"]+)"/) || [])[1] || null;
    const since = (trivia.match(/Aufgenommen am:\s*([\d.]+)/) || [])[1];
    const cats = [...trivia.matchAll(/class="tag"><a[^>]*>([^<]*)<\/a>/g)].map((x) => text(x[1]));
    const desc = text(between(h, 'class="advertiser-description', "</div>").replace(/^[^>]*>/, ""));
    const pcts = rows.flatMap((r) => r.commissions).flatMap((c) => [...c.matchAll(/(\d+(?:,\d+)?)\s*%/g)].map((x) => parseFloat(x[1].replace(",", "."))));
    const flats = rows.flatMap((r) => r.commissions).flatMap((c) => [...c.matchAll(/(\d+(?:,\d+)?)\s*€/g)].map((x) => parseFloat(x[1].replace(",", "."))));
    const nets = rows.map((r) => r.network).filter((v, i, a) => v && a.indexOf(v) === i);
    const regs = rows.map((r) => r.regions).join(",").split(/[,\s]+/).filter((v, i, a) => v && a.indexOf(v) === i);
    return {
      program_name: name || null, domain: url.split("/").pop().toLowerCase(), landing_url: landing, signup_url: url,
      description: desc || null, network: nets.join(", ") || null, categories: cats.length ? cats : null,
      commission: rows.map((r) => `${r.name || r.network}: ${r.commissions.join(" · ")}`).join("; ").slice(0, 300) || null,
      commission_type: rows.some((r) => r.commissions.some((c) => /Sale/i.test(c))) ? "CPS" : rows.some((r) => r.commissions.some((c) => /Lead/i.test(c))) ? "CPL" : null,
      pct_min: pcts.length ? Math.min(...pcts) : null, pct_max: pcts.length ? Math.max(...pcts) : null,
      flat_min: flats.length ? Math.min(...flats) : null, flat_max: flats.length ? Math.max(...flats) : null,
      countries: regs.length ? regs : null, offers_count: rows.length || null,
      extra: { programs: rows, listed_since: since ? since.split(".").reverse().join("-") : undefined, networks: nets },
    };
  },
};
