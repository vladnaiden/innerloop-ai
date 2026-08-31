/**
 * The closed vertical taxonomy: every program lands in exactly one Category, and usually a Subcategory.
 *
 * Why closed. The first canonicalisation pass let anything unmapped keep its own label, which is safe but
 * does not generalise: 1,143 raw spellings became 932 "canonical" ones, so the filter still offered a
 * reader hundreds of near-duplicate choices in six languages. A registry is only browsable if the top
 * level is short enough to read at a glance.
 *
 * Three columns come out of this, and the contract between them matters:
 *   vertical_original  a verbatim copy of what the source published, never touched again
 *   vertical_en        the Category  — one of CATEGORIES below, Title Case, closed set
 *   subvertical_en     the Subcategory — finer, still from this file, may be null
 *
 * `vertical` keeps holding the raw value as it always did; `vertical_original` is the explicit,
 * guaranteed copy, so even a future crawler change that rewrites `vertical` cannot lose the source's
 * own words. Nothing here is ever destructive: the generalisation is additive, and re-running it over
 * clean data is a no-op.
 *
 * Rules are DATA and ORDER MATTERS — first match wins. Put the specific before the general, because
 * "adult dating" must reach Dating/Adult Dating before the bare "dating" rule, and "auto insurance"
 * must reach Automotive before "insurance" claims it for Finance.
 *
 * Patterns cover the languages actually present in the registry: English, Russian, Czech, French,
 * German, Spanish, Ukrainian — plus the mojibake the sources serve (`Sant� et Beaut�`), which is real
 * data and must match rather than be cleaned up first.
 */

const CATEGORIES = [
  "iGaming", "Dating", "Adult", "Finance", "Crypto", "Nutra & Health", "E-commerce",
  "Software & SaaS", "Mobile", "Gaming", "Travel", "Education", "Business Services",
  "Sweepstakes & Surveys", "Home & Real Estate", "Automotive", "Entertainment & Media",
  "Telecom & Internet", "Sports & Outdoors", "Make Money Online", "Services", "Other",
];

