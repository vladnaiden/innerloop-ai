// gooodbro.com/affiliate_program/<slug> — Gooodbro CPA-network catalogue (RU arbitrage media, same engine as Где Трафик):
// ~100 network profiles with offer types, features, payment systems, payout terms, hold,
// webmaster count, tags, intro text. The site link is a tracked redirect (name only), so
// the domain is a placeholder unless the profile text names one. Listing: /affiliate_program?page=N.
const { text, decode, between } = require("./_common");
module.exports = {
  name: "gooodbro", lang: "ru", region: "RU", base: "https://gooodbro.com",
  // No pager on the catalogue root; profiles are linked from ~25 vertical category pages (/<Cat>-<id>).
  async list(af) {
    const out = new Map(); const grab = (h) => { for (const m of String(h).matchAll(/affiliate_program\/([A-Za-z0-9_-]+)/g)) if (m[1] !== "amp" && !out.has(m[1])) out.set(m[1], { url: `${this.base}/affiliate_program/${m[1]}`, slug: m[1] }); };
    const root = await af.get(`${this.base}/affiliate_program`, { tries: 2 }); grab(root.html || root.text || "");
    const home = await af.get(`${this.base}/`, { tries: 2 });
    const cats = [...new Set([...((home.html || home.text || "") + (root.html || root.text || "")).matchAll(/href="(?:https:\/\/gooodbro\.com)?\/([A-Z][A-Za-z_]+-\d+)"/g)].map((m) => m[1]))];
    for (const c of cats) { try { const r = await af.get(`${this.base}/${c}`, { tries: 1 }); grab(r.html || r.text || ""); } catch (e) {} await af.pace(1000); }
    return [...out.values()];
  },
  urlFor(slug) { return `${this.base}/affiliate_program/${slug}`; },
  parse(html, url) {
    const h = String(html);
    const name = text(decode((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "").replace(/<[^>]+>/g, " "));
    if (!name) throw new Error("no name");
    const kv = {};
    for (const m of h.matchAll(/<div class="w-prop-cell name">[\s\S]*?<\/span>\s*([^<]+?)\s*<\/div>\s*<div class="w-prop-cell news-desc">([\s\S]*?)<\/div>/g)) kv[text(m[1])] = text(decode(m[2]).replace(/<[^>]+>/g, " "));
    const tags = [...new Set([...(between(h, "<h1", '<div class="w-partner-prop">') || "").matchAll(/href="\/tag_[^"]+"[^>]*>([^<]+)</g)].map((m) => text(m[1]).replace(/,$/, "")))];
    const wm = (h.match(/Веб-мастера\s*<\/[^>]+>\s*<[^>]*>\s*([\d\s]+)/) || [])[1];
    const desc = text(decode((between(h, "Знакомство с партнерской программой", "</section>") || between(h, "Знакомство с партнерской программой", "<footer") || "").replace(/<\/(p|h\d|li)>|<br\s*\/?>/g, " · ").replace(/<[^>]+>/g, " "))).replace(/^[^·]*?·\s*/, "").replace(/(\s*·\s*){2,}/g, " · ").slice(0, 3000);
    const short = text(decode((h.match(/<h1[^>]*>[\s\S]*?<\/h1>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/) || [])[1] || "").replace(/<[^>]+>/g, " "));
    const hold = (kv["Холд"] || "").match(/(\d+)(?:\s*-\s*(\d+))?\s*дн/);
    const types = (kv["Типы офферов"] || "").split(/\s*,\s*/).filter(Boolean);
    return {
      program_name: name.replace(/\s+партнерка.*$/i, "").replace(/\s+партнерская сеть.*$/i, "").replace(/\s+—.*$/, ""), domain: `gooodbro.${url.split("/").pop().toLowerCase()}`, signup_url: url,
      description: ((desc || short).replace(/^(\s*·\s*)+/, "") || text(decode((h.match(/<meta name="description" content="([^"]*)"/) || [])[1] || ""))).slice(0, 4000) || null,
      payment_methods: kv["Платежные системы"] ? kv["Платежные системы"].split(/\s*,\s*/) : null, payment_frequency: kv["Выплата"] || null,
      hold_days: hold ? +(hold[2] || hold[1]) : null,
      tags: [...new Set([...types.map((t) => t.toLowerCase()), ...tags.map((t) => t.toLowerCase())])].slice(0, 20),
      extra: { offer_types: types.length ? types : undefined, features: kv["Возможности"], hold_raw: kv["Холд"], site_label: kv["Адрес сайта"], webmasters: wm ? parseInt(wm.replace(/\s/g, ""), 10) : undefined, props: kv },
    };
  },
};
