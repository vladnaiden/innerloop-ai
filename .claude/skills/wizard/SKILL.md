---
name: wizard
description: Generate an interactive bash wizard that walks a human through steps only they can perform. Use when provisioning infrastructure, setting up credentials or CI secrets, walking an unfamiliar third-party dashboard, or running a one-off migration or cutover. Don't invoke this for steps the agent can perform itself.
---

# Wizard

A **wizard** is a bash script that walks a human, step by step, through a manual procedure that's tedious to do by hand and tedious to re-explain to an AI every time. It opens each URL, says exactly what to click and copy, captures the values, writes them where they belong (`.env`, GitHub secrets), confirms at every stage, and shows how many stages are left. It might configure third-party services, run a one-off migration, or move the project from one state to another.

The delightful UX is already solved by [template.sh](template.sh): stage-by-stage progress, confirmation gates, cross-platform URL opening (including WSL), hidden secret entry, idempotent `.env` upserts, `gh secret`/`gh variable` writes, and a closing summary. **Your job is only to scope the procedure and author its stages.** The library above the `STAGES` marker is identical in every wizard; that consistency is the point: never hand-edit it.

A wizard is ephemeral by default: built for one run, saved to a scratch or `scripts/` path, deleted when the job's done. Commit it only when the user wants a repeatable setup path that should live in the repo.

## Process

### 1. Scope the procedure

Work out every manual step the human must take and every value that gets captured along the way. Read the repo first, don't ask cold:

- For setup: `.env`, `.env.example`, `.env.*`, `README`, `docker-compose*`, framework config, and `.github/workflows/*` (every `secrets.*` / `vars.*` reference is a value the wizard must produce).
- For a migration or transition: the current state, the target state, and the irreversible actions between them.

Then show the user the ordered list of stages and the values each produces, and confirm: they may add, drop, or reorder.

**Done when:** every stage is named in order, and for each captured value you know (a) where the human gets it, (b) where it's written (`.env`, a GitHub secret, both, or nowhere; some stages are pure actions), and (c) whether it's secret (hidden entry) or public.

### 2. Map each stage's journey

For each stage, write the precise path a human follows: which URL to open, what to do there, where a value is shown, which variable it fills: e.g. "Dashboard → Developers → API keys → Reveal test key → copy". Where you don't actually know the current UI or the exact command, say so and ask the user or check the docs: never invent steps that may not exist.

**Done when:** every stage traces to concrete instructions a stranger could follow.

### 3. Author the wizard

Copy `template.sh` to the target path. Replace the example stage with one `stage` per step, in dependency order. Use the library helpers: `stage`, `say`/`step`, `open_url`, `ask`/`ask_secret`, `write_env`, `set_secret`/`set_var`, `pause`/`confirm`. Set `TOTAL_STAGES` to the number of stages you wrote.

Hold the bar the template sets: open the URL before asking for its value, use `ask_secret` for anything secret, `write_env` every persisted value, `set_secret` only the values CI actually needs, and `confirm` before any irreversible action. Each `stage` clears the screen so only the current step is visible: keep a stage to one focused task so nothing the human needs scrolls away. Don't touch the library above the marker.

### 4. Verify and hand off

- `bash -n <script>`; run `shellcheck` if available.
- `chmod +x <script>`.
- Don't run it end-to-end yourself: it opens browsers and blocks on human input. Trace it statically instead: every value from step 1 is captured and lands where step 1 said, and every `set_secret` name exactly matches a `secrets.*` reference in CI.
- Tell the user how to run it. If it's a repeatable setup path, commit it and link it from the README so the next person runs the script instead of asking an AI.

---

## In this workspace (ours, not upstream)

Upstream: mattpocock/skills `skills/engineering/wizard`, MIT, commit 4ae2317 (01.11.2026). Everything above the `---` rule is
verbatim; edit only this section. Added because keys reach the chat in almost every site session (35 turns in 12 sessions) and
the "rotate it" steps never get confirmed (six open on 31.10.2026: DeyeCloud, Claude OAuth, Telegram, SE Ranking, Binance, Bing).
**Whenever the next step is "he pastes a key" or "he rotates X", write a wizard instead** (`secrets-intake` points here).

- **Where it lives.** One-off: `output/<DD.MM.YYYY>/wizards/<name>.sh` (gitignored brain). Repeatable setup worth keeping
  (re-login a hub MCP, rotate a connector key): `bin/wizards/<name>.sh`, committed — then no stage may hold a value, only prompts.
- **Where values go** (the library's `write_env` writes dotenv; pick the file by kind, as in `secrets-intake` §2):
  `repositories/mcp/api-mcp/.env`, `.env.d/<area>.env`, `.devtools/.deploy.env`, `.devtools/affiliate-site/.env.local` — set
  `ENV_FILE=` per stage and check `git check-ignore -q "$ENV_FILE"` first. `~/.api-mcp/secrets.json` is JSON: define this below the
  STAGES marker (value via the environment, never argv):

  ```bash
  write_secret_json() {  # write_secret_json KEY "$VALUE" → ~/.api-mcp/secrets.json, 0600
    K="$1" V="$2" python3 -I -c 'import json,os;p=os.path.expanduser("~/.api-mcp/secrets.json");d=json.load(open(p)) if os.path.exists(p) else {};d[os.environ["K"]]=os.environ["V"];o=os.open(p+".tmp",os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600);os.write(o,json.dumps(d,indent=2).encode());os.close(o);os.replace(p+".tmp",p)'
    WRITTEN_ENV+=("$1→secrets.json"); printf '  %s✓ wrote%s %s → ~/.api-mcp/secrets.json\n' "$GREEN" "$RESET" "$1"
  }
  ```

- **End every wizard with a verify stage**: one call that proves the new value works (connector `subscription`, zone list,
  `SELECT 1`) printing OK/FAIL only — then a stamp so the next session knows it happened without seeing a value:

  ```bash
  stamp() { mkdir -p ~/.claude/wizards; printf '{"at":"%s","wizard":"%s","done":"%s"}\n' "$(date -Is)" "$(basename "$0")" "$1" >> ~/.claude/wizards/done.jsonl; }
  ```

  Before listing "rotations still open" anywhere (`hot.md`, `launch-status`), read `~/.claude/wizards/done.jsonl`.
- **How he runs it:** in a VS Code terminal inside the container, `bash <path>` — never via `!` (no TTY: `read -s` and the
  screen clears break). There is no browser in the container, so `open_url` falls back to printing the link; that is expected.
- Claude never `cat`s the env file afterwards to "check" — the verify stage is the check. `set_secret`/`set_var` (GitHub Actions)
  rarely apply: the site deploys through Coolify, whose env is set in its UI or `ops/` scripts.
