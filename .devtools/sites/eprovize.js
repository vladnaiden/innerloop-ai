// e-provize.cz/<slug>/ — E-provize, Czech affiliate-programme database (WordPress review posts):
// ~650 programmes with cookie days, commission, profit type, invoicing, minimum payout + method,
// founded year, network/platform, signup link, auto-approval, dropshipping / order forwarding,
// sub-partner (referral) support, data export, promo support, forbidden promotion, user rating.
// Enumerated from post-sitemap.xml; posts without the programme tabs (news) are recorded as gone.
const { text, decode, between, host } = require("./_common");
const CZ = { "&#8211;": "–", "&#8222;": "„", "&#8220;": "“", "&#8230;": "…", "&#8217;": "’", "&nbsp;": " ", "&amp;": "&" };
const dec = (s) => decode(String(s).replace(/&#\d+;|&[a-z]+;/g, (m) => CZ[m] ?? m));
module.exports = {
  name: "eprovize", lang: "cs", region: "CZ", base: "http://www.e-provize.cz",
  async list(af) {
    const r = await af.get(`${this.base}/post-sitemap.xml`, { tries: 2, maxChars: 3000000 });
    return [...(r.html || r.text || "").matchAll(/<loc>(http:\/\/www\.e-provize\.cz\/([a-z0-9-]+)\/)<\/loc>/g)].map((m) => ({ url: m[1], slug: m[2] }));
  },
  urlFor(slug) { return `${this.base}/${slug}/`; },
  parse(html, url) {
    const h = String(html);
    const tabs = between(h, '<div class="sc-tabs">', '<!-- BEGIN RELATED ITEMS -->') || "";
    if (!/ID provizního programu/.test(tabs)) { const e = new Error("not a programme post"); e.gone = true; throw e; }
    const name = text(dec((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "").replace(/<[^>]+>/g, " ")).replace(/\s*-\s*E-provize\.cz$/, "");
    if (!name) throw new Error("no name");
    const kv = {};
    for (const m of tabs.matchAll(/<b>([^<]+?):?\s*<\/b>\s*([\s\S]*?)(?=<br\s*\/?>|<\/div>|<\/p>)/g)) { const v = text(dec(m[2]).replace(/<[^>]+>/g, " ")); if (v) kv[text(m[1]).replace(/:$/, "")] = v; }
    const signup = (tabs.match(/Přihlášení do affil\. programu:<\/b>\s*<a href="\s*([^"\s]+)\s*"/) || [])[1] || null;
    const descHtml = between(tabs, "Popis provizního programu:</b>", '<div id="tab-Provize"') || "";
    const desc = text(dec(descHtml.replace(/<\/p>|<br\s*\/?>/g, " · ").replace(/<[^>]+>/g, " "))).replace(/(\s*·\s*){2,}/g, " · ").replace(/^(\s*·\s*)+|(\s*·\s*)+$/g, "").replace(/^Popis provizního programu:\s*·?\s*/, "");
    const forb = text(dec((between(tabs, "Zakázané způsoby propagace:</b>", "</div>") || "").replace(/<[^>]+>/g, " "))).replace(/^Zakázané způsoby propagace:\s*/, "");
    const rating = (h.match(/Rating:\s*([\d.]+)\/<strong>10<\/strong>\s*\((\d+) votes/) || []);
    const comm = kv["Výše provize"] || "";
    const pcts = [...comm.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)].map((x) => parseFloat(x[1].replace(",", ".")));
    const kc = comm.match(/(\d[\d\s]*)\s*Kč/);
    const cookie = (kv["Platnost cookies"] || "").match(/(\d+)/);
    const minp = (kv["Výplatní minimum a způsob vyplácení"] || "").match(/(\d[\d\s]*)\s*Kč/);
    const yes = (k) => (kv[k] ? /^Ano/i.test(kv[k]) : undefined);
    const site = signup && !/e-provize/.test(signup) ? host(signup) : null;
    return {
      program_name: name, domain: site || (/\.[a-z]{2,}$/i.test(name.split(/\s/)[0]) ? name.split(/\s/)[0].toLowerCase() : `e-provize.${url.split("/").filter(Boolean).pop()}`), landing_url: site ? `https://${site}` : null, signup_url: signup || url,
      description: desc.slice(0, 4000) || null, network: kv["Affiliate síť / platforma"] && !/^(vlastní|žádná|ne)$/i.test(kv["Affiliate síť / platforma"]) ? kv["Affiliate síť / platforma"] : null,
      commission: comm || null, commission_type: /obratu|prodej/i.test(kv["Typ zisku"] || "") || pcts.length ? "CPS" : /lead|registrac/i.test(kv["Typ zisku"] || "") ? "CPL" : kc ? "CPA" : null,
      pct_min: pcts.length ? Math.min(...pcts) : null, pct_max: pcts.length ? Math.max(...pcts) : null, flat_min: kc ? parseInt(kc[1].replace(/\s/g, ""), 10) : null, flat_max: kc ? parseInt(kc[1].replace(/\s/g, ""), 10) : null, currency: kc ? "CZK" : null,
      cookie_days: cookie ? +cookie[1] : null, cookie_length_raw: kv["Platnost cookies"] || null,
      min_payout: minp ? parseInt(minp[1].replace(/\s/g, ""), 10) : null, min_payment_raw: kv["Výplatní minimum a způsob vyplácení"] || null,
      established_year: kv["Rok založení"] && /^\d{4}$/.test(kv["Rok založení"]) ? +kv["Rok založení"] : null,
      rating_avg: rating[1] && +rating[2] > 0 ? +rating[1] : null, rating_count: rating[2] ? +rating[2] : null,
      tags: [kv["Kategorie"]].filter(Boolean).map((s) => s.toLowerCase()),
      extra: { program_id: kv["ID provizního programu"], topic: kv["Téma zaměření webu/programu"], category: kv["Kategorie"], profit_type: kv["Typ zisku"], invoicing_required: yes("Vyžadována fakturace"), auto_approval: yes("Automatické schvalování partnerů"), dropshipping: yes("Způsob prodeje „Drop shipping“"), order_forwarding: yes("Způsob prodeje „Přeposílání objednávek“"), referral_system: yes("Podpora subpartnerů (referral systém)"), data_export: kv["Podpora export dat"], promo_support: yes("Reklamní podpora (články, banery aj.)"), forbidden_promotion: forb || undefined },
    };
  },
};
