## Crypto research system (added 10.10.2026) — skill `crypto-research`

"Build me a system through which I'll be able to query answers on questions related to crypto —
any reliable source, as much data as possible." Three layers, one front door (`crypto-research`):

- **Live MCPs (user scope, `claude mcp list`)** — key-free: `coingecko`, `coinpaprika`, `dexpaprika`,
  `crypto-com`, `blockscout`, `pyth`, `nansen`, `zerion`, `chainstack`, `avalanche`, `across`, `lifi`;
  OAuth via `/mcp`: `santiment`, `glassnode`, `messari`, `token-terminal`, `coinstats`, `lunarcrush`,
  `dune`, `quicknode`, `defillama` (Pro). Macro/equities side: `yahoo-finance`, `sec-edgar`, `fxmacrodata`,
  api-mcp `fred` / `ecb`.
- **api-mcp connectors (`repositories/mcp/api-mcp/connectors/`)** — `defillama` (TVL, fees, DEX volume),
  `defillama-stablecoins`, `defillama-yields`, `defillama-coins`, `feargreed`, `mempool`, `blockchain-info`,
  `coinmetrics` (community on-chain metrics), `binance` (spot via data-api.binance.vision), `binance-futures`
  (funding, OI, long/short), `deribit` (DVOL, option book, IV), `hyperliquid` (POST bodies), `polymarket`
  (odds), `bybit`, `okx` (positioning stats), `geckoterminal`, `dexscreener`, `santiment` (free metrics keyless), `l2beat`,
  `ultrasound` (ETH supply/burn), `kraken`, `coinbase-exchange`; key-needed (free): `coinmarketcap`, `etherscan`, `glassnode`,
  `cryptocompare` (news), `cryptopanic` (voted news).
  Test: `node repositories/mcp/api-mcp/dist/cli.js call binance-futures.funding_rate symbol=BTCUSDT --limit 3`.
- **Corpus (Postgres `app`: `cr_source`, `cr_post`, `cr_fetch_log`)** — public Telegram channels harvested
  through `t.me/s/<handle>` via anonfetch (`.devtools/crypto/tg_harvest.js`; 20 posts a page, `?before=`
  paging, html + links + views + forwarded_from kept) and RSS feeds (`rss_harvest.js`), in RU / UK / EN /
  ZH / KO / JA / TR / ES / PT / VI / ID / DE / FR / AR / PL / IT. Registry is data:
  `.devtools/crypto/sources/*.json` → `node .devtools/crypto/sources_load.js <file>`. Tier 1 = official
  media/exchange/regulator, 2 = reputable, 3 = listed by a directory only (unverified — flag it when citing).
  Query: `node .devtools/crypto/query.js "<terms>" [--since 7d] [--lang ru,en] [--source forklog] [--like]
  [--stats]` (FTS `simple`, recency-weighted; search in his language AND English).
  Refresh: `bash .devtools/crypto/refresh.sh` (waits for a healthy pool, per-kind locks, logs in
  `.devtools/crypto/logs/`); backfill: `… --tg-only --backfill --pages 30`.
  Loop: `bash .devtools/crypto/ctl.sh status|ensure|stop|restart` (every 30 min incremental + a backfill slice); a
  SessionStart hook runs `ensure` since a container restart kills the detached supervisor.
- Rules: every number cites source + timestamp; opinions are attributed per channel; nothing answered
  from memory; the shared proxy pool is one Nord account — subagents must **never** verify channels
  through anonfetch in parallel with a harvest (10.10.2026: one did, and the session cap tripped for 10 min).
