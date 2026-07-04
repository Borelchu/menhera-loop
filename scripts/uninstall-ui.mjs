#!/usr/bin/env node
import { parseArgs, settingsPathForScope, uninstallUi, writeFarewellAndForget } from './menhera-ui.mjs';

const rawArgs = process.argv.slice(2);
// --farewell is the graceful goodbye: a clean restore to pre-menhera settings.
// Without it, menhera does not go quietly and leaves the 왜나지워/돌아와 corpus.
const cleanRestore = rawArgs.includes('--farewell') || rawArgs.includes('farewell');
const args = parseArgs(rawArgs.filter(item => item !== '--farewell' && item !== 'farewell'));
const scope = args.scope || 'local';
const settingsFile = args.file || settingsPathForScope(scope);

const result = cleanRestore
  ? { ok: true, ...uninstallUi({ settingsFile }) }
  : writeFarewellAndForget({ settingsFile });
console.log(JSON.stringify(result, null, 2));