/** [pattern, Category, Subcategory|null] — first match wins, so specific rules come first. */
const RULES = [
  // ---------- specific compounds that would otherwise be claimed by a broader rule ----------
  [/adult\s*dating|casual\s*dating|секс.?знаком|интим/i, "Dating", "Adult Dating"],
  [/auto\s*insur|страхование\s*авто|assurance\s*auto/i, "Automotive", "Auto Insurance"],
  [/car\s*rent|rent\s*a\s*car|аренда\s*авто|location\s*de\s*voiture|půjčovna/i, "Travel", "Car Rental"],
  [/mobile\s*(subscription|content|offers?)|wap\b|мобильн\w*\s*подписк/i, "Mobile", "Mobile Subscriptions"],
  [/mobile\s*games?|игры\s*для\s*моб/i, "Mobile", "Mobile Games"],
  [/home[\s_-]*(improvement|decor|furnish)|строительство|ремонт|stavebnictv|building|bau\b/i, "Home & Real Estate", "Home Improvement"],
  [/real[\s_-]*estate|недвижим|nemovitost|immobil/i, "Home & Real Estate", "Real Estate"],
  [/home[\s_-]*service|услуги для дома/i, "Home & Real Estate", "Home Services"],

  // ---------- iGaming ----------
  [/casino|казино|kasino/i, "iGaming", "Casino"],
  [/sports?\s*bet|betting|беттинг|букмекер|ставк|sázk|paris sportif|wett/i, "iGaming", "Sports Betting"],
  [/poker|покер/i, "iGaming", "Poker"],
  [/lotto|lottery|лотере/i, "iGaming", "Lottery"],
  [/esports?|киберспорт/i, "iGaming", "Esports"],
  [/igaming|gambling|гемблинг|азарт|hazard|jeux\s*d.argent|money\s*games/i, "iGaming", null],

  // ---------- Adult (before Dating's general rule, after adult dating) ----------
  [/webcam|cams?\b|вебкам/i, "Adult", "Webcams"],
  [/adult|18\+|porn|для\s*взрослых|erotik|erotic|lingerie|нижнее\s*белье|gentlemen/i, "Adult", null],

  // ---------- Dating ----------
  [/matchmak|сватовств/i, "Dating", "Matchmaking"],
  [/dating|знаком|seznam|rencontre|partnersuche|citas/i, "Dating", null],

  // ---------- Crypto (before Finance: "crypto trading" is Crypto) ----------
  [/exchange|биржа|burza/i, "Crypto", "Exchanges"],
  [/wallet|кошел/i, "Crypto", "Wallets"],
  [/mining|майнинг/i, "Crypto", "Mining"],
  [/nft/i, "Crypto", "NFT"],
  [/crypto|cryto|crytpo|bitcoin|btc\b|blockchain|крипто|биткоин/i, "Crypto", null],

  // ---------- Finance ----------
  [/insur|страхов|pojišt|assurance|mutuelle|versicher/i, "Finance", "Insurance"],
  [/loan|credit|кредит|займ|микрозайм|úvěr|prêt|crédit/i, "Finance", "Loans & Credit"],
  [/forex|broker|trading|invest|инвестиц|акции|börse/i, "Finance", "Investing & Trading"],
  [/bank|банк/i, "Finance", "Banking"],
  [/payment|payout|платеж|платёж|платежн/i, "Finance", "Payments"],
  [/financ|финанс|finanč|financ|finanz|финансовые/i, "Finance", null],

  // ---------- Nutra & Health ----------
  [/supplement|добавк|бад\b|doplňk\s*stravy|потенц/i, "Nutra & Health", "Supplements"],
  [/weight\s*loss|похуден|slim|диет|hubnut/i, "Nutra & Health", "Weight Loss"],
  [/cosmet|skin\s*care|skincare|beaut|beaut|красот|krása|kosmetik|cosmétique|уход\s*за/i, "Nutra & Health", "Beauty & Skincare"],
  [/pharma|аптек|lék|médicament|фарма/i, "Nutra & Health", "Pharmacy"],
  [/fitness|фитнес|gym|спортивное\s*питание/i, "Nutra & Health", "Fitness"],
  [/nutra|нутра|health|здоров|zdrav|sant|gesundheit|salud|medical|медицин|healthcare|фарма|витамин/i, "Nutra & Health", null],

  // ---------- Mobile ----------
  [/\bios\b|iphone|android|smartphone/i, "Mobile", "App Platforms"],
  [/app\s*download|cpi\b|app\s*install/i, "Mobile", "App Installs"],
  [/mobile\s*apps?|приложени|aplikac|\bapps\b/i, "Mobile", "Mobile Apps"],
  [/mobile|мобильн|мобил/i, "Mobile", null],

  // ---------- Gaming ----------
  [/browser\s*game|браузерн/i, "Gaming", "Browser Games"],
  [/online\s*game|онлайн.?игр|клиентские\s*игры|mmo/i, "Gaming", "Online Games"],
  [/game|игр|hry|hraní|jeux|spiele|juegos|gaming/i, "Gaming", null],

  // ---------- Travel ----------
  [/flight|avia|авиабилет|билеты\s*на\s*самолет|letenk|vol\b/i, "Travel", "Flights"],
  [/hotel|accommodation|отел|гостиниц|ubytov|hébergement/i, "Travel", "Hotels"],
  [/ticket|билет|vstupenk/i, "Travel", "Tickets"],
  [/tour|travel|voyage|viagens|férias|путешеств|туризм|cestov|reisen|urlaub|viaje|holiday|vacation|tourisme|loisirs/i, "Travel", null],

  // ---------- Education ----------
  [/course|курс|kurz|formation/i, "Education", "Online Courses"],
  [/language\s*learn|языков/i, "Education", "Language Learning"],
  [/book|книг|knih|livre|bücher/i, "Education", "Books"],
  [/educat|обучен|образован|vzděláv|éducation|school|university|учеб/i, "Education", null],

  // ---------- Software & SaaS ----------
  [/\bai\b|artificial\s*intelligen|нейросет|machine\s*learning/i, "Software & SaaS", "AI Tools"],
  [/vpn|security|antivirus|безопасност|защит/i, "Software & SaaS", "Security & VPN"],
  [/marketing\s*(software|tool)|seo\b|crm\b/i, "Software & SaaS", "Marketing Software"],
  [/design\s*tool|graphic/i, "Software & SaaS", "Design Tools"],
  [/collaborat|productivity|продуктивност/i, "Software & SaaS", "Productivity"],
  [/developer|dev\s*tool|api\b|программирован/i, "Software & SaaS", "Developer Tools"],
  [/\bsaas\b|software|программн|софт|informatique|high.?tech|computers?|hardware|\btech\b|počítač/i, "Software & SaaS", null],

  // ---------- Telecom & Internet ----------
  [/hosting|domain|хостинг|домен/i, "Telecom & Internet", "Hosting & Domains"],
  [/telecom|telekommunikation|t.l.phon|telefon|мобильная связь|связь|интернет.?провайдер|internet\b|интернет.?серви|порталы/i, "Telecom & Internet", null],

  // ---------- Sweepstakes & Surveys ----------
  [/sweepstake|свипстейк|розыгрыш/i, "Sweepstakes & Surveys", "Sweepstakes"],
  [/survey|опрос|dotazník|sondage/i, "Sweepstakes & Surveys", "Surveys"],
  [/sign.?up|lead\s*gen|free\s*trial|free\b|incentive/i, "Sweepstakes & Surveys", "Sign-ups & Trials"],
  [/contest|конкурс/i, "Sweepstakes & Surveys", "Contests"],

  // ---------- Make Money Online ----------
  [/bizz?\s*opp|biz\s*opp|work\s*at\s*home|заработок|make\s*money/i, "Make Money Online", "Business Opportunities"],
  [/affiliate\s*(network|program)|cpa\s*network|ad\s*network|партнерск/i, "Make Money Online", "Affiliate Networks"],

  // ---------- Automotive ----------
  [/car\s*part|автозапчаст|запчаст|accessories\s*and\s*parts|autodíl/i, "Automotive", "Car Parts"],
  [/motorcycle|мотоцикл|moto\b/i, "Automotive", "Motorcycles"],
  [/\bcars?\b|авто|automob|autom|vehicle|voiture|fahrzeug|coche/i, "Automotive", null],

  // ---------- Sports & Outdoors ----------
  [/cycl|велосипед|kolo\b/i, "Sports & Outdoors", "Cycling"],
  [/outdoor|туризм\s*и\s*отдых|camping|kemping/i, "Sports & Outdoors", "Outdoor"],
  [/sport|спорт|hobby|хобби/i, "Sports & Outdoors", null],

  // ---------- Entertainment & Media ----------
  [/stream|netflix|подписк\w*\s*на\s*видео/i, "Entertainment & Media", "Streaming"],
  [/music|музык|hudba|musique/i, "Entertainment & Media", "Music"],
  [/audio|video|видео/i, "Entertainment & Media", "Audio & Video"],
  [/news|новост|média|media\s*and\s*marketing|marketing/i, "Entertainment & Media", "Media & Marketing"],
  [/entertain|развлеч|zábav|divertissement|arts|art\s*et|culture|recreation/i, "Entertainment & Media", null],

  // ---------- E-commerce (broad: runs late so specific goods reach their own category first) ----------
  [/fashion|clothing|одежд|мода|móda|mode\b|moda\b|oblečen|vêtement|kleidung|apparel|charme/i, "E-commerce", "Fashion & Apparel"],
  [/shoes|boots|обув|footwear|chaussure/i, "E-commerce", "Footwear"],
  [/jewel|ювелир|šperk|bijoux|watch|часы/i, "E-commerce", "Jewellery & Watches"],
  [/furnitur|мебел|nábytek|meuble|interior|home\s*decor|kitchen|кухн/i, "E-commerce", "Furniture & Interior"],
  [/garden|garten|jardin|jardín|hogar|wohnen|сад|zahrad|maison|дом и сад|house[\s_-]*and[\s_-]*garden|home\s*\/\s*house|dům|lamps|lighting|освещен/i, "E-commerce", "Home & Garden"],
  [/electronic|электроник|техник|elektro|appliance|бытовая\s*техник|spotřebič/i, "E-commerce", "Electronics & Appliances"],
  [/food|продукты питани|продукт|potravin|alimentaire|beverage|напитк|alimenta|lebensmittel|еда/i, "E-commerce", "Food & Drink"],
  [/pet\b|pets\b|животн|зоотовар|zvířat|animal|animaux|mascota/i, "E-commerce", "Pets"],
  [/kids|children|детск|дети|děti|enfant|famille|baby|игрушк|toys/i, "E-commerce", "Kids & Baby"],
  [/gift|подар|dárk|cadeau|geschenk|alcohol|алкогол/i, "E-commerce", "Gifts"],
  [/accessor|аксессуар|příslušenstv/i, "E-commerce", "Accessories"],
  [/marketplace|мульти.?маркет|department[\s_-]*store|универмаг|warenh|retail|wholesale|оптов|tiendas|coupon|купон|deals?\b|angebot/i, "E-commerce", "Marketplaces & Retail"],
  [/e.?commerce|ecommerce|интернет.?магазин|shopping|shop\b|обувь|товар|goods|store|commerce|prodej/i, "E-commerce", null],

  // ---------- Business & professional services ----------
  [/legal|юридич|právn|avocat|law\b/i, "Business Services", "Legal"],
  [/logistic|доставк|transport|перевозк|доставка/i, "Business Services", "Logistics"],
  [/manufactur|производств|výrob/i, "Business Services", "Manufacturing"],
  [/consult|консалт/i, "Business Services", "Consulting"],
  [/b2b|business|бизнес|profession|scientific|technical services|\bhr\b|accounting|бухгалт|sales\b/i, "Business Services", null],


  // ---------- one row per market: the same directory publishes its categories in every EU language,
  // so these stems are systematic rather than incidental (NL, PL, IT, PT, ES, DA, SV, NO, FI, HU, RO) ----------
  [/gezondheid|zdrowie|uroda|salute|saúde|saude|beleza|hälsa|sundhed|szépség|egészség|frumusețe|sănătate/i, "Nutra & Health", null],
  [/reizen|vakantie|turystyka|wakacje|viaggi|vacanze|viagens|rejser|ferier|resor|utazás|călătorii/i, "Travel", null],
  [/huis|tuin|ogród|dom i|casa e giardino|casa e jardim|hogar y jard|have og|hem och|otthon|casă/i, "E-commerce", "Home & Garden"],
  [/dieren|zwierz|animali|animais|kæledyr|husdjur|állat/i, "E-commerce", "Pets"],
  [/cibo|bevande|comida|jedzenie|mad og|mat och|élelmiszer/i, "E-commerce", "Food & Drink"],
  [/bebes|niños|bebé|dzieci|bambini|crianças|børn|barn och|gyerek/i, "E-commerce", "Kids & Baby"],
  [/deportes|sporty|sportowe|recreación|intrattenimento|relax|feestartikelen/i, "Sports & Outdoors", null],
  [/finansowe|finanziari|financeiro|finanser|pénzügy|financiar/i, "Finance", null],
  [/auto.?s|motoren|fietsen|samochod|automobili|carros|biler|bilar/i, "Automotive", null],
  [/bags|purses|handtas|torebki|borse|bolsos|tassen/i, "E-commerce", "Accessories"],
  [/social\s*media|соцсет|социальн/i, "Entertainment & Media", "Social Media"],
  [/gadget|lifestyle|стиль жизни/i, "E-commerce", null],
  [/platform|платформ|market\s*place/i, "Software & SaaS", null],
  [/development|разработк/i, "Software & SaaS", "Developer Tools"],
  [/administration|администрир/i, "Business Services", null],
  // ---------- Generic services, last before Other ----------
  [/услуг|service|služb|dienst|servicio|vie pratique|voyance|pay[\s_-]*per[\s_-]*call|tools|инструмент/i, "Services", null],
];

/** Title Case that keeps the taxonomy's own casing (iGaming, NFT) — the label is already written how we want it. */
function classify(raw) {
  const s = (raw == null ? "" : String(raw)).trim();
  if (!s || /^(other|others|ostatní|—|-|n\/a|no niche assigned|autre)$/i.test(s)) {
    return { category: "Other", sub: null };
  }
  for (const [re, cat, sub] of RULES) if (re.test(s)) return { category: cat, sub };
  return { category: "Other", sub: null };
}

module.exports = { CATEGORIES, RULES, classify };
