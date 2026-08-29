// affmoment.com/partnerki/<slug>/ — AffMoment (RU arbitrage portal) network profiles: vertical,
// payment model, minimum payout, payout methods, features, site + contact email, rating /10,
// review count, update date, description. Category pages share the URL shape; a page without the
// parameter table is recorded as gone. Listing: /partnerki/ plus every /partnerki/<x>/ page it links
// (categories and profiles both link further profiles), two levels deep.
const { text, decode, between, host } = require("./_common");
module.exports = {
  name: "affmoment", lang: "ru", region: "RU", base: "https://affmoment.com",
  async list(af) {
    const seen = new Map(); const grab = (h) => [...new Set([...h.matchAll(/href="https:\/\/affmoment\.com\/partnerki\/([a-z0-9-]+)\/"/g)].map((m) => m[1]))];
    const root = await af.get(`${this.base}/partnerki/`, { tries: 2, maxChars: 2000000 });
    const first = grab(root.html || root.text || "");
    for (const s of first) seen.set(s, { url: `${this.base}/partnerki/${s}/`, slug: s });
    for (const s of first) {
      let r; try { r = await af.get(`${this.base}/partnerki/${s}/`, { tries: 1, maxChars: 2000000 }); } catch (e) { continue; }
      for (const x of grab(r.html || r.text || "")) if (!seen.has(x)) seen.set(x, { url: `${this.base}/partnerki/${x}/`, slug: x });
      await af.pace(1000);
    }
    return [...seen.values()];
  },
  urlFor(slug) { return `${this.base}/partnerki/${slug}/`; },
  parse(html, url) {
    const h = String(html);
    const table = between(h, '<table class="aff_post__item-info">', "</table>");
    if (!table) { const e = new Error("no profile table (category page)"); e.gone = true; throw e; }
    const name = text(decode((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "").replace(/<[^>]+>/g, " ")).replace(/^Партнерка\s+/, "").replace(/:\s*обзор.*$/, "");
    if (!name) throw new Error("no name");
    const kv = {};
    for (const m of table.matchAll(/<tr>\s*<td>([^<]*)<\/td>\s*<td>([\s\S]*?)<\/td>/g)) kv[text(m[1])] = text(decode(m[2]).replace(/<[^>]+>/g, " "));
    const contacts = between(h, 'id="contacts"', '<div class="aff_post__item-block">') || "";
    const site = (contacts.match(/<a href="(https?:\/\/[^"]+)"[^>]*data-wpel-link="external"/) || [])[1] || null;
    const email = (contacts.match(/mailto:([^"]+)"/) || [])[1] || null;
    const rating = (h.match(/Рейтинг партнерки\s*([\d.]+)\s*\/\s*10/) || [])[1];
    const reviews = (h.match(/Отзывы и вопросы<\/span>\s*<span>(\d+)</) || [])[1];
    const updated = (h.match(/<span>(\d{2}\.\d{2}\.\d{4})<\/span>/) || [])[1];
    const desc = text(decode((between(h, 'id="description"', '<div class="aff_post__item-block"') || between(h, "Описание партнерской программы</h2>", "<h2") || "").replace(/<\/(p|li|h\d)>|<br\s*\/?>/g, " · ").replace(/<[^>]+>/g, " "))).replace(/^Описание партнерской программы\s*·?\s*/, "").replace(/(\s*·\s*){2,}/g, " · ").replace(/^(\s*·\s*)+|(\s*·\s*)+$/g, "");
    const model = kv["Модель оплаты"] || "";
    const minp = kv["Минималка"] || "";
    const mn = minp.match(/(\$|€)?\s*([\d\s]+)\s*(\$|€|руб|₽|USD|EUR)?/);
    const models = model.split(/\s*,\s*/).filter(Boolean);
    return {
      program_name: name, domain: site ? host(site) : `affmoment.${url.split("/").filter(Boolean).pop()}`, landing_url: site, signup_url: site || url, contact_email: email,
      description: desc.slice(0, 4000) || null,
      commission_type: models.length > 1 ? "Hybrid" : /revshare/i.test(model) ? "RevShare" : /cpl/i.test(model) ? "CPL" : /cps/i.test(model) ? "CPS" : /cpa/i.test(model) ? "CPA" : null,
      commission_types: models.length ? models : null, recurring: /revshare/i.test(model) ? true : null,
      min_payout: mn && /\d/.test(minp) && !/нет/i.test(minp) ? parseInt(mn[2].replace(/\s/g, ""), 10) : null, min_payment_raw: minp && !/^нет$/i.test(minp) ? minp : null,
      payment_methods: kv["Способ вывода"] ? kv["Способ вывода"].split(/\s*,\s*/) : null,
      rating_avg: rating && +rating > 0 ? +rating : null, rating_count: reviews ? +reviews : null,
      tags: [kv["Вертикаль"]].filter(Boolean).map((s) => s.toLowerCase()),
      extra: { vertical: kv["Вертикаль"], features: kv["Особенности"], updated, props: kv },
    };
  },
};
