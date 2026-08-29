// Strips third-party affiliate attribution from stored URLs. Rules are data:
//  - TRACKING_HOSTS / TRACKING_PATHS: the URL is somebody's redirect or click tracker, not the
//    programme page -> drop it (null). ShareASale r.cfm links are rewritten to the merchant page.
//  - PARAMS: attribution / tracking query parameters removed from otherwise normal URLs.
//  - Placeholders like {clickId} mean a raw network tracking template -> drop.
// Returns { url, changed, reason }.
const TRACKING_HOSTS = /(^|\.)(pxf\.io|sjv\.io|prf\.hn|awin1\.com|anrdoezrs\.net|dpbolvw\.net|jdoqocy\.com|kqzyfj\.com|tkqlhce\.com|linksynergy\.com|click\.linksynergy\.com|partnerlinks\.io|bit\.ly|tinyurl\.com|goto\.15m\.com|go\.linkwi\.se|tradedoubler\.com|zanox\.com|adcell\.com\/click|go2cloud\.org|hasoffers\.com|track\.[a-z0-9-]+\.[a-z]+|trk\.[a-z0-9-]+\.[a-z]+|clk\.[a-z0-9-]+\.[a-z]+|clicks?\.[a-z0-9-]+\.[a-z]+|redirect\.[a-z0-9-]+\.[a-z]+|go\.[a-z0-9-]+\.[a-z]+|lnk\.[a-z0-9-]+\.[a-z]+|ref\.[a-z0-9-]+\.[a-z]+)$/i;
const TRACKING_PATHS = /(^|\/)(go|out|click|clicks|track|tracking|trk|redirect|redir|visit|aff|ref|referral|referal|recommends|recommend|goto|jump|exit|away|leave)(\/|$|\?)|\/creative\/|\/creatives\/|\/preview\/|\/(click|go|out|redirect)\.(php|aspx|html?)|redirect\.aspx|trackingcode\.aspx|\/api\/(click|go)|ref_link|\/L\?|\/c\/[0-9a-z]{6,}$|\/sc\/[0-9a-z]{6,}$/i;
const PARAMS = new Set(["ref", "refid", "ref_id", "refcode", "ref_code", "referral", "referral_code", "referrer", "referer", "aff", "affid", "aff_id", "affiliate", "affiliate_id", "affiliates", "afftrack", "aff_sub", "aff_click_id", "partner", "partner_id", "partnerid", "partner_link", "partner_key", "ps_partner_key", "ps_xid", "via", "fpr", "fp_ref", "sref", "tap_a", "tap_s", "a_aid", "a_bid", "a_cid", "deal", "_go", "atp", "co-from", "promotion", "sourceid", "source_id", "inviter_code", "inviter", "ic", "a", "u", "b", "m", "pid", "sid", "subid", "sub_id", "sub_id1", "sub_id2", "sub_id3", "sub_id4", "sub_id5", "sub1", "sub2", "subid1", "s1", "s2", "promo", "promocode", "promo_code", "coupon", "coupon_code", "discount", "irclickid", "irgwc", "irpid", "cjevent", "cjdata", "awc", "clickid", "click_id", "zanpid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id", "mc_cid", "mc_eid", "gclid", "fbclid", "msclkid", "ttclid", "invite", "invite_code", "r", "rc", "code", "marker", "linkid", "link_id", "tracking", "track", "tid", "token", "hash", "mkt", "source", "src", "from", "campaign", "cmp", "offer_id", "landing_id", "rkm", "mbsy", "li", "gsxid", "gspk", "rfsn", "sca_ref", "afmc", "afid", "aid", "adid", "bid", "cid", "campaign_id", "ad", "ads", "tag", "tags", "pk_campaign", "pk_kwd", "epik", "_ga", "yclid", "affiliateid", "affiliatecode", "afl", "aflt", "amb", "ambassador", "friend", "inviter", "p", "ru", "rid", "referral_id", "referrer_id", "trkid", "trk_id", "refer", "referafriend", "raf", "share", "shareid", "inv", "hop", "hopid", "sl", "cl", "sscid", "irclick", "grsf", "ic", "lc"]);
// params that identify a network's programme page rather than a referrer — keep them on these hosts
const KEEP = { "signup.cj.com": ["cid"], "www.cj.com": ["cid"], "members.cj.com": ["cid"], "www.shareasale.com": ["merchantid"], "shareasale.com": ["merchantid"], "ui.awin.com": ["mid", "merchantid"], "www.awin.com": ["mid"], "rakutenadvertising.com": ["mid"], "click.linksynergy.com": [], "app.impact.com": [] };
// "strong" keys mean the whole URL is someone's tracking link (an affiliate id, sub-ids, click ids) -> drop it
const STRONG = new Set(["affid", "aff_id", "affiliate_id", "affiliateid", "aff_sub", "aff_click_id", "sub1", "sub2", "sub3", "subid", "sub_id", "sub_id1", "sub_id2", "sub_id3", "sub_id4", "sub_id5", "subid1", "clickid", "click_id", "irclickid", "cjevent", "awc", "zanpid", "transaction_id", "_ef_transaction_id", "tracking_id", "trkid", "trk_id", "hop", "hopid", "sscid", "rfsn", "mbsy", "refid", "partner_id", "partnerid", "pid", "uid", "oid", "afftrack", "afmc", "raf", "aff", "sid"]);
// directory brands whose name inside a URL is attribution to that directory, wherever it sits
const BRANDS = /(affiliatewatch|affwatch|affiliate-watch|affililist|offervault|affpaying|uppromote|linkclicky|cuelinks|topranked|15m\.com|affnext|affcaptain|partnerkin|palaimedia|leadpandamedia|gdetraffic|affmoment|statsdrone|affcatalog|affroom|affbank|businessofapps|afftank|cpa[-_.]?club|getreditus|reditus|affiliateroll|partnerstack|indoleads|affiliatekatalog|affiverse|affilord|findaffiliates|afliet|alverde|e-provize|vivnetworks|2performant|profitshare|gambling-partnerki|gooodbro|travelpayouts|affisearch|affdays|affhub|uaff|palai|conversion\.im|cpainform|cpad\.pro|affplus|affbun|lasso)/i;
const PLACEHOLDER = /\{[a-z_]+\}|\[\[|%7B[a-z_]+%7D/i;
function clean(url) {
  if (!url || typeof url !== "string") return { url: null, changed: false, reason: null };
  let u = url.trim().replace(/&amp;|&#038;/g, "&");
  if (!/^https?:\/\//i.test(u)) return { url: null, changed: true, reason: "not-http" };
  if (PLACEHOLDER.test(u)) return { url: null, changed: true, reason: "tracking-template" };
  let p; try { p = new URL(u); } catch (e) { return { url: null, changed: true, reason: "unparseable" }; }
  const host = p.hostname.toLowerCase();
  if (/(^|\.)shareasale\.com$/.test(host) && /\/r\.cfm/i.test(p.pathname)) {
    const link = p.searchParams.get("urllink") || "";
    const mid = (decodeURIComponent(link).match(/merchantID=(\d+)/i) || [])[1] || (u.match(/merchantID(?:=|%3D)(\d+)/i) || [])[1];
    return mid ? { url: `https://www.shareasale.com/shareasale.cfm?merchantID=${mid}`, changed: true, reason: "shareasale-rcfm" } : { url: null, changed: true, reason: "shareasale-rcfm-nomerchant" };
  }
  if (TRACKING_HOSTS.test(host)) return { url: null, changed: true, reason: "tracking-host" };
  if (/(^|\.)affiliate\.watch$/.test(host)) return { url: null, changed: true, reason: "directory-own-link" };
  if (BRANDS.test(p.pathname) || BRANDS.test(p.hash)) return { url: null, changed: true, reason: "brand-in-path" };
  for (const [k, v] of [...p.searchParams.entries()]) if (BRANDS.test(v)) p.searchParams.delete(k);
  if (TRACKING_PATHS.test(p.pathname + p.search)) return { url: null, changed: true, reason: "tracking-path" };
  if (/\/(signup|register|sign-up|registration|join)\b/i.test(p.pathname) && [...p.searchParams.keys()].some((k) => PARAMS.has(k.toLowerCase()))) {
    // network sign-up form carrying a referrer id: keep the form, drop the referrer
  }
  const keep = new Set((KEEP[host] || []).map((k) => k.toLowerCase()));
  const keys = [...p.searchParams.keys()].map((k) => k.toLowerCase()).filter((k) => !keep.has(k));
  if (keys.some((k) => STRONG.has(k)) && !/\/(signup|sign-up|register|registration|join|affiliate|affiliates|partners?)\b/i.test(p.pathname)) return { url: null, changed: true, reason: "affiliate-link" };
  let changed = p.toString() !== new URL(u).toString();
  for (const k of [...p.searchParams.keys()]) if (!keep.has(k.toLowerCase()) && (PARAMS.has(k.toLowerCase()) || STRONG.has(k.toLowerCase()) || /^(utm_|aff|ref|sub|partner|tap_|irclick|mc_|pk_|_hs)/i.test(k))) { p.searchParams.delete(k); changed = true; }
  if (p.hash && /^#(ref|aff|via|r)[=:-]/i.test(p.hash)) { p.hash = ""; changed = true; }
  if (!changed) return { url, changed: false, reason: null }; // untouched: keep the exact original string
  const out = p.toString().replace(/\?$/, "").replace(/\/\?$/, "/");
  return { url: out, changed: true, reason: "params" };
}
module.exports = { clean, PARAMS, TRACKING_HOSTS, TRACKING_PATHS };
if (require.main === module) for (const a of process.argv.slice(2)) console.log(a, "->", JSON.stringify(clean(a)));
