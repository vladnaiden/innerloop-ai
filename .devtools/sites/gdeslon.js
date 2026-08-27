// gdeslon.ru/offers — Russian CPA network "Где Слон?": public offer cards with six-month
// conversion, EPC, AOV, commission span and coupon/creative counts.
const { text, between, decode, host } = require("./_common");
module.exports = {
  name: "gdeslon", lang: "ru", region: "CIS", base: "https://www.gdeslon.ru",
  async list(af) {
    const out = new Map();
    for (let p = 1; p <= 60; p++) {
      let r; try { r = await af.get(`${this.base}/offers/${p > 1 ? `?page=${p}` : ""}`, { tries: 2 }); } catch { break; }
      const links = [...(r.html || "").matchAll(/href="\/offers\/([a-z0-9_-]+-(\d+))\/?"/g)];
      if (!links.length) break;
      for (const m of links) out.set(m[2], { url: `${this.base}/offers/${m[1]}/`, slug: m[2] });
      if (!(r.html || "").includes(`?page=${p + 1}"`)) break;
      await af.pace(2000);
    }
    return [...out.values()];
  },
  parse(html, url) {
    const h = String(html);
    const side = between(h, 'class="best-rekls', "</dl> </div>");
    const name = text((side.match(/class="title">\s*<a[^>]*>([\s\S]*?)<\/a>/) || [])[1] || (h.match(/<title>Партнерская программа ([^<]*?) - /) || [])[1] || "");
    const landing = (side.match(/class="title">\s*<a href="([^"]+)"/) || [])[1] || null;
    const dl = Object.fromEntries([...side.matchAll(/<dt>([^<]*?)\s*(?:<span[\s\S]*?<\/span>)?\s*<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)].map((m) => [text(m[1]), text(m[2])]));
    const logo = (side.match(/<img src="([^"]+)"/) || [])[1];
    const short = text(between(side, 'class="descr">', "</div>").replace(/^[^>]*>/, ""));
    const desc = text((h.match(/<h1>\s*Описание\s*<\/h1>([\s\S]*?)<\/article>/) || [])[1] || "");
    const comm = dl["Комиссия"] || "";
    const pr = comm.match(/([\d.,]+)\s*-\s*([\d.,]+)\s*%/) || comm.match(/([\d.,]+)\s*%/);
    const coupons = (h.match(/Купоны \((\d+)\)/) || [])[1], creatives = (h.match(/Рекламные материалы \((\d+)\)/) || [])[1];
    const rub = comm.match(/([\d.,]+)\s*(?:-\s*([\d.,]+)\s*)?₽/);
    return {
      program_name: name || null, domain: landing ? host(landing) : `gdeslon.${url.replace(/\/$/, "").split("/").pop()}`, landing_url: landing, signup_url: url,
      logo_url: logo ? this.base + logo : null, description: [short, desc].filter(Boolean).join(" — ").slice(0, 3000) || null,
      network: "Где Слон?", commission: comm || null, commission_type: /%/.test(comm) ? "CPS" : /₽/.test(comm) ? "CPA" : null,
      pct_min: pr ? parseFloat(pr[1].replace(",", ".")) : null, pct_max: pr ? parseFloat((pr[2] || pr[1]).replace(",", ".")) : null,
      flat_min: rub ? parseFloat(rub[1].replace(",", ".")) : null, flat_max: rub ? parseFloat((rub[2] || rub[1]).replace(",", ".")) : null, currency: rub ? "RUB" : null,
      numbers: { conversion: dl["Конверсия"] || null, epc: dl["EPC"] || null, aov: dl["AOV"] || null },
      extra: { stats: dl, relation: dl["Взаимодействие"], coupons: coupons ? +coupons : undefined, creatives: creatives ? +creatives : undefined, kind: "offer" },
    };
  },
};
