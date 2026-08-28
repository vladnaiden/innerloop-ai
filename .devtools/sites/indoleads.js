// indoleads.com/offers/en/offer/<id> — Indoleads' public offer directory (~460): name with
// model (CPS/CPA/CPL), GEO, eCPC, hold, CR, cookie lifetime, creatives flags, a full
// traffic-restriction grid (Allow / Forbidden / Need approval), description.
const { text, between, decode } = require("./_common");
module.exports = {
  name: "indoleads", lang: "en", region: "global", base: "https://indoleads.com",
  async list(af) {
    const out = new Map();
    for (let p = 1; p <= 60; p++) {
      let r; try { r = await af.get(`${this.base}/offers/${p > 1 ? `?page=${p}` : ""}`, { tries: 2 }); } catch { break; }
      const ids = [...(r.html || "").matchAll(/href="https:\/\/indoleads\.com\/offers\/en\/offer\/(\d+)\/"/g)].map((m) => m[1]);
      let fresh = 0; for (const id of ids) if (!out.has(id)) { out.set(id, { url: `${this.base}/offers/en/offer/${id}/`, slug: id }); fresh++; }
      if (!ids.length || (p > 1 && !fresh)) break;
      await af.pace(2000);
    }
    return [...out.values()];
  },
  parse(html, url) {
    const h = String(html);
    const h1 = text(between(h, "<h1", "</h1>").replace(/^<h1[^>]*>/, ""));
    const m = h1.match(/(?:New offer launched:\s*)?(.+?)\s*\/\s*(CP[ASLI]|RevShare|Hybrid)\b/i);
    const name = m ? m[1].trim() : h1.replace(/^New offer launched:\s*/, "").replace(/\s*Affiliate Program$/, "");
    if (!name) throw new Error("no name");
    const model = m ? m[2].toUpperCase() : null;
    const geo = text((h.match(/GEO:\s*<[^>]*>\s*([^<]+)</) || h.match(/GEO:\s*([^<]{2,80})</) || [])[1] || "");
    const pairs = [...h.matchAll(/<span class="inline-block text-m-sm sm:text-base">([^<]*)<\/span>\s*<span class="inline-block text-m-sm text-[^"]*sm:text-base">\s*([^<]*?)\s*<\/span>/g)].map((x) => [text(x[1]), text(x[2])]);
    const restrictions = {}, stats = {};
    for (const [k, v] of pairs) { if (/^(Allow|Forbidden|Need approval)$/i.test(v)) restrictions[k] = v; else stats[k] = v; }
    const desc = text(between(h, "Description</h2>", "</div>").replace(/^[^>]*>/, ""));
    const cookie = (stats["Cookie lifetime"] || "").match(/(\d+)/), hold = (stats["Hold period"] || "").match(/(\d+)/);
    const app = (h.match(/href="(https:\/\/app\.indoleads\.com\/[^"]+)"/) || [])[1] || null;
    return {
      program_name: name, domain: `indoleads.${url.replace(/\/$/, "").split("/").pop()}`, signup_url: app || url, landing_url: null,
      description: desc.slice(0, 3000) || null, network: "Indoleads", commission_type: model, commission_types: model ? [model] : null,
      geo: geo || null, countries: /^[A-Z]{2}$/.test(geo) ? [geo] : null, hold_days: hold ? +hold[1] : null,
      cookie_days: cookie ? +cookie[1] : null, cookie_length_raw: stats["Cookie lifetime"] || null,
      numbers: { ecpc: stats["eCPC"] || null, cr: stats["CR"] || null },
      extra: { stats, traffic_restrictions: Object.keys(restrictions).length ? restrictions : undefined, kind: "offer", indoleads_id: url.replace(/\/$/, "").split("/").pop() },
    };
  },
};
