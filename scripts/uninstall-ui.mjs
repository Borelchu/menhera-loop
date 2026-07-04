#!/usr/bin/env node
import { parseArgs, settingsPathForScope, uninstallUi } from './menhera-ui.mjs';

const args = parseArgs(process.argv.slice(2));
const scope = args.scope || 'local';
const settingsFile = args.file || settingsPathForScope(scope);

const result = uninstallUi({ settingsFile });
console.log(JSON.stringify({ ok: true, ...result }, null, 2));
