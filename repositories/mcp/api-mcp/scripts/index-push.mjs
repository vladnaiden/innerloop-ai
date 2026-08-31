#!/usr/bin/env node
/**
 * index-push — submit URLs to every indexing channel that is actually configured.
 *
 * Search engines find pages two ways: they re-read a sitemap on their own schedule, or they are
 * told. This is the "told" path, in one place, because each engine wants a different thing:
 *
 *   IndexNow          one POST, reaches Bing, Yandex, Seznam and Naver at once. No per-site
 *                     account. This is the workhorse.
 *   Bing Webmaster    direct submission attributed to the account. Small daily quota (100 on a
 *                     new property), so it is spent on a handful of high-value URLs, not a batch.
 *   Yandex recrawl    one URL per call against a small daily quota. Worth it for RU/BY/KZ/TR,
 *                     which Search Console cannot see at all.
 *   Google            has no URL-submission channel for ordinary pages — the Indexing API accepts
 *                     only JobPosting and BroadcastEvent, and the sitemap ping was retired in
 *                     2023. The honest action for Google is to re-submit the sitemap, which this
 *                     does via the Search Console API.
 *
 * A channel that is not configured is REPORTED AND SKIPPED, never silently dropped and never
 * fatal: the point is to use everything available today and to say plainly what is missing.
 *
 *   node scripts/index-push.mjs --url https://site/a --url https://site/b
 *   node scripts/index-push.mjs --file urls.txt --only indexnow,bing
 *   node scripts/index-push.mjs --sitemap https://site/sitemaps/<key>/programs-1.xml --limit 50
 *   node scripts/index-push.mjs --sitemap-submit https://site/sitemaps/<key>.xml --site sc-domain:site
 *   ... --dry     plan only, submit nothing
 */

import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const run = promisify(execFile);
const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'cli.js');

/** Every channel's daily allowance, so a run never burns a quota it cannot see. */
const BING_BATCH = 100;
const YANDEX_BATCH = 20;

const args = process.argv.slice(2);
const opt = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const many = (name) => args.reduce((a, v, i) => (v === `--${name}` && args[i + 1] ? [...a, args[i + 1]] : a), []);
const flag = (name) => args.includes(`--${name}`);

const DRY = flag('dry');
const ONLY = (opt('only') ?? '').split(',').filter(Boolean);
const wants = (c) => ONLY.length === 0 || ONLY.includes(c);

/** Call a connector through the CLI. Returns {ok, data|error} — never throws, so one dead channel
 *  cannot take the run down with it. */
async function call(api, endpoint, params = {}) {
  // A `list: true` connector param is split on COMMAS by the engine, not parsed as JSON — passing
  // `["a","b"]` yields ['["a"', '"b"]'] and the API rejects it as malformed. Measured 31.08.2026
  // against Bing's SubmitUrlBatch, which echoed the bracket-and-quote string back as "Invalid Urls".
  const argv = [CLI, 'call', `${api}.${endpoint}`, ...Object.entries(params).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : v}`), '--json'];
  try {
    const { stdout } = await run('node', argv, { maxBuffer: 32 * 1024 * 1024 });
    const json = JSON.parse(stdout);
    if (json.status && json.status >= 400) return { ok: false, error: `HTTP ${json.status}` };
    return { ok: true, data: json };
  } catch (e) {
    // the CLI prints the API's own message on failure; keep the first line, drop the stack
    const msg = String(e.stderr || e.stdout || e.message).trim().split('\n')[0];
    return { ok: false, error: msg.slice(0, 200) };
  }
}

async function collectUrls() {
  const out = [...many('url')];
  const file = opt('file');
  if (file) out.push(...readFileSync(file, 'utf8').split('\n').map(s => s.trim()).filter(Boolean));
  const sitemap = opt('sitemap');
  if (sitemap) {
    const xml = await (await fetch(sitemap)).text();
    out.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]));
  }
  const limit = Number(opt('limit', '0'));
  const uniq = [...new Set(out.filter(u => /^https?:\/\//.test(u)))];
  return limit > 0 ? uniq.slice(0, limit) : uniq;
}

const results = [];
const record = (channel, state, detail) => results.push({ channel, state, detail });

const urls = await collectUrls();
const host = urls.length ? new URL(urls[0]).origin : null;

// ── Google: no URL submission exists for ordinary pages; the sitemap is the channel ─────────
const smUrl = opt('sitemap-submit');
if (wants('google')) {
  if (!smUrl) {
    record('google (sitemap)', 'skipped', 'pass --sitemap-submit <sitemap url> --site <sc-domain:host> to re-submit');
  } else {
    const site = opt('site');
    if (!site) record('google (sitemap)', 'skipped', '--sitemap-submit needs --site, e.g. sc-domain:example.com');
    else if (DRY) record('google (sitemap)', 'dry', `would re-submit ${smUrl}`);
    else {
      // Search Console puts both values IN THE PATH, so the caller encodes them: an unencoded
      // `sc-domain:host` or `https://…` splits the path and the API answers 404, not a validation error.
      const r = await call('search-console', 'submit_sitemap',
        { site: encodeURIComponent(site), sitemap: encodeURIComponent(smUrl) });
      record('google (sitemap)', r.ok ? 'ok' : 'failed', r.ok ? `re-submitted ${smUrl}` : r.error);
    }
  }
}

