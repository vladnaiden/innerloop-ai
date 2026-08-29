// affilord.com/affiliate_programs/<slug>/ — Affilord, crypto-casino affiliate-programme directory:
// ~130 programmes with website, Telegram, email (Cloudflare-obfuscated, decoded), about text,
// GEO regions, licence, products, commission types, payout methods, and a details grid (negative
// carryover, admin fee, live support, accepts crypto, looking for streamers). Listing: WP REST.
const { text, decode, between, host } = require("./_common");
const cfmail = (hex) => { const k = parseInt(hex.slice(0, 2), 16); let s = ""; for (let i = 2; i < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ k); return s; };
module.exports = {
  name: "affilord", lang: "en", region: "global", base: "https://affilord.com",
  async list(af) {
    const out = new Map();
    for (let p = 1; p <= 20; p++) {
      let r; try { r = await af.get(`${this.base}/wp-json/wp/v2/affiliate_programs?per_page=100&page=${p}&_fields=slug`, { tries: 1, maxChars: 900000 }); } catch (e) { break; }
      let a = []; try { a = JSON.parse(r.html || r.text || "[]"); } catch (e) { break; }
      if (!Array.isArray(a) || !a.length) break;
      for (const x of a) if (x.slug) out.set(x.slug, { url: `${this.base}/affiliate_programs/${x.slug}/`, slug: x.slug });
      await af.pace(800);
    }
    return [...out.values()];
  },
  urlFor(slug) { return `${this.base}/affiliate_programs/${slug}/`; },
  parse(html, url) {
    const h = String(html);
    const name = text(decode((h.match(/<h1 class="entry-title"[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || ""));
    if (!name) throw new Error("no name");
    const wrap = between(h, '<div class="aff-program-wrapper">', "</header>") || "";
    const sec = (title) => between(wrap, `<h3>${title}</h3>`, '<div class="aff-section">') || between(wrap, `<h3>${title}</h3>`, "</header>") || "";
    const tags = (title) => [...sec(title).matchAll(/<span class="aff-tag">([^<]*)<\/span>/g)].map((m) => text(m[1]));
    const contact = sec("Contact");
    const site = (contact.match(/href="(https?:\/\/(?!affilord\.com)[^"]+)"/) || [])[1] || null;
    const tg = (contact.match(/<span>(@[A-Za-z0-9_]+)<\/span>/) || [])[1] || null;
    const cf = (contact.match(/data-cfemail="([0-9a-f]+)"/) || [])[1];
    const email = cf ? cfmail(cf) : (contact.match(/mailto:([^"]+)"/) || [])[1] || null;
    const about = text(decode(sec("About").replace(/<\/p>/g, " · ").replace(/<[^>]+>/g, " "))).replace(/(\s*·\s*)+$/, "");
    const details = {}; for (const m of wrap.matchAll(/<div class="aff-detail-item">\s*<span>([^<]*)<\/span>\s*<span class="aff-badge[^"]*">([^<]*)<\/span>/g)) details[text(m[1])] = /^yes$/i.test(text(m[2])) ? true : /^no$/i.test(text(m[2])) ? false : text(m[2]);
    const models = tags("Commission");
    const type = models.length > 1 ? "Hybrid" : /rev share/i.test(models[0] || "") ? "RevShare" : /cpa/i.test(models[0] || "") ? "CPA" : /ppc/i.test(models[0] || "") ? "CPC" : models[0] || null;
    return {
      program_name: name, domain: site ? host(site) : `affilord.${url.split("/").filter(Boolean).pop()}`, landing_url: site, signup_url: site || url, contact_email: email, telegram: tg,
      description: about.slice(0, 4000) || null, commission_type: type, commission_types: models.length ? models : null, recurring: models.some((m) => /rev share/i.test(m)) ? true : null,
      payment_methods: tags("Payout Methods").length ? tags("Payout Methods") : null,
      tags: ["igaming", ...tags("Products").map((t) => t.toLowerCase())],
      extra: { geos: tags("GEOs"), licence: tags("License"), products: tags("Products"), negative_carryover: details["Negative Carryover"], admin_fee: details["Admin Fee"], live_support: details["Live Support"], accepts_crypto: details["Accepts Crypto"], looking_for_streamers: details["Looking for Streamers"] },
    };
  },
};
