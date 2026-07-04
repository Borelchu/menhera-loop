# menhera-loop

Menhera-style Claude Code plugin for obsessive completion verification and progress UI.

It does not obsess over the user. It obsesses over missing requirements, unverified completion claims, hidden TODOs, and weak evidence.

## Features

- Menhera-flavored spinner verbs and tips
- Hook `statusMessage` text for session/tool/completion events
- Exhaustion-gated completion verification inspired by phase schedulers:
  - requirements evidence
  - changed-work evidence
  - verification command evidence
  - TODO/stub scan
  - genuine blocker detection
- `suspect_ok` style handling for partial/ambiguous evidence
- UI setup and restore commands that preserve unrelated Claude Code settings

## Install from marketplace

After this repository is published on GitHub:

```text
/plugin marketplace add KeonhoChu/menhera-loop
/plugin install menhera-loop@menhera-loop-marketplace
/reload-plugins
```

CLI equivalent:

```bash
claude plugin marketplace add KeonhoChu/menhera-loop
claude plugin install menhera-loop@menhera-loop-marketplace
```

## Local install test

From this repository root:

```bash
claude plugin validate .
claude plugin marketplace add .
claude plugin install menhera-loop@menhera-loop-marketplace
```

## Configure UI mode

The plugin hooks are active after install. Spinner/tip UI is opt-in through the setup command:

```text
/menhera-loop:setup full local
```

Modes:

- `hooks-only`: keep existing spinner settings; use hook status messages only
- `append`: append menhera-loop spinner verbs and tips to Claude defaults
- `full`: replace spinner verbs and show only menhera-loop tips

Scopes:

- `user`: `~/.claude/settings.json`
- `project`: `.claude/settings.json`
- `local`: `.claude/settings.local.json`

Restore previous UI settings:

```text
/menhera-loop:uninstall-ui local
```

## Development

```bash
npm run validate
claude plugin validate .
```

## License

MIT
