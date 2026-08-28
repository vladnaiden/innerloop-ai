// shared helpers for directory site modules — everything a parser needs that is
// not site-specific. Numbers are only ever taken from text that names the thing
// (commission / cookie), never from a nearby figure.
const decode = (s) => String(s || "")
  .replace(/&amp;/g, "&").replace(/&#37;/g, "%").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"')
  .replace(/&#x27;|&#39;/g, "'").replace(/&euro;/g, "€").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&laquo;/g, "«").replace(/&raquo;/g, "»").replace(/&hellip;/g, "…").replace(/&rsquo;/g, "’").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&shy;/g, "");
const text = (h) => decode(String(h || "").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, " ")
  .replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const num = (s) => { const m = String(s || "").replace(/\./g, "").replace(",", ".").match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; };
const numEn = (s) => { const m = String(s || "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; };
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } };
const ldjson = (h) => [...String(h).matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
  .map((m) => { try { return JSON.parse(m[1]); } catch { return null; } }).filter(Boolean);
const meta = (h, prop) => { const m = String(h).match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)`, "i")) || String(h).match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, "i")); return m ? decode(m[1]) : null; };
const between = (h, a, b) => { const i = String(h).indexOf(a); if (i === -1) return ""; const j = b ? String(h).indexOf(b, i + a.length) : -1; return String(h).slice(i, j === -1 ? undefined : j); };
// "25%-30%", "bis zu 20,00 %", "up to 50%" → {pct_min,pct_max}; only when a % sign is present
function pctRange(s) {
  const t = String(s || "").replace(/,(\d)/g, ".$1");
  const r = t.match(/(\d{1,3}(?:\.\d+)?)\s*%?\s*[-–—]\s*(\d{1,3}(?:\.\d+)?)\s*%/);
  if (r) return { pct_min: Math.min(+r[1], +r[2]), pct_max: Math.max(+r[1], +r[2]) };
  const o = t.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
  return o && +o[1] <= 100 ? { pct_min: +o[1], pct_max: +o[1] } : {};
}
module.exports = { decode, text, num, numEn, host, ldjson, meta, between, pctRange };
