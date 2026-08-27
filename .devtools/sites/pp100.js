// 100partnerprogramme.de — the DACH partner-programme directory (~2,000 programmes,
// sitemap-programs.xml). Every programme page carries a labelled "Überblick" grid
// and a "Produkte und Provisionen" table; the network is in the signup widget.
const { text, num, host, meta, between, pctRange, decode } = require("./_common");
const DE_MONTHS = { januar: 1, februar: 2, märz: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12 };
const deDate = (s) => { const m = String(s || "").match(/(\d{1,2})\.\s*([A-Za-zäÄ]+)\s+(\d{4})/); if (!m) return null; const mo = DE_MONTHS[m[2].toLowerCase()]; return mo ? `${m[3]}-${String(mo).padStart(2, "0")}-${m[1].padStart(2, "0")}` : null; };

module.exports = {
  name: "pp100", lang: "de", region: "DACH", base: "https://www.100partnerprogramme.de",
  async list(af) {
    const urls = [];
    for (let p = 1; p <= 20; p++) {
      const r = await af.get(`${this.base}/sitemap-programs.xml?page=${p}`, { tries: 2 });
      const locs = [...(r.html || r.text || "").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      if (!locs.length) break;
      urls.push(...locs.filter((u) => u.includes("/p/")));
      await af.pace(2000);
    }
    return urls.map((url) => ({ url, slug: url.replace(/\/$/, "").split("/").pop() }));
  },
  parse(html, url) {
    const h = String(html);
    const title = text(between(h, "<title", "</title>").replace(/^<title[^>]*>/, ""));
    const name = title.replace(/-Partnerprogramm.*$/i, "").replace(/\s*-\s*bis zu.*$/i, "").trim() || null;
    const grid = between(h, 'id="allgemeine-informationen"', "</section>");
    const label = (l) => { const m = grid.match(new RegExp(`<label>\\s*${l}\\s*</label>\\s*([\\s\\S]*?)(?:<hr|<label|</div>)`, "i")); return m ? text(m[1]) : null; };
    const landing = (grid.match(/name="href" value="([^"]+)"/) || [])[1] || null;
    const cats = [...grid.matchAll(/href="\/thema\/[^"]+"[^>]*>\s*([^<]+)</g)].map((m) => text(m[1]));
    const widget = between(h, 'id="netzwerk-anmeldungen"', "</section>");
    const dims = (widget.match(/data-uts-dimensions='\[([^\]]*)\]'/) || [])[1];
    const network = dims ? (dims.split(",").map((s) => s.replace(/["\s]/g, "")).filter(Boolean)[1] || null) : null;
    // the headline rate is in the <title>: "xyz-Partnerprogramm - bis zu 20,00 % Pay per Sale"
    const tm = title.match(/bis zu\s*([\d.,]+\s*[%€])\s*(Pay per [A-Za-z]+|[A-Za-z ]+)?/i);
    const rate = tm ? text(tm[1]) : "";
    const model = tm && tm[2] ? text(tm[2]) : "";
    const table = between(h, 'id="produkte-und-provisionen"', "</section>");
    const products = [...table.matchAll(/<tr>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/g)]
      .map((m) => ({ product: text(m[1]), commission: text(m[2]), type: text(m[3]) }));
    const desc = text(between(h, "<blockquote", "</blockquote>").replace(/^<blockquote[^>]*>/, ""));
    const cookie = label("Tracking-Lifetime") || (h.match(/(\d+)\s*Tage[^<]{0,40}Cookie/) || [])[0];
    const contact = text(between(h, 'id="ansprechpartner"', "</section>"));
    const reviews = text(between(h, "Bewertungen zu", "</section>"));
    const pct = /%/.test(rate) ? pctRange(rate) : {};
    // the products table carries the real span ("11,00 - 15,00 %"); the headline is only the top
    const spans = products.map((p) => /%/.test(p.commission) ? pctRange(p.commission) : {}).filter((x) => x.pct_min != null);
    if (spans.length && pct.pct_max != null) pct.pct_min = Math.min(pct.pct_min, ...spans.map((x) => x.pct_min));
    const flat = /€/.test(rate) ? num(rate) : null;
    return {
      program_name: name, landing_url: landing, domain: host(landing) || null, signup_url: url,
      description: desc || null, network, categories: cats.length ? cats : null,
      commission: rate || null, commission_type: model || null,
      pct_min: pct.pct_min ?? null, pct_max: pct.pct_max ?? null, flat_min: flat, flat_max: flat,
      cookie_days: cookie ? num(cookie) : null, cookie_length_raw: cookie || null,
      source_updated: deDate(label("Zuletzt geupdatet")),
      established_year: null,
      extra: {
        program_start: deDate(label("Programmstart")), tracking: label("Tracking"), ad_media: label("Werbemittel"),
        product_feeds: label("Produktdaten-Feeds"), instant_approval: label("Sofortige Freischaltung"), processing_time: label("Bearbeitungszeit"),
        sem_allowed: label("SEM erlaubt"), sem_notes: label("SEM-Hinweise"), products: products.length ? products : undefined,
        contact_person: /Schade/.test(contact) ? undefined : (contact || undefined),
        reviews_note: /noch keine Bewertung/.test(reviews) ? "none" : (reviews.slice(0, 300) || undefined),
        og_image: meta(h, "og:image"),
      },
    };
  },
};
