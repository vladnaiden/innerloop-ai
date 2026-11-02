---
name: progressive-disclosure
description: User-invoked. Shrink an always-loaded instruction file (CLAUDE.md, ~/.claude/CLAUDE.md, the site's CLAUDE.md) into a short router plus topic docs read on demand — preview first, apply only on his word, proven lossless by scripts/preservation-check.py. For "project/files are bloated", "CLAUDE.md is too big", "decompose / organize / structure everything".
disable-model-invocation: true
---

# Progressive disclosure for instruction files

Method credited to Caph-dev/agents-progressive-disclosure (no licence published, so nothing is copied from
it; this file is our own). The owner's constraint (02.11.2026): *"I dont want to make changes now and
remove/update anything that might impact the work in a worse way"* — so the default is a preview, and an
apply must prove it lost nothing.

## Why

Everything in an always-loaded file is paid for in every session, relevant or not. On 02.11.2026 the root
CLAUDE.md was 86 KB (~22k tokens); 60% of it was setup notes, the crawler source table and its rejected-site
list — needed only when that topic comes up.

## Never in scope

- Session transcripts (`~/.claude/projects/**/*.jsonl`) — **"DONT TOUCH SESSIONS!"** (02.11.2026).
- `input/` (read-only), database rows (`BR-DATA-10`), `wiki/LESSONS.md` (changes only through `/reflect`),
  `wiki/about-me.md` and other vault pages (a separate decision).
- Deleting a rule. Rules move; they are never dropped or reworded during a split.

## Step 1 — preview (default; writes only under `output/`)

1. Measure: `wc -c` of the target and its sections (`awk '/^## /'`).
2. Classify every section:
   - **stays in the entry file**: owner rules (`OWNER RULE`, `PINNED`, `BR-*` with verbatim quotes), "Rules for
     Claude", engine-vs-brain, the session loop, the skills table (it is itself a router), anything that must
     apply to every task;
   - **moves**: catalogues, per-server setup notes, long tables, rejected-source lists, command references,
     history ("added on …" narratives). Each goes to the most cohesive existing home first (a skill's own
     folder, `.devtools/sites/README.md`, a repo README), else `docs/<topic>.md`.
   - Path-specific instructions may go to `.claude/rules/<topic>.md` with a `paths:` frontmatter so they load
     only when matching files are touched (the site repo already does this).
3. Move text **verbatim**: a section moves as-is; the entry file gets one pointer line instead —
   `- <topic>: read \`<path>\` when <trigger>.` Do not use `@path` imports for moved docs: imports load at
   start, which defeats the split.
4. Write the whole proposal to `output/<DD.MM.YYYY>/declutter/`: `CLAUDE.md` (proposed entry file),
   the routed docs at their future relative paths, and `REPORT.md` (section → destination table, before/after
   bytes, the checker output).
5. Run the checker on the proposal:
   ```bash
   python3 scripts/preservation-check.py --before CLAUDE.md \
     --after output/<date>/declutter/CLAUDE.md --routed $(find output/<date>/declutter -name '*.md' ! -name CLAUDE.md ! -name REPORT.md)
   ```
   It must print PASS: no line missing, no pinned line moved out of the entry file, entry file smaller.
6. Stop. Tell him the numbers and the link to `REPORT.md`. Nothing live has changed.

## Step 2 — apply (only after he says so in this session)

1. `checkpoint-refactor`: note `git status` (CLAUDE.md is a shared file — other sessions edit it; never
   sweep their uncommitted changes into this commit, stage by path or by an index blob).
2. Re-run step 1 against the **current** file (it may have changed since the preview), then copy the routed
   docs into place and replace the entry file.
3. Run the checker against `git show HEAD:CLAUDE.md` as `--before`: PASS or revert.
4. Commit with a Conventional Commit (`docs(claude-md): route <topics> to docs`), then `bash scripts/release.sh`
   shows the next version. Undo is `git revert <sha>`.
5. Next session: confirm the pointers are followed — the first task in a moved topic should read the routed
   doc. If it does not, the pointer's trigger wording is wrong; fix the trigger, not by moving text back.

## Other always-loaded files

- `~/.claude/CLAUDE.md` (global, 6.5 KB) — same steps; routed docs go in `~/.claude/docs/`.
- `.devtools/affiliate-site/CLAUDE.md` — the site repo's own; it already routes to `.claude/rules/` and
  `docs/requirements/`. Shared tree: `git add <paths>`, never `-A`.
- Skill descriptions are also always loaded: a rarely used skill can become `disable-model-invocation: true`
  (slash-command only) — propose it in the report, never flip it during a split.
