// cpa-rating.ru/partnerka/<slug>/otzivy — RU CPA-network rating: site (referral link → clean
// domain), category, minimum payout, star rating + votes, review counts (recommend / not / undecided),
// offers count, closed flag. Offer tables on the site are JS templates and are not parsed.
// Networks are collected from the homepage + the "<vertical>-partnerki" category pages.
const { text, decode, between, host } = require("./_common");
module.exports = {
  name: "cpa_rating", lang: "ru", region: "RU", base: "https://cpa-rating.ru",
  async list(af) {
    const slugs = new Set();
    const grab = (h) => { for (const m of h.matchAll(/href="\/partnerka\/([a-z0-9-]+)(?:\/otzivy)?"/g)) slugs.add(m[1]); };
    const home = await af.get(`${this.base}/`, { tries: 2 }); grab(home.html || home.text || "");
    const cats = [...new Set([...(home.html || home.text || "").matchAll(/href="\/([a-z0-9-]+-partnerki)"/g)].map((m) => m[1]))];
    for (const c of cats) { try { const r = await af.get(`${this.base}/${c}`, { tries: 1 }); grab(r.html || r.text || ""); } catch (e) { if (!/HTTP 404/.test(e.message)) throw e; } await af.pace(1200); }
    return [...slugs].map((s) => ({ url: `${this.base}/partnerka/${s}/otzivy`, slug: s }));
  },
  urlFor(slug) { return `${this.base}/partnerka/${slug}/otzivy`; },
  parse(html, url) {
    const h = String(html).replace(/<!--[\s\S]*?-->/g, "");
    const name = text(decode((h.match(/<h1[^>]*>Отзывы о ([\s\S]*?)<\/h1>/) || [])[1] || ""));
    if (!name) throw new Error("no name");
    const site = text((h.match(/<span>На сайт:<\/span>\s*<a href="[^"]*"[^>]*>([^<]*)<\/a>/) || [])[1] || "");
    const closed = /title="Партнерка закрыта"/.test(h);
    const cat = text((h.match(/<span>Категория:<\/span>\s*([^<]*)/) || [])[1] || "");
    const minp = text((h.match(/<span>Минималка:<\/span>\s*([^<]*)/) || [])[1] || "");
    const rating = parseFloat((h.match(/name="val" value="([\d.]+)"/) || [])[1]), votes = parseInt((h.match(/name="votes" value="(\d+)"/) || [])[1], 10);
    const cnt = (label) => { const m = h.match(new RegExp(`${label}\\s*<[^>]*>\\s*(\\d+)`)) || h.match(new RegExp(`${label}\\s+(\\d+)`)); return m ? +m[1] : undefined; };
    const plain = h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const num = (label) => { const m = plain.match(new RegExp(`${label}\\s+(\\d+)`)); return m ? +m[1] : undefined; };
    const logo = (h.match(/<img class="img_rat" src="([^"]+)"/) || [])[1];
    const minNum = minp.match(/([\d\s]+)\s*(руб|₽|\$|usd|€)/i);
    return {
      program_name: name, domain: site ? host(site) : `cpa-rating.${url.split("/")[4]}`, landing_url: site || null, signup_url: url, logo_url: logo ? `${this.base}${logo}` : null,
      rating_avg: isNaN(rating) ? null : rating, rating_count: isNaN(votes) ? null : votes,
      min_payout: minNum ? parseInt(minNum[1].replace(/\s/g, ""), 10) : null, min_payment_raw: minp && !/любая/i.test(minp) ? minp : null,
      offers_count: num("Офферы") ?? null,
      tags: cat ? [cat.toLowerCase()] : [],
      extra: { category: cat || undefined, closed: closed || undefined, reviews: { total: num("Отзывы"), recommend: num("рекомендую"), not_recommend: num("не рекомендую"), undecided: num("не определился") }, min_payout_any: /любая/i.test(minp) || undefined },
    };
  },
};
