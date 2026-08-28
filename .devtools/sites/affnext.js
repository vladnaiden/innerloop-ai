// affnext.com — directory of affiliate programmes (~490) and networks (~700). Profile pages
// carry a schema.org LocalBusiness (name, logo, description) and a "Specialties" tab
// (verticals). Commission figures appear only in free prose, so none are extracted.
const { text, between, ldjson, decode } = require("./_common");
module.exports = {
  name: "affnext", lang: "en", region: "global", base: "https://affnext.com",
  async list(af) {
    const out = new Map();
    for (const kind of ["affiliate-programs", "affiliate-networks"]) {
      for (let p = 1; p <= 120; p++) {
        let r; try { r = await af.get(`${this.base}/${kind}?page=${p}`, { tries: 2 }); } catch { break; }
        const links = [...(r.html || "").matchAll(new RegExp(`href="(?:https://www\\.affnext\\.com)?/${kind}/([A-Za-z0-9-]+)"`, "g"))].map((m) => m[1]);
        let fresh = 0; for (const s of links) { const k = `${kind}/${s}`; if (!out.has(k)) { out.set(k, { url: `${this.base}/${kind}/${s}`, slug: `${kind === "affiliate-programs" ? "p" : "n"}-${s.toLowerCase()}` }); fresh++; } }
        if (!links.length || (p > 1 && !fresh)) break;
        await af.pace(2000);
      }
    }
    return [...out.values()];
  },
  parse(html, url) {
    const h = String(html);
    const graph = ldjson(h).flatMap((j) => j["@graph"] || [j]);
    const biz = graph.find((g) => g["@type"] === "LocalBusiness" || g["@type"] === "Organization");
    if (!biz || !biz.name) throw new Error("no profile entity (category page)");
    const about = text(between(h, 'class="froala-data field-about_me"', "</div></div>").replace(/^[^>]*>/, "").replace(/<\/(p|li|h\d)>/g, " · "));
    const specs = [...between(h, 'id="div2"', 'id="div6"').matchAll(/specialty-name[^>]*>\s*<a[^>]*>([^<]*)<\/a>/g)].map((m) => text(m[1])).filter((v, i, a) => v && a.indexOf(v) === i);
    const kind = /\/affiliate-networks\//.test(url) ? "network" : "program";
    const site = (h.match(/class="[^"]*website[^"]*"[^>]*href="(https?:\/\/(?!www\.affnext)[^"]+)"/) || h.match(/href="(https?:\/\/(?!www\.affnext\.com)[^"]+)"[^>]*>\s*(?:Visit|Website)/i) || [])[1] || null;
    const logo = biz.image && (biz.image.url || biz.image) || null;
    return {
      program_name: biz.name, domain: site ? new URL(site).hostname.replace(/^www\./, "") : `affnext.${url.split("/").pop().toLowerCase()}`, signup_url: url, landing_url: site,
      logo_url: typeof logo === "string" ? logo : null, description: (about || biz.description || "").slice(0, 3000) || null,
      vertical: specs[0] || null, categories: specs.length ? specs : null,
      extra: { kind, specialties: specs.length ? specs : undefined },
    };
  },
};
