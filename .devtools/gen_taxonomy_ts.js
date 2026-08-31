/** Emit lib/taxonomy.ts for the site from the single taxonomy definition. */
const { CATEGORIES, RULES } = require("./taxonomy.js");
const subOf = {};
for (const [, cat, sub] of RULES) if (sub && !(sub in subOf)) subOf[sub] = cat;
process.stdout.write(`/**
 * GENERATED from .devtools/taxonomy.js — do not hand-edit.
 * Regenerate:  node .devtools/gen_taxonomy_ts.js > .devtools/affiliate-site/lib/taxonomy.ts
 */
export const CATEGORIES = ${JSON.stringify(CATEGORIES, null, 2)} as const;

export const SUB_OF: Record<string, string> = ${JSON.stringify(subOf, null, 2)};
`);
