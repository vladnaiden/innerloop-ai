// communicationads.net/de-de/publisher/partnerprogramme/<id>/ — communicationAds, the DACH
// telecom/energy affiliate network: ~85 public programmes with commission per lead/sale (EUR),
// model, cookie days, sales territory, advertiser website, programme text (often with named
// managers + contact email inside the text — kept in the description, not attributed as fields).
const { text, decode, host, between } = require("./_common");
module.exports = {
  name: "communicationads", lang: "de", region: "DE", base: "https://www.communicationads.net",
  async list(af) {
    const r = await af.get(`${this.base}/de-de/publisher/partnerprogramme/`, { tries: 2 });
    const ids = new Set([...(r.html || r.text || "").matchAll(/\/de-de\/publisher\/partnerprogramme\/(\d+)\//g)].map((m) => m[1]));
    return [...ids].map((id) => ({ url: `${this.base}/de-de/publisher/partnerprogramme/${id}/`, slug: id }));
  },
  urlFor(slug) { return `${this.base}/de-de/publisher/partnerprogramme/${slug}/`; },
  parse(html, url) {
    const h = String(html);
    const name = text((h.match(/<h1>Partnerprogramm ([\s\S]*?)<\/h1>/) || [])[1] || "");
    if (!name) throw new Error("no name");
    const prov = text(decode(between(h, "<b>Provision:</b>", "<b>Tracking:</b>").replace(/<[^>]+>/g, " ")));
    const cookie = (between(h, "<b>Tracking:</b>", "<b>Vertriebsgebiet:</b>").match(/(\d+)\s*Tage/) || [])[1];
    const geo = text(decode(between(h, "<b>Vertriebsgebiet:</b>", "<b>Links:</b>").replace(/<[^>]+>/g, " ")));
    const site = (between(h, "<b>Links:</b>", "</section>").match(/href="(https?:\/\/[^"]+)"[^>]*>Zur Webseite/) || [])[1] || null;
    const logo = (h.match(/<img src="(https:\/\/images\.communicationads\.net\/companies\/[^"]+)"/) || [])[1] || null;
    const exclusive = /EXKLUSIV/.test(between(h, "<h1>", "<b>Provision:</b>"));
    const body = between(h, "<h1>", "<b>Provision:</b>").replace(/<img[^>]*>/g, "");
    const desc = text(decode(body.replace(/<\/(p|li|br|div)>|<br\s*\/?>/g, " · ").replace(/<[^>]+>/g, " "))).replace(/^[\s\S]*?Jetzt bewerben/, "").replace(/EXKLUSIV/g, "").replace(/^(\s*·\s*)+/, "").replace(/(\s*·\s*)+$/, "").replace(/(\s*·\s*){2,}/g, " · ");
    const m = prov.match(/([\d.,]+)\s*(?:-\s*([\d.,]+))?\s*(?:€|&euro;|EUR)?\s*\/\s*(Lead|Sale)/i);
    const pct = prov.match(/([\d.,]+)\s*(?:-\s*([\d.,]+))?\s*%/);
    const num = (s) => (s ? parseFloat(s.replace(/\./g, "").replace(",", ".")) : null);
    const model = (prov.match(/Modell:\s*([^)]+)\)/) || [])[1];
    return {
      program_name: name, domain: site ? host(site) : `communicationads.${url.split("/").filter(Boolean).pop()}`, landing_url: site, signup_url: url, logo_url: logo,
      description: desc.slice(0, 4000) || null, network: "communicationAds",
      commission: prov.replace(/\s*\(Modell:[^)]*\)/, "") || null,
      commission_type: pct ? "CPS" : m ? (/lead/i.test(m[3]) ? "CPL" : "CPA") : null,
      flat_min: m ? +m[1].replace(",", ".") : null, flat_max: m ? +(m[2] || m[1]).replace(",", ".") : null, currency: m ? "EUR" : null,
      pct_min: pct ? num(pct[1]) : null, pct_max: pct ? num(pct[2] || pct[1]) : null,
      cookie_days: cookie ? +cookie : null, cookie_length_raw: cookie ? `${cookie} Tage` : null,
      tags: ["telecom"],
      extra: { model: model ? model.trim() : undefined, territory: geo ? geo.split(/\s+/).filter((x) => /^[A-Z]{2}$/.test(x)) : undefined, exclusive: exclusive || undefined },
    };
  },
};
