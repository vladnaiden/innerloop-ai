// media-analytics.jp/affisearch/promotions/<slug> — アフィサーチ (Affisearch by Media Analytics):
// 6,500+ Japanese affiliate cases (案件) with, per ASP carrying the case, the published reward
// (円 or %), the ASP's name, the case blurb + conditions, category; plus the per-ASP availability
// table (type, listing status). One record per case; ASP rows kept in extra. Sitemaps: promotions-N.xml.
const { text, decode, between, ldjson } = require("./_common");
module.exports = {
  name: "affisearch", lang: "ja", region: "JP", base: "https://media-analytics.jp",
  async list(af) {
    const out = [];
    for (let n = 1; n <= 10; n++) {
      let r; try { r = await af.get(`${this.base}/affisearch/sitemaps/promotions-${n}.xml`, { tries: 2, maxChars: 3000000 }); } catch (e) { if (/HTTP 404/.test(e.message)) break; throw e; }
      const locs = [...(r.html || r.text || "").matchAll(/<loc>(https:\/\/media-analytics\.jp\/affisearch\/promotions\/([a-z0-9_-]+))<\/loc>/g)];
      if (!locs.length) break;
      for (const m of locs) out.push({ url: m[1], slug: m[2] });
    }
    return out;
  },
  urlFor(slug) { return `${this.base}/affisearch/promotions/${slug}`; },
  parse(html, url) {
    const h = String(html).replace(/<script[\s\S]*?<\/script>/g, "");
    const name = text(decode((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "")).replace(/のアフィリエイト案件を提携できるASP一覧$/, "");
    if (!name) throw new Error("no name");
    const bc = ldjson(String(html)).find((j) => j && j["@type"] === "BreadcrumbList");
    const cat = bc && bc.itemListElement && bc.itemListElement[1] ? text(bc.itemListElement[1].name) : "";
    const rows = [];
    for (const m of h.matchAll(/<article [\s\S]*?<\/article>/g)) {
      const a = m[0];
      const title = text(decode((a.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1] || ""));
      const reward = text(decode((a.match(/data-testid="asp-promotion-list-item-reward">([\s\S]*?)<\/span>/) || [])[1] || ""));
      const asp = text(decode((a.match(/<span class="truncate">([^<]*)<\/span><\/span><\/span><\/div><\/a>/) || a.match(/[\s\S]*<span class="truncate">([^<]*)<\/span>/) || [])[1] || ""));
      const blurb = text(decode((a.match(/whitespace-pre-line[^>]*>([\s\S]*?)<\/span>/) || [])[1] || "").replace(/<[^>]+>/g, " ")).replace(/\s*(掲載条件\s*)?成果報酬発生条件.*$/, "");
      if (title || reward) rows.push({ title, reward, asp, blurb });
    }
    const table = between(h, "ASP別の取り扱い状況", "</table>") || "";
    const asps = [...table.matchAll(/<tr>[\s\S]*?<\/tr>/g)].slice(0).map((t) => text(decode(t[0]).replace(/<[^>]+>/g, " | "))).filter((s) => s && !/^ASP \|/.test(s));
    const yen = rows.map((r) => (r.reward.match(/([\d,]+)\s*円/) || [])[1]).filter(Boolean).map((s) => parseInt(s.replace(/,/g, ""), 10));
    const pct = rows.map((r) => (r.reward.match(/([\d.]+)\s*%/) || [])[1]).filter(Boolean).map(Number);
    const desc = rows[0]?.blurb || "";
    return {
      program_name: name, domain: `affisearch.${url.split("/").pop()}`, signup_url: url,
      description: desc.slice(0, 4000) || null, network: rows[0]?.asp || null,
      commission: rows.map((r) => `${r.asp ? r.asp + ": " : ""}${r.reward}`).filter((s) => /\d/.test(s)).join("; ") || null,
      commission_type: pct.length && !yen.length ? "CPS" : yen.length ? "CPA" : null,
      flat_min: yen.length ? Math.min(...yen) : null, flat_max: yen.length ? Math.max(...yen) : null, currency: yen.length ? "JPY" : null,
      pct_min: pct.length ? Math.min(...pct) : null, pct_max: pct.length ? Math.max(...pct) : null,
      tags: cat ? [cat] : [],
      extra: { category: cat || undefined, asp_rows: rows.length ? rows.map(({ title, reward, asp }) => ({ title, reward, asp })) : undefined, asp_table: asps.length ? asps.slice(0, 30) : undefined },
    };
  },
};