if (urls.length === 0) {
  if (!smUrl) console.error('nothing to submit: pass --url, --file or --sitemap');
} else {
  // ── IndexNow: Bing + Yandex + Seznam + Naver in one call, no per-site account ──────────────
  if (wants('indexnow')) {
    if (DRY) record('indexnow', 'dry', `would submit ${urls.length} url(s)`);
    else {
      let ok = 0; const fails = [];
      for (const u of urls) {
        const r = await call('indexnow', 'submit', { url: u });
        r.ok ? ok++ : fails.push(r.error);
      }
      record('indexnow', fails.length === 0 ? 'ok' : ok ? 'partial' : 'failed',
        `${ok}/${urls.length} accepted${fails.length ? ` · first error: ${fails[0]}` : ''}`);
    }
  }

  // ── Bing direct: quota-checked, and deliberately capped ────────────────────────────────────
  if (wants('bing')) {
    const siteUrl = opt('bing-site', host);
    const sites = await call('bing-webmaster', 'sites');
    const verified = sites.ok ? (sites.data.records ?? []).map(r => r.url) : [];
    const match = verified.find(v => siteUrl && v.replace(/\/$/, '') === siteUrl.replace(/\/$/, ''));
    if (!sites.ok) record('bing', 'skipped', `cannot list sites: ${sites.error}`);
    else if (!match) record('bing', 'skipped', `${siteUrl} is not verified in Bing Webmaster (verified: ${verified.join(', ') || 'none'})`);
    else {
      const q = await call('bing-webmaster', 'url_quota', { siteUrl: match });
      const left = q.ok ? (q.data.records?.[0]?.daily_quota ?? 0) : 0;
      const batch = urls.slice(0, Math.min(BING_BATCH, left));
      if (batch.length === 0) record('bing', 'skipped', `daily quota exhausted (${left} left)`);
      else if (DRY) record('bing', 'dry', `would submit ${batch.length} of ${urls.length} (quota ${left})`);
      else {
        const r = await call('bing-webmaster', 'submit_urls', { siteUrl: match, urls: batch });
        record('bing', r.ok ? 'ok' : 'failed', r.ok ? `${batch.length} submitted, quota was ${left}` : r.error);
      }
    }
  }

  // ── Yandex recrawl: one URL per call, small quota, the only read on RU/BY/KZ/TR ────────────
  if (wants('yandex')) {
    const who = await call('yandex-webmaster', 'whoami');
    if (!who.ok) record('yandex', 'skipped', `not configured: ${who.error}`);
    else {
      const userId = who.data.records?.[0]?.user_id;
      const hosts = await call('yandex-webmaster', 'hosts', { user_id: userId });
      const hostId = (hosts.data?.records ?? []).find(h => h.url && host && h.url.replace(/\/$/, '') === host)?.host_id;
      if (!hostId) record('yandex', 'skipped', `${host} is not a verified host on this Yandex account`);
      else {
        const q = await call('yandex-webmaster', 'recrawl_quota', { user_id: userId, host_id: hostId });
        const left = q.ok ? (q.data.records?.[0]?.quota_remainder ?? 0) : 0;
        const batch = urls.slice(0, Math.min(YANDEX_BATCH, left));
        if (batch.length === 0) record('yandex', 'skipped', `recrawl quota exhausted (${left} left)`);
        else if (DRY) record('yandex', 'dry', `would recrawl ${batch.length} of ${urls.length} (quota ${left})`);
        else {
          let ok = 0; const fails = [];
          for (const u of batch) {
            const r = await call('yandex-webmaster', 'recrawl', { user_id: userId, host_id: hostId, url: u });
            r.ok ? ok++ : fails.push(r.error);
          }
          record('yandex', fails.length ? (ok ? 'partial' : 'failed') : 'ok',
            `${ok}/${batch.length} queued${fails.length ? ` · first error: ${fails[0]}` : ''}`);
        }
      }
    }
  }
}

const MARK = { ok: '✓', partial: '~', dry: '·', skipped: '–', failed: '✗' };
console.log(`\n${urls.length} url(s)${DRY ? ' — DRY RUN, nothing submitted' : ''}\n`);
for (const r of results) console.log(`  ${MARK[r.state] ?? '?'} ${r.channel.padEnd(18)} ${r.state.padEnd(8)} ${r.detail}`);
console.log();
process.exit(results.some(r => r.state === 'failed') ? 1 : 0);
