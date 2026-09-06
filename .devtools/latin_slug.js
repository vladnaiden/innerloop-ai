/**
 * Latin-only slug minting — the one place that decides what a public URL may contain.
 *
 * Why it exists: `slugify` in crawl_sites.js / mk_slugs.js deliberately preserved Cyrillic
 * (`Ѐ-ӿ`) and CJK (`一-鿿`), so 15,380 of 196,915 program URLs were non-Latin.
 * Two costs, both measured 06.09.2026:
 *   - a non-ASCII slug in a `Location` header threw ERR_INVALID_CHAR and 500'd the 301 (cfcf8ea);
 *   - the owner's rule: every endpoint is Latin, named after the brand.
 *
 * A slug is still assigned once and never rewritten by a later crawl (crawl_sites.js); renames
 * go through rebrand_slugs.js / latinize_slugs.js, which record the 301 in `mr_slug_alias`.
 */

const GLOSSARY = require("./ru_en.json");

/** BGN/PCGN-style romanisation, the readable one. Ukrainian and Belarusian letters included. */
const CYR = {
  а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",
  н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"shch",
  ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya",
  і:"i",ї:"yi",є:"ye",ґ:"g",ў:"u",ђ:"dj",ј:"j",љ:"lj",њ:"nj",ћ:"c",џ:"dz",
};

/** Latin letters a script-free NFKD fold cannot reach (ß, æ, ø, đ, ł…). */
const LAT = { ß:"ss", æ:"ae", œ:"oe", ø:"o", đ:"d", ł:"l", ħ:"h", ŋ:"ng", þ:"th", ð:"d" };

/** Everything this transliterates to Latin; anything left is dropped by the fold below. */
const toLatin = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[а-яёіїєґўђјљњћџ]/g, (c) => CYR[c] ?? "")
    .replace(/[ßæœøđłħŋþð]/g, (c) => LAT[c] ?? "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "");

/** How much of the name's own letters survived — a CJK title scores ~0 and must use its domain. */
const latinYield = (s) => {
  const letters = String(s || "").match(/\p{L}|\p{N}/gu)?.length ?? 0;
  if (!letters) return 0;
  return (toLatin(s).match(/[a-z0-9]/g)?.length ?? 0) / letters;
};

/**
 * Russian -> English, for the descriptive half of a title. Transliteration gave
 * `spinline-casino-onlayn-kazino`; the owner's rule (06.09.2026) is brand + English, so this
 * yields `spinline-online-casino`.
 *
 * Order matters:
 *   1. phrases, longest first — Russian word order is not English ("капсулы от диабета" is
 *      *diabetes capsules*), and a phrase is the only place that can be fixed;
 *   2. the generic swap, for the same construction with a noun no phrase lists:
 *      "A от|для|против B" -> "B A";
 *   3. single words, then function words dropped;
 *   4. anything still unknown is transliterated — which is the RIGHT answer for a brand or
 *      product name ("Свобода" -> svoboda), not a failure.
 * A token repeated after translation keeps its LAST position, so a brand that already carries the
 * word ("Spinline Casino" + "онлайн казино") reads spinline-online-casino, not spinline-casino-online.
 */
const PHRASES = Object.entries(GLOSSARY.phrases).sort((a, b) => b[0].length - a[0].length);
const DROP = new Set(GLOSSARY.drop);
const SWAP = /([\p{Script=Cyrillic}]+)\s+(?:от|для|против)\s+([\p{Script=Cyrillic}]+)/giu;

function translate(s) {
  let t = String(s || "").toLowerCase();
  // Swap BEFORE the phrase table: a phrase that consumed "от диабета" first would hide the
  // construction and leave "capsules diabetes" instead of "diabetes capsules".
  t = t.replace(SWAP, (_, a, b) => `${b} ${a}`);
  for (const [ru, en] of PHRASES) if (t.includes(ru)) t = t.split(ru).join(` ${en} `);
  const out = [];
  for (const tok of t.split(/[^\p{L}\p{N}-]+/u)) {
    if (!tok) continue;
    if (!/\p{Script=Cyrillic}/u.test(tok)) { out.push(tok); continue; }   // already Latin, or our own output
    if (DROP.has(tok)) continue;
    out.push(GLOSSARY.words[tok] ?? latinSlugify(tok));
  }
  return out.filter(Boolean).join(" ");
}

/**
 * "Spinline Casino" + "онлайн казино" would read spinline-casino-online-casino. Drop a brand token
 * that the description already carries — but never the FIRST one, which is the brand's own name:
 * "Rakuten Advertising (бывш. Rakuten Marketing)" must stay rakuten-advertising-former-rakuten-marketing,
 * not advertising-former-rakuten-marketing. The description itself is never deduped; a repeat there
 * ("cpi ... cpi") is the source's own wording.
 */
const trimBrand = (brand, description) => {
  const desc = new Set(String(description).split(/[\s-]+/).filter(Boolean));
  const toks = String(brand).split(/[\s-]+/).filter(Boolean);
  return toks.filter((w, i) => i === 0 || !desc.has(w)).join(" ");
};

/** The slug itself: Latin, lowercase, hyphenated, never longer than 70. */
const latinSlugify = (s) =>
  toLatin(s)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/, "");

