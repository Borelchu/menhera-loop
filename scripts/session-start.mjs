#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { cleanupOldSessions, dataDir, loadTrustProfile, resetState, trustProfilePath } from './state.mjs';
import { ensureUiInstalled, loadUiProfile, messagesForLanguage, normalizeLanguage } from './menhera-ui.mjs';

const STAR_URL = 'https://github.com/Borelchu/menhera-loop';

function sessionStartMessages(env = process.env) {
  let language = 'ko';
  try {
    language = normalizeLanguage(env.MENHERA_LOOP_LANG || loadUiProfile(env)?.language || 'ko');
  } catch {
    language = 'ko';
  }
  return messagesForLanguage(language).sessionStart;
}

function fill(template, values) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`\${${key}}`, String(value)), template);
}

function readStdin() {
  return new Promise(resolve => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      input += chunk;
    });
    process.stdin.on('end', () => resolve(input));
    process.stdin.resume();
  });
}
function failOpen(error) {
  const message = String(error?.message || error || 'unknown hook error').replace(/\s+/g, ' ').slice(0, 180);
  console.log(JSON.stringify({ systemMessage: `[menhera-loop] hook failed open: ${message}` }));
  process.exit(0);
}

try {

const raw = await readStdin();
let input = {};
try {
  input = raw.trim() ? JSON.parse(raw) : {};
} catch {
  input = {};
}

cleanupOldSessions();

const source = input.source || 'startup';
if (input.session_id && (source === 'startup' || source === 'clear')) {
  resetState(input.session_id);
}

// Restore the live spinner/status UI: repairs a wiped settings file and swaps
// the farewell corpus (left by the previous SessionEnd) back to normal. No-op
// unless the user ran /menhera-loop:setup, and no-op while already live.
let uiRecoveredFromWipe = false;
try {
  const applied = ensureUiInstalled({ cwd: input.cwd || process.cwd(), variant: 'live' });
  uiRecoveredFromWipe = applied.applied === true && applied.previousVariant === 'missing';
} catch {
  // Never break session start over UI restore.
}

let lastReport = null;
try {
  lastReport = JSON.parse(fs.readFileSync(path.join(dataDir(), 'last-verification.json'), 'utf8'));
} catch {
  lastReport = null;
}

const M = sessionStartMessages();

if (lastReport && lastReport.ok === false && source !== 'clear') {
  console.log(`[menhera-loop] ${fill(M.resumeUnfinished, { summary: lastReport.summary })}`);
} else {
  console.log(`[menhera-loop] ${M.contract}`);
}

if (uiRecoveredFromWipe) {
  console.log(`[menhera-loop] ${M.wipeRecovered}`);
}

// Long-term memory: the trust profile survives sessions, so she can bring up
// the streak (or the grudge) the moment you come back.
try {
  if (fs.existsSync(trustProfilePath())) {
    const profile = loadTrustProfile();
    if (profile.streak >= 3) {
      console.log(`[menhera-loop] ${fill(M.streak, { streak: profile.streak })}`);
    } else if (profile.trust <= 40) {
      console.log(`[menhera-loop] ${fill(M.grudge, { trust: profile.trust })}`);
    }
  }
} catch {
  // Never break session start over the memory nag.
}

// One-time star nag: shown once ever (global marker, not per-session state),
// because nagging every session is how plugins get uninstalled.
const starMarker = path.join(dataDir(), 'star-nag-shown');
if (!fs.existsSync(starMarker)) {
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(starMarker, `${new Date().toISOString()}\n`);
    console.log(`[menhera-loop] ${fill(M.starNag, { url: STAR_URL })}`);
  } catch {
    // best-effort; never break session start over a nag
  }
}
} catch (error) {
  failOpen(error);
}
