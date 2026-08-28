// cpa.club/en/companies/<slug> — ~240 network/programme profiles with the richest public
// contact data seen so far: named managers with role, email, Telegram, Skype; tags;
// Organization JSON-LD (logo, sameAs); community ratings; the company's own site.
const { text, between, ldjson, decode, host } = require("./_common");
module.exports = {
  name: "cpa_club", lang: "en", region: "global", base: "https://cpa.club",
  async list(af) {
    const r = await af.get(`${this.base}/sitemap.xml`, { tries: 2 });
    const locs = [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/cpa\.club\/(?:en\/)?companies\/([a-z0-9_-]+)\/)<\/loc>/g)];
    const seen = new Map(); for (const m of locs) if (!seen.has(m[2])) seen.set(m[2], { url: `${this.base}/en/companies/${m[2]}/`, slug: m[2] });
    return [...seen.values()];
  },
  parse(html, url) {
    const h = String(html);
    const org = ldjson(h).flat().find((j) => j && j["@type"] === "Organization") || {};
    const name = org.name || text(between(h, "<h1", "</h1>").replace(/^<h1[^>]*>/, ""));
    if (!name) throw new Error("no name");
    const site = (h.match(/class="profile__link profile__link--website"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*class="profile__link profile__link--website"/) || []);
    const landing = site[1] || site[2] || (org.sameAs || []).find((u) => !/t\.me|linkedin|facebook|instagram|twitter|youtube|vk\.com/.test(u)) || null;
    const tags = [...h.matchAll(/class="profile__tags-link">([^<]*)</g)].map((m) => text(m[1])).filter((v, i, a) => v && a.indexOf(v) === i);
    const managers = [...between(h, 'class="profile__contacts-list', "</ul> </li> </ul>").matchAll(/<li class="profile__contacts-item">([\s\S]*?)<\/li>\s*(?=<li class="profile__contacts-item">|<\/ul>)/g)].map((m) => {
      const b = m[1];
      const mail = (b.match(/mailto:([^"?]+)/) || [])[1] || null, tg = (b.match(/t\.me\/([A-Za-z0-9_]+)/) || [])[1] || null, sk = (b.match(/skype:([^"?]+)/) || [])[1] || null;
      return { name: text((b.match(/contacts-name">([^<]*)</) || [])[1] || ""), role: text((b.match(/contacts-position">(?:<i>)?([^<]*)/) || [])[1] || "") || null, email: mail, handle: tg ? `@${tg}` : null, skype: sk };
    }).filter((x) => x.name || x.email);
    const ratings = Object.fromEntries([...h.matchAll(/rating-block">\s*<p>([^<]*)<\/p>\s*<p class="rating-num">([\d.]+)</g)].map((m) => [text(m[1]), parseFloat(m[2])]));
    const general = parseFloat((h.match(/rating-general-num">([\d.]+)</) || [])[1] || ""), reviews = parseInt((h.match(/reviews-num">\s*(\d+)/) || [])[1] || "", 10);
    const about = text(between(h, 'class="profile__description"', 'class="profile__links"').replace(/^[^>]*>/, "").replace(/<\/(p|li|h\d)>/g, " · "));
    const emails = [...new Set(managers.map((x) => x.email).filter(Boolean).concat((org.contactPoint || []).map((c) => c.email).filter(Boolean)))];
    const contacts = managers.flatMap((x) => [x.email && { type: "email", value: x.email }, x.handle && { type: "telegram", value: x.handle }, x.skype && { type: "skype", value: x.skype }].filter(Boolean));
    return {
      program_name: name, domain: landing ? host(landing) : `cpaclub.${url.replace(/\/$/, "").split("/").pop()}`, landing_url: landing, signup_url: url,
      logo_url: org.logo && (org.logo.url || org.logo) || null, description: about.slice(0, 3000) || null,
      vertical: tags.find((t) => !/network|program/.test(t)) || null, categories: tags.length ? tags : null,
      managers: managers.length ? managers : null, affiliate_managers: managers.map((x) => `${x.name}${x.role ? ` (${x.role})` : ""}`).join("; ") || null,
      contact_email: emails[0] || null, contact_emails: emails.length ? emails : null, contacts: contacts.length ? contacts : null,
      telegram: (managers.find((x) => x.handle) || {}).handle || null, skype: (managers.find((x) => x.skype) || {}).skype || null,
      socials: (org.sameAs || []).filter((u) => /t\.me|linkedin|facebook|instagram|twitter|youtube|vk\.com/.test(u)),
      rating_avg: Number.isFinite(general) && reviews ? general : null, rating_count: reviews || null,
      extra: { ratings: Object.keys(ratings).length ? ratings : undefined, rating_scale: 5, contact_points: org.contactPoint },
    };
  },
};
