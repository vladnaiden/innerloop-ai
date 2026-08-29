// afliet.com/program/<slug> — أفلييت, the Arabic affiliate-programme directory (~110 programmes
// relevant to the Gulf/Egypt/MENA): data card (commission model, commission %, cookie window,
// payment methods, minimum withdrawal, payment frequency, Arabic support, acceptance ease),
// official sign-up link, English + Arabic names, niche. "غير مؤكد" (unconfirmed) values are kept
// as raw text but never turned into numbers. Listing: sitemap.xml /program/* entries.
const { text, decode, between, host, ldjson } = require("./_common");
const AR = (s) => String(s).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/٪/g, "%");
module.exports = {
  name: "afliet", lang: "ar", region: "MENA", base: "https://afliet.com",
  async list(af) {
    const r = await af.get(`${this.base}/sitemap.xml`, { tries: 2 });
    return [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/afliet\.com\/program\/([a-z0-9-]+))<\/loc>/g)].map((m) => ({ url: m[1], slug: m[2] }));
  },
  urlFor(slug) { return `${this.base}/program/${slug}`; },
  parse(html, url) {
    const h = String(html);
    const ar = text(decode((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || ""));
    const en = text(decode((h.match(/<h1[^>]*>[\s\S]*?<\/h1>\s*<span[^>]*dir="ltr"[^>]*>([^<]*)</) || [])[1] || "")).replace(/\s+Affiliate Program$/i, "");
    const name = en || ar.replace(/^أفلييت\s+/, "");
    if (!name) throw new Error("no name");
    const card = between(h, "بطاقة البيانات</h2>", "</dl>") || "";
    const kv = {};
    for (const m of card.matchAll(/<dt[^>]*>([^<]*)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)) kv[text(m[1])] = text(decode(m[2]).replace(/<\/span>\s*<span/g, "</span>, <span").replace(/<[^>]+>/g, " ")).replace(/\s*,\s*,/g, ",");
    const join = (h.match(/href="(https?:\/\/(?!afliet\.com)[^"]+)"[^>]*>\s*رابط التسجيل/) || [])[1] || null;
    const comm = AR(kv["نسبة العمولة"] || ""), model = kv["نموذج العمولة"] || "";
    const unc = (v) => /غير مؤكد/.test(v || "");
    const pct = !unc(comm) ? [...comm.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => +m[1]) : [];
    const cookie = !unc(kv["مدة الكوكيز"]) ? (AR(kv["مدة الكوكيز"] || "").match(/(\d+)\s*(يوم|أيام|days?)/) || [])[1] : null;
    const crumbs = ldjson(h).find((j) => j && j["@type"] === "BreadcrumbList");
    let bc = crumbs && crumbs.itemListElement ? crumbs.itemListElement.slice(1, -1).map((x) => text(x.name || "")).filter(Boolean) : [];
    if (!bc.length) { const f = h.replace(/<[^>]+>/g, " ").match(/موقع العمولة في مجال\s+([^<|]{2,40}?)\s{2,}/); if (f) bc = [text(f[1])]; }
    const cardText = Object.values(kv).join(" ");
    const net = (cardText.match(/\b(Impact|Awin|CJ|ShareASale|Rakuten|PartnerStack|Admitad|ArabClicks|Commission Junction|Tradedoubler|Partnerize)\b/) || [])[1] || null;
    const type = /CPS/.test(model) ? "CPS" : /CPL/.test(model) ? "CPL" : /CPA/.test(model) ? "CPA" : /RevShare|إيراد/.test(model) ? "RevShare" : null;
    return {
      program_name: name, domain: join ? host(join) : `afliet.${url.split("/").pop()}`, landing_url: join ? `https://${host(join)}` : null, signup_url: join || url,
      network: net, commission: comm || null, commission_type: type,
      pct_min: pct.length ? Math.min(...pct) : null, pct_max: pct.length ? Math.max(...pct) : null,
      cookie_days: cookie ? +cookie : null, cookie_length_raw: kv["مدة الكوكيز"] ? kv["مدة الكوكيز"].slice(0, 200) : null,
      payment_methods: kv["طرق الدفع"] ? kv["طرق الدفع"].split(/\s*,\s*/).filter(Boolean) : null, payment_frequency: kv["دورية الدفع"] ? kv["دورية الدفع"].slice(0, 300) : null,
      min_payment_raw: kv["الحد الأدنى للسحب"] && !unc(kv["الحد الأدنى للسحب"]) ? kv["الحد الأدنى للسحب"].slice(0, 200) : null,
      tags: bc.slice(0, 5),
      extra: { name_ar: ar, model, arabic_support: kv["الدعم العربي"], acceptance: kv["سهولة القبول"], withdrawal_ease: kv["سهولة السحب"], card: kv },
    };
  },
};
