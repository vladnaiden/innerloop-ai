// clubaffiliation.com — French directory of ~1,700 programmes: remuneration lines
// (CPC €, % per sale, fixed lead), campaign start, category, diffusion rules, platform.
// The site is ISO-8859-1; accents may arrive as U+FFFD through the proxy — numbers are unaffected.
const { text, between, decode, host } = require("./_common");
const A = "[^\\s:]*"; // an accented word fragment, encoding-agnostic
module.exports = {
  name: "clubaffiliation", lang: "fr", region: "FR", base: "https://www.clubaffiliation.com",
  async list(af) {
    const out = new Map();
    const add = (html) => { for (const m of String(html || "").matchAll(/href="\/programme\/([a-z0-9-]+-(\d+))\.html"/g)) out.set(m[2], { url: `${this.base}/programme/${m[1]}.html`, slug: m[2] }); };
    const r = await af.get(`${this.base}/rechercher-programmes-affiliation.html?page=2`, { tries: 2 }); add(r.html);
    const cats = [...String(r.html || "").matchAll(/href="\/categorie\/([a-z0-9-]+)\.html"/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i);
    for (const c of cats) { await af.pace(2000); try { add((await af.get(`${this.base}/categorie/${c}.html`, { tries: 2 })).html); } catch {} }
    return [...out.values()];
  },
  parse(html, url) {
    const h = String(html);
    const name = text(between(h, "<h1>", "</h1>").replace(/^<h1>/, ""));
    const fiche = between(h, 'class="info_fiche"', 'class="info_fiche_r"');
    const landing = (fiche.match(/<a href="(https?:\/\/[^"]+)"/) || [])[1] || null;
    const desc = text(fiche.replace(/^[\s\S]*?<\/div>/, ""));
    const meta_ = text(between(h, 'class="info_fiche_r"', "</em>"));
    const start = (meta_.match(/campagne\s*:\s*([^C]+?)\s*Cat/) || [])[1];
    const cat = (meta_.match(/Cat\S*gorie\s*:\s*(.+)$/) || [])[1];
    const rem = text(between(h, "munération</h2>", "</table>").replace(/<\/tr>|<\/li>|<br\s*\/?>/g, " | ")) || text(between(h, "mun�ration</h2>", "</table>").replace(/<\/tr>|<\/li>|<br\s*\/?>/g, " | "));
    const remLines = (rem || text(between(h, "R�mun�ration", "Conditions").replace(/<\/tr>|<\/li>|<br\s*\/?>/g, " | "))).split("|").map((s) => s.trim().replace(/^[^A-Za-z]*mun\S*ration\s*/, "")).filter((s) => /\d/.test(s) && !/Point Communication|©|&COPY;/i.test(s));
    const clic = (remLines.find((l) => /Clic/i.test(l)) || "").match(/([\d.,]+)\s*(?:€|&euro;|�)/);
    const pct = (remLines.find((l) => /pourcentage/i.test(l)) || "").match(/([\d.,]+)\s*%/);
    const fixed = (remLines.find((l) => /fixe|Lead|Vente fixe/i.test(l)) || "").match(/([\d.,]+)\s*(?:€|&euro;)/);
    const cond = Object.fromEntries([...between(h, "Conditions de diffusion", "</div>").matchAll(/([A-Za-z�à-ÿ ]{3,30})\s*:\s*(Oui|Non)/g)].map((m) => [text(m[1]), m[2] === "Oui"]));
    const platform = (h.match(/href="\/plateforme\/([a-z0-9-]+)-\d+\.html"/) || [])[1];
    const cur = (v) => v ? parseFloat(v[1].replace(",", ".")) : null;
    return {
      program_name: name || null, domain: landing ? host(landing) : `clubaffiliation.${url.match(/-(\d+)\.html$/)?.[1]}`, landing_url: landing, signup_url: url,
      description: desc.slice(0, 3000) || null, categories: cat ? [cat.trim()] : null, vertical: cat ? cat.trim() : null,
      network: platform ? platform.replace(/-/g, " ") : null, country: "FR", countries: ["FR"], currency: "EUR",
      commission: remLines.join("; ").slice(0, 300) || null,
      commission_type: [pct && "CPS", fixed && "CPA", clic && "CPC"].filter(Boolean).join(" / ") || null,
      pct_min: cur(pct), pct_max: cur(pct), flat_min: cur(fixed) ?? cur(clic), flat_max: cur(fixed) ?? cur(clic),
      extra: { start_date_raw: start ? start.trim() : undefined, cpc_eur: cur(clic), diffusion: Object.keys(cond).length ? cond : undefined, encoding_note: "source is ISO-8859-1; accents may be lost" },
    };
  },
};
