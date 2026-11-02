---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up. Use before a long session runs out of context, before /branch, or when he says "continue this in a new session", "save where we are", "передай іншій сесії", "write a handoff".
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
---

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save it to
`output/<DD.MM.YYYY>/handoffs/<HHMM>-<slug>.md` in this workspace (gitignored brain) — not `/tmp`, which a container restart
wipes. Print the path and the session's full 36-character id (newest file in `~/.claude/projects/-workspaces-innerloop-ai/`)
at the end of the reply, so `session-find` and the next session can open it.

Include a "suggested skills" section in the document, naming which skills the next agent should call the Skill tool for.

Do not duplicate content already captured in other artifacts (specs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

Redact any sensitive information, such as API keys, passwords, or personally identifiable information.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.

---

## In this workspace (ours, not upstream)

Adapted from mattpocock/skills `skills/productivity/handoff`, MIT, commit 4ae2317 (01.11.2026). Changed from upstream: the save
path (upstream: the OS temp dir), the session id line, and the trigger phrases. Added because 30 of 126 sessions ran into
compaction, and three `/branch` career threads (28–29.10.2026) ended in a compaction with no answer and no record.

Shape of the document, in this order — keep it under one screen per section:

1. **Goal** — his request in his words (verbatim quote, his language), plus any later edit-and-resend addendum.
2. **Done** — what changed, with file paths / commits / artefacts in `output/`, and the evidence each one works.
3. **Open** — what is not done, and why (blocked on him / on a vendor / not started). His steps separate from Claude's.
4. **Decisions and constraints** — owner rules that bit in this session (BR-OPS-17 preview-first, BR-DATA-10 never delete,
   Nord pool cap…), and choices he made, quoted.
5. **Next step** — the one command or action the next session starts with.
6. **Suggested skills.**

Redaction follows `credentials-never-processed`: no key, token, password, OAuth code, or the medical / passport details of a
health session — name the file instead. A handoff is not a vault note: if the content is a durable fact about him, `/save` it too.
