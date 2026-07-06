#!/usr/bin/env node
import { installUi, messagesForLanguage, parseSetupSelection, settingsPathForScope } from './menhera-ui.mjs';

const selection = parseSetupSelection(process.argv.slice(2));
const settingsFile = selection.file || settingsPathForScope(selection.scope);

const result = installUi({ settingsFile, mode: selection.mode, language: selection.language, scope: selection.scope, intensity: selection.intensity });
const messages = messagesForLanguage(selection.language);
const lines = [
  `mode=${selection.mode} · scope=${selection.scope} · lang=${selection.language} · intensity=${selection.intensity}`,
  result.skipped
    ? `settings untouched: ${result.settingsFile}`
    : `settings: ${result.settingsFile} (backup: ${result.backupFile})`,
  messages.setup[selection.mode === 'hooks-only' ? 'hooksOnly' : selection.mode],
  ...(selection.intensity === 'soft' ? [messages.setup.soft] : []),
  messages.preflightContractMessage
];
for (const line of lines) console.log(`[menhera-loop] ${line}`);
