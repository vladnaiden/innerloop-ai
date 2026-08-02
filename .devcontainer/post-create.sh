#!/usr/bin/env bash
# Runs once after the container is created (and after rebuilds).
set -euo pipefail

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

# A volume created by an older image can be root-owned — fix it. The projects
# dir is a host bind mount and must never be swept by a recursive chown, so it
# is excluded here and handled non-recursively below.
if [ ! -w "$CLAUDE_DIR" ]; then
  sudo chown "$(id -u):$(id -g)" "$CLAUDE_DIR"
  find "$CLAUDE_DIR" -mindepth 1 -maxdepth 1 ! -name projects \
    -exec sudo chown -R "$(id -u):$(id -g)" {} +
fi
if [ ! -w /commandhistory ]; then
  sudo chown -R "$(id -u):$(id -g)" /commandhistory
fi
# The host-shared projects bind mount can arrive root-owned on Linux hosts.
# Non-recursive on purpose: never rewrite ownership of host session files.
if [ ! -w "$CLAUDE_DIR/projects" ]; then
  sudo chown "$(id -u):$(id -g)" "$CLAUDE_DIR/projects"
fi

# Default to bypass-permissions inside the container only. Never touches the
# host: this settings.json lives in the named volume. Written once so later
# manual edits survive rebuilds.
SETTINGS="$CLAUDE_DIR/settings.json"
if [ ! -f "$SETTINGS" ]; then
  cat > "$SETTINGS" <<'EOF'
{
  "permissions": {
    "defaultMode": "bypassPermissions"
  }
}
EOF
  echo "Wrote $SETTINGS (defaultMode: bypassPermissions)"
fi

# No global vault pointer here on purpose: the brain lives inside this repo
# (wiki/ + inbox/, gitignored) and CLAUDE.md in the repo root describes it.
# Nothing is linked at the system level.

# The workspace bind mount can have a different owner than the container user.
git config --global --add safe.directory "$PWD"

# Home dir is ephemeral (only $CLAUDE_DIR is a volume), so the native install
# in ~/.local must be redone after every rebuild. It shadows the root-owned
# npm copy in /usr/local/bin and lets the auto-updater work without sudo.
claude install
grep -q '\.local/bin' "$HOME/.bashrc" || echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"

# First-run bootstrap: if the brain is empty (fresh clone), seed it from templates.
if [ ! -f wiki/about-me.md ] && [ -d templates ]; then
  mkdir -p wiki inbox
  cp -n templates/about-me.md templates/LESSONS.md templates/hot.md wiki/ 2>/dev/null || true
  echo "Seeded empty brain from templates/ — fill wiki/about-me.md to begin."
fi

echo "post-create done. Sessions persist in the per-project claude-config named volume."
echo "Resume the last conversation with: claude --continue   (or pick one: claude --resume)"
