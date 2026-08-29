// Crypto exchanges / wallets / brokers read from their OWN affiliate pages (the authoritative
// source). A seed list of domains; for each the conventional paths are tried and the first page
// that reads like an affiliate page is parsed with rate_terms (commission wording next to the
// number, discount wording excluded). A domain without such a page is recorded as gone.
const { text } = require("./_common");
const { parseTerms } = require("../rate_terms");
const DOMAINS = ["binance.com", "bybit.com", "okx.com", "kucoin.com", "mexc.com", "bitget.com", "htx.com", "gate.io", "kraken.com", "coinbase.com", "crypto.com", "bitpanda.com", "ledger.com", "trezor.io", "paybis.com", "changelly.com", "changenow.io", "moonpay.com", "nexo.com", "youhodler.com", "cex.io", "bingx.com", "whitebit.com", "lbank.com", "bitmart.com", "phemex.com", "bitstamp.com", "gemini.com", "etoro.com", "simpleswap.io", "uphold.com", "bitfinex.com", "poloniex.com", "bitrue.com", "coinex.com", "weex.com", "bitunix.com", "pionex.com", "margex.com", "primexbt.com", "blofin.com", "deepcoin.com", "toobit.com", "coinsmart.com", "wirexapp.com", "bitmex.com", "btse.com", "bitbuy.ca", "coingate.com", "coinmama.com", "coinpanda.io", "bitsgap.com", "3commas.io", "cryptohopper.com", "koinly.io", "cointracker.io", "nordvpn.com", "swissborg.com", "bitvavo.com", "kucoin.io", "stormgain.com", "coinjar.com", "luno.com", "paxful.com", "noones.com", "bisq.network", "exodus.com", "atomicwallet.io", "tangem.com", "ellipal.com", "safepal.io", "ledn.io", "wallet.uphold.com", "bitcoin.com", "bitcoinira.com", "cakedefi.com", "bake.io", "kucoinpartner.com", "deribit.com", "coinledger.io", "cointracking.info", "zenledger.io", "tokentax.co", "coinrule.com", "capital.com", "avatrade.com", "libertex.com", "xt.com", "okcoin.com", "currency.com", "cryptology.com", "stake.com", "bc.game", "roobet.com", "cloudbet.com", "sportsbet.io", "betfury.io", "nanogames.io", "bitcasino.io", "fortunejack.com", "bets.io", "trustdice.win", "1xbit.com", "coinpoker.com", "bitsler.com", "duelbits.com", "wolf.bet", "bitpay.com", "coinsbit.io", "probit.com", "hotcoin.com", "biconomy.com", "tapbit.com", "bitdelta.com", "coinw.com", "digifinex.com", "bigone.com", "ascendex.com", "kucoin.com", "cryptomus.com", "nowpayments.io", "coinpayments.net", "plisio.net", "alfacash.com", "switchere.com", "guardarian.com", "mercuryo.io", "transak.com", "banxa.com", "ramp.network", "swapzone.io", "letsexchange.io", "godex.io", "fixedfloat.com", "stealthex.io", "exolix.com", "quickex.io", "changehero.io"];
const PATHS = ["/affiliate-program", "/affiliates", "/affiliate", "/partners", "/referral", "/en/affiliates", "/en/affiliate-program", "/affiliate-program/", "/partner"];
const LOOKS = /(commission|revenue share|revshare|rebate|referral fee|affiliate program|per (?:referral|trader|user)|payout)/i;
module.exports = {
  name: "crypto_brands", lang: "en", region: "global", base: "https://",
  async list() { return DOMAINS.map((d) => ({ url: `https://${d}`, slug: d.replace(/[^a-z0-9]+/g, "-") })); },
  urlFor(slug) { return `https://${slug.replace(/-(com|io|ca|network)$/, ".$1")}`; },
  async fetch(af, item) {
    const host = item.url.replace(/^https?:\/\//, "");
    for (const p of PATHS) {
      for (const h of [host, "www." + host]) {
        let r; try { r = await af.get(`https://${h}${p}`, { tries: 1, gapBase: 1200, maxChars: 900000 }); } catch (e) { continue; }
        const html = r.html || r.text || "";
        const plain = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
        if (r.status === 200 && plain.length > 400 && LOOKS.test(plain)) return `<!--src:https://${h}${p}-->` + html;
        await af.pace(400);
      }
    }
    return "";
  },
  parse(html, url) {
    const h = String(html);
    if (!h) { const e = new Error("no affiliate page"); e.gone = true; throw e; }
    const src = (h.match(/^<!--src:([^>]+)-->/) || [])[1] || url;
    const plain = h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    // only sentences about the programme itself count; fee tables ("withdrawal commission 0.1%") and
    // product settings ("set the commission up to 5%") are not affiliate rates
    const sentences = plain.split(/(?<=[.!?])\s+|\s{2,}/).filter((t) => /(affiliate|referral|partner|rev(?:enue)? ?share|sub-?affiliate|per (?:referred|new) (?:user|trader|customer))/i.test(t) && !/(withdrawal|deposit|maker|taker|trading fee|network fee|processing fee|set the commission|choose.{0,20}commission)/i.test(t));
    const terms = parseTerms(sentences.join(" "));
    const domain = new URL(src).hostname.replace(/^www\./, "");
    const title = text((h.match(/<title>([^<]*)/) || [])[1] || "");
    let brand = title.split(/[|–—:-]/)[0].trim();
    if (!brand || brand.length > 40 || /earn|commission|program/i.test(brand)) brand = domain.replace(/\.[a-z.]+$/, "").replace(/^(app|www)\./, "");
    brand = brand.charAt(0).toUpperCase() + brand.slice(1);
    const teaser = sentences.find((t) => /(commission|revenue share|rebate|earn)/i.test(t) && /\d/.test(t)) || sentences[0];
    if (!Object.keys(terms).length && !teaser) { const e = new Error("affiliate page without published terms"); e.gone = true; throw e; }
    return {
      program_name: brand.replace(/\s*(affiliate program|affiliates?|partners?)\s*$/i, "") || domain, domain, landing_url: `https://${domain}`, signup_url: src,
      description: teaser ? text(teaser) : null, ...terms,
      tags: ["crypto"], extra: { brand_affiliate_url: src, brand_terms: terms, brand_probe: "hit" },
    };
  },
};
