"use strict";
const { classify, CATEGORIES } = require("./taxonomy.js");
/**
 * Canonical filter values — the translation layer for everything a reader can filter by.
 *
 * The registry is scraped from directories in a dozen languages, so one real thing arrives under many
 * names: `nutra` / `Нутра` / `Krása a zdraví`, `wire transfer` / `банковский перевод` / `bank transfers`,
 * `monthly` / `раз в месяц` / `once a month`. Filtering on the raw strings splits every category.
 *
 * This maps them to one English label per dimension. Two rules make it safe:
 *
 *   1. The RAW VALUE IS NEVER OVERWRITTEN. The canonical form goes in a parallel `*_en` column, so
 *      provenance survives, a wrong mapping is reversible, and re-running the crawler cannot corrupt data.
 *   2. Anything unmapped KEEPS ITS OWN LABEL. A category can never disappear by being unlisted — it just
 *      shows up in its original spelling until somebody adds a line here.
 *
 * Adding a synonym is one line of data. Used by crawl_sites.js on every upsert and by backfill_canon.js.
 */

const VERTICAL = {
  "Nutra & health": ["nutra", "nutra & beauty", "нутра", "supplements", "health and beauty", "здоровье",
    "krása a zdraví", "healthcare and social assistance", "beauty", "cosmetics", "santé et beauté",
    "sant� et beaut�", "health", "нутра и красота", "potraviny a doplňky stravy", "фарма продукты", "pharma"],
  "E-commerce": ["ecommerce", "e-commerce", "commerce", "shopping", "retail trade", "интернет магазины",
    "интернет-магазины", "мульти-маркеты", "wholesale trade", "goods", "physical goods", "retail",
    "товары", "online shopping", "порталы", "others", "sales", "ostatní"],
  "Finance": ["finance", "financial", "финансы", "credit", "insurance", "finance and insurance", "banking",
    "кредиты", "loans", "займы", "финансы и страхование", "финансовые программы", "finances",
    "finance, pojištění a služby", "finanční služby"],
  "Dating": ["dating", "adult dating", "знакомства", "знакомства и общение", "casual dating",
    "matchmaking dating", "знакомства онлайн", "seznamka"],
  "iGaming": ["igaming", "gambling", "betting", "gambling & betting", "casino", "азартные игры", "азарт",
    "казино", "ставки", "sports betting", "poker", "bookmakers", "букмекеры", "гемблинг",
    "gambling & money games", "jeux", "sázení"],
  "SaaS & software": ["saas", "software", "software & saas", "по", "программное обеспечение", "cloud"],
  "Mobile": ["mobile", "mobile apps", "mobile app", "приложения", "apps", "android", "ios", "wap",
    "mobile content", "mobile subscriptions", "cpi", "мобильные приложения", "mobile games"],
  "Travel": ["travel", "travel and holidays", "путешествия", "tourisme", "transport and travel",
    "transports", "travel / tickets", "accommodation", "туризм", "hotels", "flights", "cestování",
    "туризм, путешествия", "билеты на самолеты", "аренда автомобилей", "car rental", "loisirs"],
  "Games": ["games", "online games", "игры", "онлайн-игры", "клиентские игры", "браузерные игры", "gaming",
    "browser games", "hry", "děti a hry"],
  "Fashion": ["fashion", "одежда", "мода и красота", "móda a doplňky", "обувь", "fashion and jewelry",
    "jewelry", "accessories", "аксессуары", "clothing", "мода", "shoes", "ювелирные украшения",
    "нижнее белье", "lingerie", "móda"],
  "Home & garden": ["garden", "house and garden", "home and garden", "товары для дома", "dům a zahrada",
    "maison", "home decoration", "furniture", "home improvement", "home / house", "furniture and interior",
    "home_services", "мебель", "дом и сад", "appliances", "строительство и ремонт", "building",
    "home furnishing", "household appliances", "tools", "vie pratique", "инструменты"],
  "Food": ["food", "продукты питания", "alimentaire", "еда", "food and drink", "groceries"],
  "Education": ["education", "образование", "educational services", "books", "книги, электронные книги",
    "courses", "курсы", "vzdělávání"],
  "Sport": ["sport", "sport & hobby", "спорт и отдых", "sports", "спорт", "fitness", "sport and recreation"],
  "Crypto": ["crypto", "crypto currency", "bitcoin", "cryptocurrency", "криптовалюта", "web3", "nft"],
  "Electronics": ["техника и электроника", "appliances and electronics", "elektro a příslušenství",
    "hardware", "informatique, high-tech", "electronics", "электроника", "computers"],
  "Services": ["services", "услуги", "интернет-услуги", "интернет-сервисы", "online services", "сервисы"],
  "Adult": ["adult", "adult content", "18+", "webcam", "для взрослых"],
  "Sweepstakes": ["sweepstakes", "свипстейки", "sweepstakes & surveys", "sign-ups", "surveys", "опросы",
    "incentive", "розыгрыши"],
  "Marketing": ["marketing", "media and marketing", "cpa network", "bizzopp", "заработок в интернете",
    "affiliate marketing", "маркетинг", "lead generation"],
  "Business": ["business", "manufacturing", "b2b", "бизнес", "arts, entertainment and recreation",
    "administration, business support and waste management services",
    "professional, scientific and technical services", "affiliate network", "collaboration & productivity"],
  "Entertainment": ["entertainment", "audio and video", "развлечения", "music", "streaming", "video",
    "хобби", "hobby", "art et culture", "искусство"],
  "Real estate": ["real_estate", "real estate", "недвижимость", "accommodation rental"],
  "Automotive": ["авто", "automotive", "cars", "автотовары", "auto", "товары для автомобилей",
    "автомобильные товары", "рынок автомобилей", "car parts", "автозапчасти", "téléphonie", "t�l�phonie"],
  "Kids": ["детские товары", "kids", "baby", "toys", "дети", "zvířata", "зоотовары", "pets", "famille"],
  "Gifts": ["gifts", "подарки", "dárky", "dárky a alkohol", "подарки и алкоголь"],
  "Pay per call": ["pay_per_call", "pay per call", "ppcall"],
};

