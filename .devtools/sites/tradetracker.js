// tradetracker.com/<cc>/campaigns/<category>/ — TradeTracker's public campaign showcase
// per market. Each category page lists 12 campaigns server-side ("load more" is client-only
// and not reachable), so coverage is PARTIAL by design: brand, category, logo, blurb,
// network = TradeTracker, market = <cc>. No commission data is published.
const { text, decode } = require("./_common");
const MARKETS = ["nl", "de", "gb", "fr", "es", "it", "pl", "cz", "se", "dk", "no", "fi", "pt", "at", "ch", "hu", "ee", "ru", "ua", "us", "mx", "br", "ar", "in", "ae"];
module.exports = {
  name: "tradetracker", lang: "en", region: "EU", base: "https://www.tradetracker.com",
  async list(af) {
    const out = [];
    for (const cc of MARKETS) {
      let r; try { r = await af.get(`${this.base}/${cc}/campaigns/`, { tries: 2 }); } catch { continue; }
      const cats = [...(r.html || "").matchAll(new RegExp(`href="/${cc}/campaigns/([a-z0-9-]+-\\d+)/"`, "g"))].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i);
      for (const c of cats) out.push({ url: `${this.base}/${cc}/campaigns/${c}/`, slug: `${cc}-${c}` });
      await af.pace(2000);
    }
    return out;
  },
  parse(html, url) {
    const h = String(html);
    const cc = (url.match(/tradetracker\.com\/([a-z]{2})\//) || [])[1];
    const category = text((h.match(/<h1[^>]*>([^<]*)</) || [])[1] || "").replace(/\s*Campagnes.*$/, "");
    const seen = new Set();
    return [...h.matchAll(/<article[\s\S]*?<\/article>/g)].map((m) => {
      const a = m[0];
      const name = text((a.match(/<h3[^>]*>([^<]+)<\/h3>/) || [])[1] || "");
      const det = (a.match(/href="(\/[a-z]{2}\/campaigns\/[a-z0-9-]+\/([a-z0-9-]+)-(\d+)\/)"/) || []);
      const id = det[3]; if (!name || !id || seen.has(id)) return null; seen.add(id);
      const cat = text((a.match(/href="\/[a-z]{2}\/campaigns\/[a-z0-9-]+\/"[^>]*>([^<]+)</) || [])[1] || "") || category || null;
      const logo = decode((a.match(/url=(https%3A%2F%2Fcdn\.tradetracker\.com[^&"]+)/) || [])[1] || "");
      const blurb = text((a.match(/<p[^>]*>([\s\S]*?)<\/p>/) || [])[1] || "");
      return {
        key: id, program_name: name, domain: /\.[a-z]{2,}$/i.test(name) && !/\s/.test(name) ? name.toLowerCase().replace(/^www\./, "") : `tradetracker-${cc}.${id}`,
        signup_url: this.base + det[1], landing_url: null, logo_url: logo ? decodeURIComponent(logo) : null,
        description: blurb || null, network: "TradeTracker", country: cc.toUpperCase(), countries: [cc.toUpperCase()],
        categories: cat ? [cat] : null, vertical: cat,
        extra: { tt_campaign_id: id, market: cc, coverage: "listing-first-12-per-category" },
      };
    }).filter(Boolean);
  },
};
