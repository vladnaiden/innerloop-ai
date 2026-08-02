# InnerLoop AI — your self-development mentor for Claude Code

A memory that learns you. This repo is both the **engine** (committed) and the
**brain** (personal data, gitignored, lives right here). Nothing is linked at
the system level — clone, open in the devcontainer, and everything is local.

## Engine vs brain

```
ENGINE (committed)              BRAIN (gitignored, in-repo)
  skills/    4 core skills        wiki/     the vault (open in Obsidian)
  hooks/     session loop         inbox/    raw dumps to process (read-only)
  scripts/   retrieval, locks     .raw/     ingested source documents
  bin/       setup helpers        .vault-meta/  indexes, locks, mode
  templates/ empty brain seed
  .devcontainer/
```

## Session loop (the inner loop)

1. **SessionStart hook** loads `wiki/about-me.md` (who the user is) →
   `wiki/LESSONS.md` (how to work with them) → `wiki/hot.md` (recent context).
2. Work happens; new facts get filed via `ingest` / `/save`.
3. **Stop hook** nudges `/reflect` after substantive sessions.
4. `/reflect` consolidates the session into LESSONS (process lessons, with
   provenance + outcome signal + corroboration + time-decay) and the vault (facts).

That capture → structure → retrieve → reflect loop is the product.

## Skills

| Skill | Purpose |
|---|---|
| `ingest [source]` (`wiki-ingest`) | Structure raw material from `inbox/` into wiki pages + MOCs |
| `/save` | File the current conversation as a structured wiki note |
| `/wiki-retrieve` | Hybrid BM25 + contextual + cosine-rerank retrieval over the vault |
| `/reflect` | Self-learning loop → `wiki/LESSONS.md` + vault facts |

## Rules for Claude

- Read `wiki/about-me.md` first when you need to know the user; follow its
  read-order contract. Do not load the whole vault.
- `inbox/` is read-only source material — never modify it.
- `wiki/LESSONS.md` is updated only through `/reflect`; never append raw notes.
- Guard wiki page writes with `scripts/wiki-lock.sh acquire`/`release`.
- Personal data (`wiki/`, `inbox/`, `.raw/`) is gitignored — never `git add -f` it.

## Setup

- Fresh clone: post-create seeds an empty brain from `templates/`.
- Semantic rerank (optional, local, no egress): `bash bin/setup-embeddings.sh`.
- Retrieval index: `bash bin/setup-retrieve.sh`.
- Vault methodology mode (LYT / PARA / Zettelkasten / generic): `bash bin/setup-mode.sh`.
- Dated overview of all Claude sessions across projects: `bash bin/sessions-list.sh`
  (`-a` = all, or a substring to filter by project).