/**
 * When a source published no real domain the crawler synthesised one as `<adapter>.<source slug>`
 * (`affisearch.nihon-no-sansui`, `cpa.lead-magnet`). The head is the module name and must never
 * reach a URL; the tail is the source's own readable identifier — and for every Japanese title it
 * is the only romanisation that exists, since kana and kanji survive no character-wise fold.
 * Kept identical to rebrand_slugs.js so the site has one convention, not two.
 */
const usableDomain = (domain, adapter, modules) => {
  if (!domain) return null;
  const norm = (x) => String(x || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const na = norm(adapter);
  const i = domain.indexOf(".");
  if (i > 0) {
    const head = domain.slice(0, i);
    const nh = norm(head);
    // `site_adapter` is NULL on 1,665 rows, so matching the head against the adapter alone left the
    // module name in the URL (`affisearch.junku` -> affisearch-junku) — the very thing
    // rebrand_slugs.js exists to remove. The head is stripped when it names ANY known module too.
    const isModule = (na && (nh === na || na.startsWith(nh) || nh.startsWith(na)))
      || (modules && (modules.has(head) || modules.has(nh)));
    if (isModule) domain = domain.slice(i + 1);
  }
  if (/^[0-9-]+$/.test(domain)) return null;          // a bare id names nothing
  const na2 = norm(domain);
  if (na && na2.startsWith(na)) return null;          // still carrying the module name
  return domain;
};

/**
 * "Brand + English translation" (owner, 06.09.2026), applied literally.
 *
 * These titles are overwhelmingly `<brand> - <description>`: the first segment names the product
 * and the rest describes it. So segment one is TRANSLITERATED — translating it turns the Russian
 * brand "Сила пчелы" into "power-bee", which names nothing anyone searches for — and every later
 * segment is TRANSLATED, which is where "онлайн казино" becomes "online-casino".
 *
 * A single-segment title has no brand to separate, so it is transliterated whole; that is what it
 * already was, so nothing regresses.
 */
const SEGMENT = /\s+[-–—|/]+\s+|[(|]/;
/** Only a title in one of these scripts is translated at all — a stray en-dash or curly quote in an
 *  English title must not put the row through this path and re-mint a URL that is already correct. */
const TRANSLATABLE = /[\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/;
function brandThenEnglish(name) {
  const raw = String(name || "");
  if (!TRANSLATABLE.test(raw)) return raw;   // nothing to translate: leave the existing slug alone
  const parts = raw.split(SEGMENT).map((x) => x.trim()).filter(Boolean);
  if (parts.length < 2) return toLatin(parts[0] ?? "");
  const description = parts.slice(1).map(translate).join(" ");
  return `${trimBrand(toLatin(parts[0]), description)} ${description}`;
}

/**
 * The brand slug for a row, Latin, in the owner's stated order of preference:
 *   1. the title itself, transliterated — brand first, then the rest of the name
 *      ("Arkada - онлайн казино" -> arkada-onlayn-kazino);
 *   2. the source's readable domain tail, when the title is mostly CJK and romanises to nothing
 *      ("日本の山水" -> nihon-no-sansui);
 *   3. `program-<seq>`, so a row always has a URL.
 * Returns { slug, from } — `from` is reported by the dry run so a bad source is visible.
 */
function brandSlug({ program_name, domain, site_adapter, seq }, modules) {
  const dom = latinSlugify(usableDomain(domain, site_adapter, modules));
  const name = latinSlugify(brandThenEnglish(program_name));
  // A title that is mostly CJK yields a stub ("TCJ日本語教師養成講座" -> "tcj"); the romanised
  // domain tail carries the whole name and is the better URL.
  if (name.length >= 2 && (latinYield(program_name) >= 0.5 || !dom)) return { slug: name, from: "name" };
  if (dom.length >= 2) return { slug: dom, from: "domain" };
  if (name.length >= 2) return { slug: name, from: "name" };
  return { slug: `program-${seq}`, from: "seq" };
}

module.exports = { TRANSLATABLE, toLatin, latinSlugify, latinYield, usableDomain, brandSlug, translate, brandThenEnglish };

/* node latin_slug.js --self-test   — the rules that were got wrong at least once, pinned. */
if (require.main === module && process.argv.includes("--self-test")) {
  const mods = new Set(["cpad_offers", "affisearch"]);
  const slug = (program_name, domain = "cpad-offer.1", site_adapter = null) =>
    brandSlug({ program_name, domain, site_adapter, seq: 9 }, mods).slug;
  const cases = [
    // the owner's example: translated, not transliterated, and "casino" not repeated
    ["Spinline Casino - онлайн казино", "spinline-online-casino"],
    ["Arkada - онлайн казино", "arkada-online-casino"],
    // a Cyrillic BRAND is transliterated, never translated (power-bee names nothing)
    ["Сила пчелы - CIS - anti psoriasis cream", "sila-pchely-cis-anti-psoriasis-cream"],
    // Russian word order is not English: "капсулы от диабета" is *diabetes capsules*
    ["Gluconix - капсулы от диабета", "gluconix-diabetes-capsules"],
    ["Крем от морщин - описание", "krem-ot-morshchin-description"],
    // the first brand token survives even when the description repeats it
    ["Rakuten Advertising (бывш. Rakuten Marketing)", "rakuten-advertising-former-rakuten-marketing"],
    // an English title is never re-minted: & survives, nothing is deduped
    ["UK Blank B&W Checkout FB prefill 2 - Sweepstakes", "uk-blank-b-and-w-checkout-fb-prefill-2-sweepstakes"],
    ["ecom Jetterix INTL EN - ecom ecommerce shopping", "ecom-jetterix-intl-en-ecom-ecommerce-shopping"],
    // CJK romanises to nothing, so the source's readable domain tail is the brand
    ["日本の山水", "nihon-no-sansui", "affisearch.nihon-no-sansui"],
    // the module name never reaches a URL, even when site_adapter is NULL
    ["順区", "junku", "affisearch.junku"],
  ];
  let bad = 0;
  for (const [name, want, domain] of cases) {
    const got = slug(name, domain ?? "cpad-offer.1");
    if (got !== want) { bad++; console.error(`FAIL ${JSON.stringify(name)}\n  want ${want}\n  got  ${got}`); }
  }
  console.log(bad ? `${bad}/${cases.length} failed` : `all ${cases.length} slug rules hold`);
  process.exit(bad ? 1 : 0);
}
