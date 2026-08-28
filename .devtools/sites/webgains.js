// webgains.com/front/publisher/program/view/programID/<id> — Webgains public programme pages
// (only the ~76 linked from /advertiser-directory/ are reachable; other IDs bounce to the
// homepage): commission details, validation period, cookie, EPHC, conversion rate, currency,
// live-since date, advertiser site, programme description, named Webgains account manager.
const { text, decode, between, host, pctRange } = require("./_common");
module.exports = {
  name: "webgains", lang: "en", region: "EU", base: "https://www.webgains.com",
  async list(af) {
    const r = await af.get(`${this.base}/advertiser-directory/`, { tries: 2, maxChars: 2000000 });
    const ids = new Set([...(r.html || r.text || "").matchAll(/programID\/(\d+)/g)].map((m) => m[1]));
    return [...ids].map((id) => ({ url: `${this.base}/front/publisher/program/view/programID/${id}`, slug: id }));
  },
  urlFor(slug) { return `${this.base}/front/publisher/program/view/programID/${slug}`; },
  parse(html, url) {
    const h = String(html).replace(/<!--[\s\S]*?-->/g, "");
    const name = text(decode((h.match(/<h1 class="t-title">([\s\S]*?)<\/h1>/) || [])[1] || "")).replace(/^Join the\s+/i, "").replace(/\s+affiliate programme$/i, "");
    if (!name || /^Home$|Webgains Platform/.test(name)) throw new Error("no programme on page");
    const kv = {};
    for (const m of h.matchAll(/<span>\s*([^<]{2,40}?):?\s*<\/span>\s*<span class="t-bold">\s*([\s\S]*?)\s*<\/span>/g)) { const v = text(decode(m[2]).replace(/<[^>]+>/g, " ")); if (v && v !== "-") kv[text(m[1]).replace(/:$/, "")] = v; }
    const site = (h.match(/<ul class="affiliate-list no-margin">\s*<li>\s*<span>\s*<strong>\s*<a target="_blank" href="([^"]+)"/) || [])[1] || null;
    const live = (h.match(/Live since\s*:\s*([\d/]+)/) || [])[1];
    const country = (h.match(/Country:[\s\S]*?flag_([a-z]{2}_[A-Z]{2})\.png/) || [])[1];
    const summary = text(decode(between(h, 'id="desc-summary">', "</div>").replace(/<[^>]+>/g, " ")));
    const descHtml = between(h, "Programme description", "<h3");
    const desc = text(decode(descHtml.replace(/<\/(p|li|h\d)>|<br\s*\/?>/g, " · ").replace(/<[^>]+>/g, " "))).replace(/(\s*·\s*){2,}/g, " · ").replace(/^(\s*·\s*)+|(\s*·\s*)+$/g, "");
    const mgr = h.match(/Account manager:\s*<\/span>[\s\S]*?<span class="t-bold">\s*([^<]+?)\s*<\/span>[\s\S]*?([\w.+-]+@webgains\.com)/) || h.match(/Account manager:[\s\S]{0,300}?([A-Z][a-z]+ [A-Z][a-z]+)[\s\S]{0,100}?([\w.+-]+@webgains\.com)/);
    const comm = kv["Commission details"] || "";
    const pct = /%/.test(comm) ? pctRange(comm) : {};
    const cookie = (kv["Cookie period"] || "").match(/(\d+)\s*day/);
    const cr = (h.match(/Conversion rate\*?:\s*([\d.]+)%/) || [])[1];
    const exclusive = /Exclusive to webgains/i.test(h);
    return {
      program_name: name, domain: site ? host(site) : `webgains.${url.split("/").pop()}`, landing_url: site, signup_url: url,
      description: (desc || summary).slice(0, 4000) || null, network: "Webgains",
      commission: comm || null, commission_type: /%/.test(comm) ? "CPS" : comm ? "CPA" : null,
      pct_min: pct.pct_min ?? null, pct_max: pct.pct_max ?? null, currency: kv["Currency"] || null,
      cookie_days: cookie ? +cookie[1] : null, cookie_length_raw: kv["Cookie period"] || null,
      extra: { program_id: url.split("/").pop(), live_since: live, country, summary: summary || undefined, ephc: kv["EPHC"], validation_period: kv["Average validation period"], conversion_rate_pct: cr ? +cr : undefined, payment_type: kv["Payment type"], exclusive: exclusive || undefined, manager: mgr ? { name: text(mgr[1]), email: mgr[2] } : undefined },
    };
  },
};
