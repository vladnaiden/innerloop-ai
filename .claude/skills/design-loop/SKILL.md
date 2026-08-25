---
name: design-loop
description: Incremental visual-design improvement loop for any website — screenshot the live site at desktop + mobile, critique the screenshots with a fixed checklist, fix, redeploy, re-screenshot until clean. Use whenever the user asks to improve/polish/check a site's design, says something "looks off", asks for custom (non-default) controls, or wants mobile checked. Triggers on: design loop, improve design, check design, polish UI, looks misaligned, mobile layout, custom components, headless browser check.
---

# design-loop — see it, fix it, see it again

The mechanism: **never judge a design from code — look at pixels.** Every
iteration is `screenshot → critique → fix → deploy → screenshot`. Stop when a
full pass produces no findings on both viewports.

## 0. Prerequisites (once per project)

```bash
npm i -D @playwright/test && npx playwright install chromium
```

Local dev servers often lack production data (DB, env) — when so, review
**production or a preview deploy**, not localhost.

## 1. Shoot

```bash
bash /workspaces/innerloop-ai/scripts/design-shots.sh <base-url> <out-dir> / /page2 /page3
```

Run from the project dir (it uses that project's Playwright). Produces
`desk-*.png` (1440×900) and full-page `mob-*.png` (390 wide) plus
`console.txt`. **Read every PNG with the Read tool** — actually look.

Shoot at least: home, the main interactive screen, one detail page, one form,
one localized page if the site is multilingual.

## 2. Critique — walk this checklist per screenshot, write findings down

**Alignment & structure**
- Table headers sit exactly over their columns (a classic cause: header cells
  styled with different padding/margins than body cells — give them the same box).
- Lists/grids: equal gutters, no orphan card with a different height, no
  raw `snake_case` / `N/A` / `undefined` text.
- Sections with a heading but no content → hide the section.

**Controls — nothing may look browser-default**
- `<select>`: `appearance:none` + custom chevron.
- `<input type=number>`: hide native spinners; custom −/+ steppers.
- Scrollbars: `scrollbar-width:thin` + `::-webkit-scrollbar` styled with the palette.
- Focus: visible ring in the accent colour, not the UA blue outline.
- Sortable headers: show a glyph on *every* sortable column, stronger on the active one.
- Checkbox/radio/range if present: custom.

**Mobile (390px)**
- No horizontal page scroll. Wide tables become **cards** (grid rows with
  `data-label::before` captions) or scroll inside their own container.
- Filter bars longer than ~2 rows collapse behind a "Filters (n)" toggle.
- Tap targets ≥ 40px; text ≥ 14px; nav wraps or scrolls, never overflows.

**Feel** (map to the brief — e.g. trust/money/calm)
- One accent, one highlight colour for numbers that matter, muted everything else.
- Consistent radius family (pills for controls, 10–16px for cards).
- Enough air: row padding ≥ .6rem, section gaps ≥ 2rem.
- Dark mode tokens defined for every custom colour.

**Hygiene**
- `console.txt` clean. Localized pages: `html lang/dir` right, headers translated,
  no untranslated strings that were added later.

## 3. Fix, deploy, reshoot

Fix in CSS tokens/components (not per-page hacks). Build, run the project's
e2e suite if it has one (`npm run test:e2e`), deploy, then **re-run step 1 and
re-read the images**. Repeat until a pass yields nothing. Show the user what
changed with before/after facts ("headers were 12px off; now aligned").

## 4. Leave it better

If the project has no e2e suite, add a minimal Playwright one that loads each
key page, asserts the main interaction works, and fails on console errors —
future design passes then can't silently break behaviour.
