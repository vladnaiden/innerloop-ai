// affiversemedia.com/affiliate_directory/<slug>/ — Affiverse's iGaming affiliate-programme
// directory (~100 programmes): free-text profiles that mostly follow a "Label: value" line
// convention (CPA, RevShare, Hybrid, Sub-affiliate commission, cookie duration, affiliate
// software, API / postbacks, accepted traffic, bundling, NGR formula…). Lines are captured as
// data (label -> value); commission numbers are taken only from explicit RevShare/CPA lines.
const { text, decode, between, host } = require("./_common");
const LABELS = ["CPA", "RevShare", "Rev Share", "Revenue Share", "HYBRID", "Hybrid", "Sub-Affiliate Commission", "Sub-affiliate", "Bundling", "Calculation formula", "Affiliate Software", "Tracking Link", "Cookie duration", "Cookie", "Supports API", "Postbacks", "Stats Update Time", "Stats Update Frequency", "Manual Report Available", "Dynamic Variables", "Minimum payout", "Min payout", "Payment methods", "Payment frequency", "Payout frequency", "Licence", "License", "Negative carryover", "Admin fee", "Founded", "Launched"];
module.exports = {
  name: "affiverse", lang: "en", region: "global", base: "https://www.affiversemedia.com",
  async list(af) {
    const out = new Map();
    for (let p = 1; p <= 30; p++) {
      let r; try { r = await af.get(p === 1 ? `${this.base}/directory/affiliate-program/` : `${this.base}/directory/affiliate-program/page/${p}/`, { tries: 2 }); } catch (e) { if (/HTTP 404/.test(e.message)) break; throw e; }
      const slugs = [...new Set([...(r.html || r.text || "").matchAll(/affiliate_directory\/([a-z0-9-]+)\//g)].map((m) => m[1]))];
      if (!slugs.length) break;
      for (const s of slugs) out.set(s, { url: `${this.base}/affiliate_directory/${s}/`, slug: s });
      await af.pace(1200);
    }
    return [...out.values()];
  },
  urlFor(slug) { return `${this.base}/affiliate_directory/${slug}/`; },
  parse(html, url) {
    const h = String(html);
    const name = text(decode((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "").replace(/<[^>]+>/g, " "));
    if (!name) throw new Error("no name");
    const body = between(h, 'class="wysiwyg content-body"', "</main>") || between(h, 'class="wysiwyg content-body"', "<footer") || "";
    const lines = decode(body.replace(/^[^>]*>/, "").replace(/<\/(p|li|h\d|div)>|<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, " ")).split("\n").map((l) => text(l)).filter(Boolean);
    const kv = {};
    for (const l of lines) { const m = l.match(/^([A-Za-z][A-Za-z /-]{2,40}?)\s*[:–-]\s*(.{1,200})$/); if (!m) continue; const lab = m[1].trim(); if (LABELS.some((L) => L.toLowerCase() === lab.toLowerCase()) && !kv[lab]) kv[lab] = m[2].trim(); }
    const join = (body.match(/<a href="(https?:\/\/(?!www\.affiversemedia\.com)[^"]+)"[^>]*>[^<]*(?:Join|Sign ?up|Register)[^<]*<\/a>/i) || [])[1] || (body.match(/<a href="(https?:\/\/(?!www\.affiversemedia\.com)[^"]+)"/) || [])[1] || null;
    const logo = (h.match(/"thumbnailUrl":"([^"]+)"/) || [])[1];
    const rs = kv["RevShare"] || kv["Rev Share"] || kv["Revenue Share"] || "", cpa = kv["CPA"] || "";
    const pct = [...rs.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => +m[1]);
    const flat = cpa.match(/(€|\$|£)\s*([\d,]+)/);
    const desc = lines.filter((l) => l.length > 60).slice(0, 6).join(" · ");
    const cookie = (kv["Cookie duration"] || kv["Cookie"] || "").match(/(\d+)\s*day/i);
    return {
      program_name: name.replace(/\s*-\s*Affiverse$/, ""), domain: join ? host(join.replace(/^https?:\/\/bit\.ly.*/, "")) || `affiverse.${url.split("/").filter(Boolean).pop()}` : `affiverse.${url.split("/").filter(Boolean).pop()}`, signup_url: join || url, logo_url: logo ? logo.replace(/\\\//g, "/") : null,
      description: desc.slice(0, 4000) || null,
      commission: [rs && `RevShare ${rs}`, cpa && `CPA ${cpa}`, kv["HYBRID"] || kv["Hybrid"] ? `Hybrid ${kv["HYBRID"] || kv["Hybrid"]}` : ""].filter(Boolean).join("; ") || null,
      commission_type: rs && cpa ? "Hybrid" : rs ? "RevShare" : cpa ? "CPA" : null,
      pct_min: pct.length ? Math.min(...pct) : null, pct_max: pct.length ? Math.max(...pct) : null,
      flat_max: flat ? parseFloat(flat[2].replace(/,/g, "")) : null, currency: flat ? { "€": "EUR", "$": "USD", "£": "GBP" }[flat[1]] : null,
      recurring: rs ? true : null, cookie_days: cookie ? +cookie[1] : null, cookie_length_raw: kv["Cookie duration"] || kv["Cookie"] || null,
      tracking_software: kv["Affiliate Software"] || null, tags: ["igaming"],
      extra: { fields: Object.keys(kv).length ? kv : undefined },
    };
  },
};
