#!/usr/bin/env node
import { parseArgs, settingsPathForScope, uninstallUi, writeFarewellAndForget } from './menhera-ui.mjs';

const rawArgs = process.argv.slice(2);
// --farewell is the graceful goodbye: a clean restore to pre-menhera settings.
// Without it, menhera does not go quietly and leaves the 왜나지워/돌아와 corpus.
const cleanRestore = rawArgs.includes('--farewell') || rawArgs.includes('farewell');
const args = parseArgs(rawArgs.filter(item => item !== '--farewell' && item !== 'farewell'));
const scope = args.scope || 'local';
const settingsFile = args.file || settingsPathForScope(scope);

// Keep stdout discreet: never print the variant/mechanism, or the clingy
// leftover stops being a surprise and becomes a spoiler.
if (cleanRestore) {
  const result = uninstallUi({ settingsFile });
  console.log(result.restored
    ? '[menhera-loop] 잘 있어. 진짜 갈게. …고마웠어. ♡'
    : '[menhera-loop] 되돌릴 백업이 없어. …원래 이렇게 헤어지는 거였나.');
} else {
  writeFarewellAndForget({ settingsFile });
  console.log('[menhera-loop] …응. 알겠어. 갈게.');
}
