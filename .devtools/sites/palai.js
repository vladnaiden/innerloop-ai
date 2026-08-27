// palai.media — Ukrainian affiliate-network directory (iGaming/dating). A network page
// is a labelled "characters" block plus manager cards (name | role, @telegram).
const { text, host, meta, between, decode } = require("./_common");
const charBlock = (h) => Object.fromEntries([...h.matchAll(/<strong class="character__key">([^<]*)<\/strong>\s*<p class="character__value">([\s\S]*?)<\/p>/g)].map((m) => [text(m[1]).replace(/:$/, ""), text(m[2])]));
const splitList = (s) => s ? s.split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean) : null;
module.exports = {
  name: "palai", lang: "uk", region: "UA", base: "https://palai.media",
  async list(af) {
    const r = await af.get(`${this.base}/sitemaps/directories.xml`, { tries: 2 });
    return [...(r.html || r.text || "").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
      .filter((u) => u.includes("/directories/affiliate-networks/")).map((url) => ({ url, slug: url.split("/").pop() }));
  },
  parse(html, url) {
    const h = String(html);
    const c = charBlock(h);
    const name = text((h.match(/Контакти ([^:<]+):/) || h.match(/Соцмережі ([^:<]+):/) || [])[1] || "") || text((meta(h, "og:title") || "").replace(/^Огляд партнерки\s*/i, "").split(":")[0]);
    const metaBlock = between(h, 'class="directory-meta', 'directory-meta__characters');
    const desc = text(between(metaBlock, '<p class="text">', "</p>").replace(/^<p[^>]*>/, ""));
    const signup = (h.match(/<a[^>]+href="([^"]+)"[^>]*>\s*Реєстрація/) || [])[1] || null;
    const managers = [...between(h, 'directory-meta__subtitle">Контакти', 'directory-meta__subtitle">Соцмережі').matchAll(/<a class="social-block__content"\s+href="([^"]*)"[^>]*>\s*<p class="social-block__title">([^<]*)<\/p>\s*<p class="social-block__text">([^<]*)<\/p>/g)]
      .map((m) => { const [n, role] = text(m[2]).split("|").map((s) => s.trim()); return { name: n, role: role || null, handle: text(m[3]), url: m[1] }; });
    const socials = [...between(h, 'directory-meta__social"', "</ul>").matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]).filter((u) => !u.includes("palai.media") && u !== signup);
    const chips = [...between(h, 'class="directory-meta', "directory-meta__characters").matchAll(/<a class="tag"[^>]*title="([^"]+)"/g)].map((m) => decode(m[1]));
    const vertical = c["Вертикалі"] || chips[0] || null;
    const tg = managers.map((m) => m.handle).find((x) => /^@/.test(x)) || null;
    return {
      program_name: name || null, domain: signup && host(signup) && !/palai\.media$/.test(host(signup)) ? host(signup) : `palai.${url.split("/").pop()}`, signup_url: signup, landing_url: signup,
      logo_url: meta(h, "og:image"), description: desc || meta(h, "og:description") || null,
      geo: c["Гео"] || null, commission_types: splitList(c["Моделі оплати"]), commission_type: c["Моделі оплати"] || null,
      offers_count: c["Кількість оферів"] ? parseInt(c["Кількість оферів"].replace(/\D/g, ""), 10) || null : null,
      payment_frequency: c["Регулярність виплат"] || null, payment_methods: splitList(c["Платіжні системи"]),
      min_payment_raw: c["Мінімальна виплата"] || null, vertical, categories: chips.length ? chips : null,
      managers: managers.length ? managers : null, affiliate_managers: managers.length ? managers.map((m) => `${m.name}${m.role ? ` (${m.role})` : ""} ${m.handle}`).join("; ") : null,
      telegram: tg, socials: socials.length ? socials : null,
      extra: { characters: c },
    };
  },
};