/** How often affiliates are paid. Several sources list more than one; all recognised ones are kept. */
const FREQUENCY = {
  "Monthly": ["monthly", "once a month", "раз в месяц", "ежемесячно", "1 time per month", "per month",
    "měsíčně", "mensuel", "monatlich", "1 раз в месяц"],
  "Twice a month": ["twice a month", "2 раза в месяц", "semi-monthly", "bi-monthly", "2 times per month"],
  "Bi-weekly": ["bi-weekly", "biweekly", "раз в две недели", "every two weeks", "fortnightly"],
  "Weekly": ["weekly", "once a week", "раз в неделю", "еженедельно", "týdně", "hebdomadaire", "wöchentlich"],
  "Daily": ["daily", "ежедневно", "every day", "каждый день"],
  "Quarterly": ["quarterly", "ежеквартально", "раз в квартал"],
  "Net-7": ["net-7", "net 7", "net7"],
  "Net-15": ["net-15", "net 15", "net15"],
  "Net-30": ["net-30", "net 30", "net30"],
  "Net-45": ["net-45", "net 45", "net45"],
  "Net-60": ["net-60", "net 60", "net60"],
  "On request": ["upon request", "по запросу", "on request", "по требованию", "on demand", "по мере"],
  "Per sale": ["after each sale", "per sale", "за каждую продажу", "instant", "мгновенно", "real time"],
  "Not stated": ["other", "undisclosed", "n/a", "не указано", "unknown", "-"],
};

