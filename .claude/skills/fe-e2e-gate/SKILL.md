---
name: fe-e2e-gate
description: Build and run the front-end end-to-end test gate for a website (Playwright against production or a preview) — functional flows, geometry/alignment, accessibility (axe), and data-display rules — with HTML/JSON reports saved, and grow it whenever a bug is fixed. Use when asked to retest the app, run automatic tests, add e2e tests, make sure tests cover everything, or before/after a deploy. Triggers on: retest, run automatic tests, e2e, end-to-end, test gate, add tests, are the tests passing, check everything works after deploy.
---

# fe-e2e-gate — the front-end test gate

Reference implementation: `/workspaces/innerloop-ai/.devtools/affiliate-site/tests/`
(`critical.spec.ts`, `layout.spec.ts`, `a11y.spec.ts`, `data.spec.ts`,
`playwright.config.ts`). Copy the shape, not the selectors.

## Run

```bash
npm run test:e2e                                  # against production (default BASE_URL)
BASE_URL=https://<preview-url> npm run test:e2e   # against a preview build
npx playwright test tests/data.spec.ts -g "N/A"   # one suite / one test
```

Reports land in `test-reports/html/index.html` (traces for failures) and
`test-reports/results.json`. Quote the pass/fail count and the report path in the
answer. Never claim "tests pass" without a run in this same message.

## The four suites — what each one guards

1. **critical** — real user flows in a browser: load, every filter, search,
   sort, row → detail page, forms with validation, popups, redirects, sitemap,
   localised pages, keyboard. Fails on any console/page error (allow-list only
   known third-party noise by URL, not by message text — Chrome's message has no URL).
2. **layout** — geometry at phone/tablet/desktop: no horizontal overflow, one
   content column shared by nav/content/footer (compare *content-box* edges),
   items on a line within 2px, one control height, header cells over body cells.
3. **a11y** — `@axe-core/playwright`, WCAG 2.1 A/AA, every page × 2 viewports,
   fail on serious/critical.
4. **data** — display rules that encode past bugs: no `N/A`/`null`/`undefined`
   text, complete rows first, expanders list every column, humanised labels keep
   raw values (`data-v`), clear pill semantics, bulk payload cacheable, icon
   proxy always 200, no broken `<img>`, review ordering.

## Growing it (the rule)

Every bug the user reports → one assertion in the matching suite **before** the
fix is deployed, so the fix cannot regress silently. Every new UI control → a
functional test that drives it the way a user does (click/keyboard), not via
`selectOption` on hidden natives.

## Gotchas learned

- Totals drift while imports run → compare with a tolerance, not `toBe`.
- Shared build slots (Vercel) queue behind a stuck build: `vercel inspect` the
  URL; a "Building" older than ~10 min is stuck — `vercel remove` it.
- Probe first, then assert: a throwaway `probe.spec.ts` (ignored by the config
  unless `PROBE=1`) that prints metrics/screenshots is the fastest way to learn
  what the real DOM looks like before writing the test.
