---
description: Configure menhera-loop Claude Code UI messaging.
argument-hint: "[hooks-only|append|full] [user|project|local]"
---

Configure menhera-loop UI settings without overwriting unrelated Claude Code settings.

Use the user's arguments to choose mode and scope:

- Mode `hooks-only`: do not change spinner UI settings; plugin hooks still provide status messages.
- Mode `append`: add menhera-loop spinner verbs and tips while keeping Claude defaults.
- Mode `full`: replace spinner verbs and show only menhera-loop tips.
- Scope `user`: `~/.claude/settings.json`.
- Scope `project`: `.claude/settings.json`.
- Scope `local`: `.claude/settings.local.json`.

Defaults: `full local`.

Run this command from the plugin root:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup-ui.mjs" --mode full --scope local
```

Adjust `--mode` and `--scope` to match the user's arguments. The script creates a menhera-loop backup before touching `spinnerVerbs`, `spinnerTipsOverride`, or `subagentStatusLine`; all other settings keys must be preserved.