/** How the money actually arrives. */
const METHOD = {
  "PayPal": ["paypal", "pay pal", "пайпал"],
  "Wire transfer": ["wire transfer", "wire", "wire transfers", "swift", "банковский перевод",
    "bank transfer", "bank transfers", "bank wire", "банковский счет", "virement", "überweisung",
    "bankovní převod", "direct deposit", "bank"],
  "ACH": ["ach", "ach paypal", "automated clearing house"],
  "Card": ["visa", "mastercard", "card", "credit card", "карта", "bank card", "visa/mastercard"],
  "Crypto": ["bitcoin", "crypto", "usdt", "tether", "ethereum", "digital currencies", "cryptowallets",
    "btc", "eth", "криптовалюта", "cryptocurrency", "crypto wallet", "usdc"],
  "WebMoney": ["webmoney", "вебмани", "wmz"],
  "Skrill": ["skrill", "moneybookers"],
  "Neteller": ["neteller"],
  "Payoneer": ["payoneer"],
  "Capitalist": ["capitalist"],
  "Paxum": ["paxum"],
  "Qiwi": ["qiwi", "киви"],
  "ePayments": ["epayments", "epayment"],
  "Stripe": ["stripe"],
  "Wise": ["wise", "transferwise"],
  "Cheque": ["check", "checks", "cheque", "cheques", "чек"],
  "Yandex Money": ["yandex money", "яндекс деньги", "юmoney", "yoomoney"],
};

/** What the rate is paid for. Values are already English here; this fixes the presentation. */
const RATE_TYPE = {
  "CPA": ["cpa", "cost per action"],
  "RevShare": ["revshare", "rev share", "revenue share"],
  "Hybrid": ["hybrid"],
  "Percentage": ["percentage", "percent", "%"],
  "Network": ["network"],
  "Variable": ["variable"],
  "Per call": ["per_call", "per call", "cpc call"],
  "Per lead": ["per_lead", "per lead", "cpl"],
  "Per install": ["per_install", "per install", "cpi"],
};

function index(dict) {
  const m = new Map();
  for (const [canon, raws] of Object.entries(dict)) for (const r of raws) m.set(r, canon);
  return m;
}
const IDX = { vertical: index(VERTICAL), frequency: index(FREQUENCY), method: index(METHOD), rateType: index(RATE_TYPE) };

const norm = (s) => String(s == null ? "" : s).trim().toLowerCase();

/** One value → its canonical label, or the trimmed original when nothing matches. */
function one(kind, raw) {
  const n = norm(raw);
  if (!n) return null;
  return IDX[kind].get(n) || String(raw).trim();
}

/**
 * A frequency field often lists several ("net-30 , net-15 , weekly"). Split, canonicalise each, keep the
 * order and drop duplicates, so filtering by "Weekly" still finds it.
 */
function frequency(raw) {
  const n = norm(raw);
  if (!n) return null;
  const direct = IDX.frequency.get(n);
  if (direct) return direct;
  const parts = String(raw).split(/[,;/]| and | или |\|/).map((p) => p.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    const c = IDX.frequency.get(norm(p));
    if (c && !out.includes(c)) out.push(c);
  }
  return out.length ? out.join(", ") : String(raw).trim();
}

function methods(list) {
  if (!Array.isArray(list) || !list.length) return null;
  const out = [];
  for (const m of list) {
    const c = one("method", m);
    if (c && !out.includes(c)) out.push(c);
  }
  return out.length ? out : null;
}

/**
 * The canonical columns for one scraped row. Never touches the raw fields.
 *
 * Verticals go through the closed taxonomy in ./taxonomy.js rather than the open VERTICAL dictionary:
 * that dictionary translated a label but left 932 distinct "canonical" verticals, which is not a
 * browsable filter. `vertical_en` is now one of 22 Categories and `subvertical_en` the finer label.
 *
 * `vertical_original` is a verbatim copy of what the source published. `vertical` already holds it and
 * is not rewritten, but the explicit copy is what guarantees the source's own words survive any later
 * change to how `vertical` is populated — the generalisation must never be able to destroy the input.
 */
function canonRow(row) {
  const v = classify(row.vertical);
  return {
    vertical_original: row.vertical == null || String(row.vertical).trim() === "" ? null : String(row.vertical).trim(),
    vertical_en: v.category,
    subvertical_en: v.sub,
    payment_frequency_en: frequency(row.payment_frequency),
    payment_methods_en: methods(row.payment_methods),
    rate_type_en: one("rateType", row.rate_type),
  };
}

module.exports = { VERTICAL, FREQUENCY, METHOD, RATE_TYPE, canonRow, one, frequency, methods,
  CATEGORIES, classify,
  CANON_COLS: ["vertical_original", "vertical_en", "subvertical_en",
               "payment_frequency_en", "payment_methods_en", "rate_type_en"] };
