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
  const name = latinSlugify(program_name);
  // A title that is mostly CJK yields a stub ("TCJ日本語教師養成講座" -> "tcj"); the romanised
  // domain tail carries the whole name and is the better URL.
  if (name.length >= 2 && (latinYield(program_name) >= 0.5 || !dom)) return { slug: name, from: "name" };
  if (dom.length >= 2) return { slug: dom, from: "domain" };
  if (name.length >= 2) return { slug: name, from: "name" };
  return { slug: `program-${seq}`, from: "seq" };
}

module.exports = { toLatin, latinSlugify, latinYield, usableDomain, brandSlug };
