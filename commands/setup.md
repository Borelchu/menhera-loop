---
description: Configure menhera-loop Claude Code UI messaging.
argument-hint: "[hooks-only|append|full] [user|project|local] [ko|en|ja] [soft]"
---

Configure menhera-loop UI settings without overwriting unrelated Claude Code settings.

Use the user's arguments to choose mode, scope, and language:

- Mode `hooks-only`: do not change spinner UI settings; plugin hooks still provide status messages.
- Mode `append`: add menhera-loop spinner verbs and tips while keeping Claude defaults; never touches the user's `statusLine`.
- Mode `full`: replace spinner verbs, show only menhera-loop tips, and install the trust status line (`statusLine`).
- Scope `user`: `~/.claude/settings.json`.
- Scope `project`: `.claude/settings.json`.
- Scope `local`: `.claude/settings.local.json`.
- Language `ko`: Korean obsessive message corpus.
- Language `en`: English obsessive message corpus.
- Language `ja`: Japanese obsessive message corpus.
- Intensity `soft`: same gate decisions and retry cap, but retry tone stays at the mild stages and the star/silent-recovery nags are skipped. Default intensity is `full` (pass `--intensity=full` explicitly if needed — bare `full` means the UI mode).

Defaults: `full local ko` unless `MENHERA_LOOP_LANG` is set. Short forms like `en` or `ja` are enough; omitted mode/scope fall back to `full local`.

Run this command from the plugin root:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup-ui.mjs" --mode full --scope local --lang ko
# Equivalent simple user-facing forms:
# /menhera-loop:setup
# /menhera-loop:setup en
# /menhera-loop:setup ja
# /menhera-loop:setup soft
```

Adjust `--mode`, `--scope`, `--lang`, and `--intensity` to match the user's arguments. The script prints a `[menhera-loop]` summary of what was applied — relay it to the user as-is. The script creates a menhera-loop backup before touching `spinnerVerbs`, `spinnerTipsOverride`, `subagentStatusLine`, or `statusLine`; all other settings keys must be preserved.
