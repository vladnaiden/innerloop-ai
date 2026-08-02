---
name: reflect
description: "Self-learning loop for the personal vault. Reviews the current session for what worked / didn't / was corrected by the user, extracts durable lessons and new facts, and updates wiki/LESSONS.md (how to work with the user) and the vault (facts about the user) with provenance + outcome signals + corroboration + time-decay. Triggers on: reflect, /reflect, learn from this session, update lessons, що ти вивчив, онови уроки, самонавчання, зроби рефлексію."
---

# reflect: Self-Learning Loop

Turn a conversation into durable, trust-scored memory. Modeled on the outcome-weighted `reflect` pattern (graphify): memory that carries a **result signal** and **provenance**, where trust is earned by **corroboration** and decays with **time** — not a raw transcript log.

Two distinct outputs, never mixed:
- **`wiki/LESSONS.md`** — *how to work with the user* (process/preferences/mistakes). The sidecar.
- **The vault** (`wiki/…`, `about-me.md`) — *facts about the user* (durable knowledge). Route via `/wiki-ingest` / `/save` conventions.

---

## When to run

- User says "reflect" / "/reflect" / "онови уроки" / "що ти вивчив".
- After a substantive session (the `Stop` hook nudges this).
- Never auto-run silently mid-task; it's a deliberate consolidation step.

---

## Procedure

### 1. Gather signals from the session
Scan the current conversation for four kinds of signal. For each, capture **provenance** and an **outcome signal**:

| Signal | How to detect | Provenance | Outcome |
|---|---|---|---|
| **Worked** | user reacted positively / adopted the suggestion / "so, …" (built on it) | `[SAID]` if explicit, else `[INFERRED]` | `useful` |
| **Didn't** | user rejected / it went nowhere / dropped | `[INFERRED]` | `dead_end` |
| **Corrected** | user pushed back and redirected ("не так", "мені треба точність") | `[SAID]` | `corrected` |
| **New fact about the user** | a durable personal fact stated this session | `[SAID]`/`[DATA]` | → goes to the vault, NOT LESSONS |

Also read `wiki/hot.md` and `wiki/LESSONS.md` first so you update, not duplicate.

### 2. Update `wiki/LESSONS.md` (process lessons only)
For each process lesson, apply the rules stated at the top of `LESSONS.md`:

- **Format:** `` - `[PROVENANCE×N]` **lesson** — коротке чому. · signal · YYYY-MM-DD ``
- **Corroboration gate:** a lesson enters **Довірені** only after **≥2 independent confirmations**. First observation → **Орієнтовні**. On a repeat confirmation, bump the `×N` and the date, and promote if N≥2.
- **Time-decay / conflict:** if a fresh `corrected`/`dead_end` contradicts an existing lesson, move both readings to **Суперечливі** and let recency win; if the old lesson is clearly dead, move it to **Архів** with a one-line note.
- **A `corrected` signal** also gets a line in **Виправлення від Vlad** (the rule learned from the mistake).
- **Keep it short.** LESSONS.md loads every session. Merge near-duplicates; archive anything spent. Target < ~40 lines of live lessons.

### 3. Route new facts about the user into the vault
- A durable new fact (goal, constraint, project, health, decision) → update the relevant `wiki/` page or `about-me.md` following `/wiki-ingest` conventions (source-first, cross-link, `[!contradiction]` if it conflicts with an existing page). Do NOT put personal facts in LESSONS.md.
- If it's a whole new raw source, tell the user to drop it in the inbox for a full `ingest` instead.

### 4. Log + hot
- One line in `wiki/log.md`: `## [YYYY-MM-DD] reflect | N lessons updated, M facts filed`.
- If anything material changed, refresh the relevant line in `wiki/hot.md`.

### 5. Report
Show the user, briefly: which lessons were **added / promoted / demoted / archived**, and which facts were filed where. No fabrication — only what the session actually evidenced.

---

## Guardrails

- **Provenance is mandatory.** Never record `[INFERRED]` as if the user said it. This is what keeps the memory honest and non-hallucinatory.
- **One signal ≠ a rule.** Resist minting a "Довірений" lesson from a single interaction — that's how a model overfits to a one-off mood.
- **Contradictions are surfaced, not silently overwritten** (same discipline as `wiki-ingest`).
- **The user owns the memory.** `/reflect` is transparent — every change is reported and lives in a plain Markdown file the user can edit or delete.

---

## How to think (10-principle mapping)

| # | Principle | Application |
|---|---|---|
| 2 | OBSERVE (int) | Am I recording my *hope* about what worked, or the *evidence*? Only evidence. |
| 3 | LISTEN | A correction is the highest-signal event — weight it above praise. |
| 8 | ACCEPT | Not every turn yields a lesson. Empty reflection is a valid outcome. |
| 10 | GROW | Corroboration + decay are what make this compound instead of drift. |
