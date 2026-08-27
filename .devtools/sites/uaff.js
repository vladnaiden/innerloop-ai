// uaff.media — Ukrainian editorial catalogue of affiliate networks. Organization JSON-LD
// carries name/logo/description; payout terms sit in labelled metric cells.
const { text, host, ldjson, between, decode } = require("./_common");
const cell = (h, label) => { const m = String(h).match(new RegExp(`>${label}</div>\\s*<div[^>]*>([^<]*)</div>(?:\\s*<div[^>]*>([^<]*)</div>)?`)); return m ? { value: text(m[1]), note: text(m[2] || "") } : null; };
module.exports = {
  name: "uaff", lang: "uk", region: "UA", base: "https://uaff.media",
  async list(af) {
    const r = await af.get(`${this.base}/sitemap-catalog.xml`, { tries: 2 });
    return [...(r.html || r.text || "").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
      .filter((u) => u.includes("/partners/")).map((url) => ({ url, slug: url.replace(/\/$/, "").split("/").pop() }));
  },
  parse(html, url) {
    const h = String(html);
    const org = ldjson(h).find((j) => j["@type"] === "Organization") || {};
    const crumbs = (ldjson(h).find((j) => j["@type"] === "BreadcrumbList") || {}).itemListElement || [];
    const vertical = crumbs.length >= 3 ? crumbs[2].name : null;
    const est = (h.match(/EST\s*(?:<!--\s*-->)?\s*(\d{4})/) || h.match(/На ринку з<\/div>\s*<div[^>]*>(\d{4})/) || [])[1];
    const minp = cell(h, "Мін. виплата") || cell(h, "Мінімум"), freq = cell(h, "Періодичність"), methods = cell(h, "Методи"), hold = cell(h, "Холд");
    let models = text(between(h, "Моделі оплати", "</div></div>").replace(/^[^>]*>/, "")).replace(/^Моделі оплати\s*/, "");
    if (!models || models.length > 150 || /§/.test(models)) models = "";
    const rating = h.match(/(\d[.,]\d)\s*<\/div>\s*<div[^>]*>\s*(?:з|із)\s*5/) ;
    const site = (h.match(/href="(\/pp\/[^"]+)"/) || [])[1];
    const clean = (v) => v && v !== "—" ? v : null;
    return {
      program_name: org.name || text(between(h, "<h1", "</h1>").replace(/^<h1[^>]*>/, "").replace(/<span[\s\S]*$/, "")) || null,
      domain: `uaff.${url.replace(/\/$/, "").split("/").pop()}`, signup_url: site ? this.base + site : null, landing_url: null,
      logo_url: org.logo || null, description: org.description || null, vertical,
      established_year: est ? +est : null,
      min_payment_raw: minp ? clean(minp.value) : null, payment_frequency: freq ? clean(freq.value) || clean(freq.note) : null,
      payment_methods: methods && clean(methods.value) ? methods.value.split(/\s*[,·]\s*/) : null,
      commission_type: models.slice(0, 120) || null, commission_types: models ? models.split(/\s*[·,]\s*/).map((s) => s.replace(/—.*$/, "").trim()).filter(Boolean).slice(0, 6) : null,
      rating_avg: rating ? parseFloat(rating[1].replace(",", ".")) : null,
      extra: { hold: hold ? clean(hold.value) : null, payout_note: minp ? minp.note : null },
    };
  },
};
