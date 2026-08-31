#!/usr/bin/env node
/**
 * ai-crawlers — how much are answer engines actually reading the site?
 *
 * No AI answer engine publishes a webmaster console or a citation API, so the only direct
 * measurement of "is ChatGPT/Perplexity/Claude reading us" is crawler request volume at the CDN.
 * This rolls Cloudflare's per-user-agent counts into three buckets and prints them.
 *
 *   node scripts/ai-crawlers.mjs                       # last 24 h, default zone
 *   node scripts/ai-crawlers.mjs --zone <id> --hours 12
 *   node scripts/ai-crawlers.mjs --json                # machine-readable, for storing daily
 *
 * The free plan refuses a window wider than **1 day**, so `--hours` is clamped to 24. There is no
 * retrospective history either: whatever is not pulled within the retention window is gone, which
 * is why the `--json` output exists — run it daily and keep the rows.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const run = promisify(execFile);
const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'cli.js');

const args = process.argv.slice(2);
const opt = (n, d = null) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const ZONE = opt('zone', '81cdc7057b82f603c0396b62fb767cb3');
const HOURS = Math.min(24, Math.max(1, Number(opt('hours', '24'))));
const JSON_OUT = args.includes('--json');

/**
 * Substring matches against the raw UA header. A crawler that changes its string drops out of the
 * count rather than erroring, so treat a sudden zero as "check the string", not "they stopped".
 */
const BUCKETS = {
  'AI crawlers': ['gptbot', 'oai-searchbot', 'chatgpt-user', 'claudebot', 'claude-web', 'anthropic', 'perplexity', 'ccbot', 'google-extended', 'applebot-extended', 'bytespider', 'amazonbot', 'meta-externalagent', 'cohere', 'youbot', 'diffbot', 'timpibot', 'omgili'],
  'Search engines': ['googlebot', 'bingbot', 'yandexbot', 'duckduckbot', 'petalbot', 'seznambot', 'applebot', 'slurp'],
  'SEO / backlink tools': ['ahrefs', 'semrush', 'mj12bot', 'dotbot', 'blexbot', 'dataforseo', 'serpstat', 'rogerbot', 'seokicks'],
};

const iso = (d) => d.toISOString().replace(/\.\d+Z$/, 'Z');
const to = new Date();
const from = new Date(to.getTime() - HOURS * 3600e3);

const { stdout } = await run('node', [
  CLI, 'call', 'cloudflare-analytics.user_agents',
  `zone=${ZONE}`, `from=${iso(from)}`, `to=${iso(to)}`, 'limit=500', '--json',
], { maxBuffer: 32 * 1024 * 1024 });

const res = JSON.parse(stdout);
// GraphQL answers 200 even when it refuses; the connector projects the reason into meta.errors
if (res.meta?.errors) {
  console.error('Cloudflare refused the query:', JSON.stringify(res.meta.errors).slice(0, 300));
  process.exit(1);
}
const rows = res.records ?? [];
if (!rows.length) { console.error('no rows returned — check the zone id and the token permission'); process.exit(1); }

const total = rows.reduce((a, r) => a + r.requests, 0);
const out = { window: { from: iso(from), to: iso(to), hours: HOURS }, total_requests: total, buckets: {} };

for (const [label, keys] of Object.entries(BUCKETS)) {
  const hits = {};
  for (const r of rows) {
    const ua = (r.user_agent || '').toLowerCase();
    for (const k of keys) if (ua.includes(k)) hits[k] = (hits[k] ?? 0) + r.requests;
  }
  out.buckets[label] = Object.fromEntries(Object.entries(hits).sort((a, b) => b[1] - a[1]));
}

if (JSON_OUT) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }

console.log(`\nLast ${HOURS}h · ${total.toLocaleString('en-US')} requests · ${rows.length} distinct user agents\n`);
for (const [label, hits] of Object.entries(out.buckets)) {
  const entries = Object.entries(hits);
  const sum = entries.reduce((a, [, v]) => a + v, 0);
  console.log(`${label}${entries.length ? ` — ${sum.toLocaleString('en-US')} requests` : ''}`);
  console.log(entries.length ? '  ' + entries.map(([k, v]) => `${k} ${v}`).join(' · ') : '  none seen in this window');
  console.log();
}
