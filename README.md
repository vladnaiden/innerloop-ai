# InnerLoop AI

**Your self-development mentor for Claude Code — a memory that learns you.**

I built this to understand myself: I dumped years of raw personal notes into it,
and Claude turned them into a structured map of who I am — then started giving
me advice that actually fits me, and got better at it every session. InnerLoop
is that loop, packaged.

## What it does

- **You own the memory.** Everything lives in a plain Markdown vault in this
  repo (`wiki/`), openable in Obsidian. No cloud, no vendor database.
- **It learns you.** A reflect loop with outcome signals (`useful` /
  `dead_end` / `corrected`), corroboration thresholds and time-decay turns
  conversations into trusted lessons — the difference between an AI that
  *remembers* and one that *learns*.
- **It mentors.** Sessions start by loading your curated profile
  (`about-me.md`), the lessons learned about working with you (`LESSONS.md`)
  and recent context (`hot.md`) — so advice lands on who you actually are.

## The inner loop

```
capture ──▶ structure ──▶ retrieve ──▶ reflect ──▶ (smarter next session)
 inbox/      /ingest       /wiki-        /reflect
 chats       /save         retrieve      → LESSONS.md
```

## Quick start

1. Clone, open in VS Code, "Reopen in Container" (devcontainer included —
   Claude Code pre-installed; note it defaults to `bypassPermissions` inside
   the container, change that in `~/.claude/settings.json` if you prefer
   prompts).
2. First run seeds an empty brain from `templates/`. Fill `wiki/about-me.md` —
   who you are, what you want from your mentor.
3. Drop raw notes (journals, exports, docs) into `inbox/` and tell Claude:
   `process inbox`.
4. Talk. After meaningful sessions, run `/reflect`.

Your data (`wiki/`, `inbox/`) is gitignored — the engine and the brain are
cleanly separated, and git hooks (`scripts/githooks/`) block personal data
and credentials from ever entering a commit or a push.

## How it's wired

Everything ships as standard Claude Code project config — no plugin install:

- **Skills** (`.claude/skills/`): `/wiki-ingest`, `/save`, `/wiki-retrieve`,
  `/reflect` — auto-discovered by Claude Code.
- **Hooks** (`.claude/settings.json`):
  - `SessionStart` (startup, resume, and post-compaction) — loads
    `about-me.md` → `LESSONS.md` → `hot.md`, clears stale wiki locks.
    The `compact` matcher re-injects the context that compaction drops.
    Safe no-op when no vault exists.
  - `Stop` — nudges a `hot.md` refresh when wiki pages changed this session,
    and offers `/reflect` after substantive sessions (never runs it silently).

Personal overrides go in `.claude/settings.local.json` (gitignored).

## Optional

- `bash bin/setup-embeddings.sh` — local semantic rerank via ollama (no egress)
- `bash bin/setup-mode.sh` — vault methodology: LYT / PARA / Zettelkasten
- `bash bin/setup-retrieve.sh` — build the hybrid retrieval index

## Credits / prior art

Reflect pattern inspired by outcome-weighted memory in
[Graphify](https://github.com/Graphify-Labs/graphify); capture-hook pattern from
[claude-mem](https://github.com/thedotmack/claude-mem); markdown-first memory
philosophy shared with [basic-memory](https://github.com/basicmachines-co/basic-memory).
InnerLoop's focus is the layer none of them ship: the mentor.

## License

[MIT](LICENSE)
