#!/usr/bin/env bash
# Screenshot a site at desktop + mobile widths for a visual design review.
#
#   bash scripts/design-shots.sh <base-url> <out-dir> [path ...]
#   bash scripts/design-shots.sh https://example.com /tmp/shots / /pricing /blog
#
# Needs Playwright with Chromium somewhere on the path:
#   npm i -D @playwright/test && npx playwright install chromium
# Run it from the project that has Playwright installed (it uses that project's
# node_modules; a temporary .design-shots/ dir is created there and removed). Paths default to "/". Output: <out>/desk-<name>.png, mob-<name>.png,
# plus <out>/console.txt with any browser console errors per page.
set -euo pipefail
base="${1:?base url}"; out="${2:?out dir}"; shift 2
paths=("$@"); [ ${#paths[@]} -eq 0 ] && paths=("/")
mkdir -p "$out"
# generated files must live inside the project so Node resolves @playwright/test
work="$PWD/.design-shots"; mkdir -p "$work"; trap 'rm -rf "$work"' EXIT
spec="$work/shots.spec.ts"
{
  echo 'import { test } from "@playwright/test";'
  echo "const B = ${base@Q};"
  echo "const P: string[] = $(printf '%s\n' "${paths[@]}" | python3 -c 'import json,sys; print(json.dumps([l.rstrip("\n") for l in sys.stdin]))');"
  echo 'const name = (p: string) => p === "/" ? "home" : p.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-");'
  echo 'const fs = require("fs");'
  echo 'for (const p of P) for (const [tag, w, h] of [["desk", 1440, 900], ["mob", 390, 844]] as const) {'
  echo '  test(`${tag} ${p}`, async ({ page }) => {'
  echo '    const errs: string[] = [];'
  echo '    page.on("pageerror", e => errs.push("pageerror " + e.message));'
  echo '    page.on("console", m => { if (m.type() === "error") errs.push("console " + m.text().slice(0, 300)); });'
  echo '    await page.setViewportSize({ width: w, height: h });'
  echo '    await page.goto(B + p, { waitUntil: "networkidle", timeout: 45000 });'
  echo '    await page.waitForTimeout(1200);'
  echo "    await page.screenshot({ path: ${out@Q} + \`/\${tag}-\${name(p)}.png\`, fullPage: tag === \"mob\" });"
  echo "    fs.appendFileSync(${out@Q} + \"/console.txt\", \`[\${tag} \${p}] \${errs.length ? errs.join(\" | \") : \"clean\"}\\n\`);"
  echo '  });'
  echo '}'
} > "$spec"
: > "$out/console.txt"
cfg="$work/shots.config.ts"
cat > "$cfg" <<EOF
import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: ${work@Q}, testMatch: "shots.spec.ts", timeout: 60000, retries: 0, workers: 4, reporter: [["line"]] });
EOF
npx playwright test --config="$cfg" 2>&1 | grep -E 'passed|failed' || true
echo "shots in $out:"; ls "$out" | grep -E '^(desk|mob)-' ; echo "console errors:"; cat "$out/console.txt"
