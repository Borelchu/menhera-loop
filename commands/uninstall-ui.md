---
description: Restore Claude Code UI settings changed by menhera-loop setup.
argument-hint: "[user|project|local]"
---

Restore the selected Claude Code settings file from the menhera-loop UI backup created by `/menhera-loop:setup`.

Scopes:

- `user`: `~/.claude/settings.json`.
- `project`: `.claude/settings.json`.
- `local`: `.claude/settings.local.json`.

Default: `local`.

Run this command from the plugin root:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/uninstall-ui.mjs" --scope local
```

Adjust `--scope` to match the user's argument. The script restores only `spinnerVerbs`, `spinnerTipsOverride`, and `subagentStatusLine` to their pre-install values and preserves all other settings keys.
