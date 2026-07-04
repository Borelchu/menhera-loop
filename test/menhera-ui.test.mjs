import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  calculateTrust,
  installUi,
  messageForRetry,
  parseSetupSelection,
  spinnerTips,
  spinnerVerbs,
  uninstallUi,
  uiPatchForMode,
  validateAllMessages
} from '../scripts/menhera-ui.mjs';

import { buildVerificationReport } from '../scripts/verify-completion.mjs';

test('retry messages clamp to the final emotional stage', () => {
  assert.equal(messageForRetry(0), '끝났어? 좋아, 이제 껍질 벗겨보자.');
  assert.equal(messageForRetry(99), '완료 선언 압수. 실패 원인, 남은 TODO, 검증 증거만 가져와.');
  assert.equal(messageForRetry(-1), '끝났어? 좋아, 이제 껍질 벗겨보자.');
});

test('trust is presentation-only arithmetic and never below zero', () => {
  assert.equal(calculateTrust({ retryCount: 1, falseCompletionClaims: 1, missingVerificationCount: 1 }), 50);
  assert.equal(calculateTrust({ retryCount: 10, falseCompletionClaims: 10, missingVerificationCount: 10 }), 0);
});

test('full mode replaces spinner verbs and excludes default tips', () => {
  const patch = uiPatchForMode('full');
  assert.deepEqual(patch.spinnerVerbs, { mode: 'replace', verbs: spinnerVerbs });
  assert.deepEqual(patch.spinnerTipsOverride, { excludeDefault: true, tips: spinnerTips });
});

test('append mode keeps default tips available', () => {
  const patch = uiPatchForMode('append');
  assert.equal(patch.spinnerVerbs.mode, 'append');
  assert.equal(patch.spinnerTipsOverride.excludeDefault, false);
});

test('hooks-only mode does not modify spinner settings', () => {
  assert.deepEqual(uiPatchForMode('hooks-only'), {});
});

test('message corpus stays short and avoids disallowed expressions', () => {
  assert.deepEqual(validateAllMessages(), []);
});

test('install preserves unrelated settings and uninstall restores prior UI keys', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'menhera-loop-'));
  const settingsFile = path.join(dir, 'settings.json');
  fs.writeFileSync(settingsFile, JSON.stringify({
    model: 'sonnet',
    spinnerVerbs: { mode: 'append', verbs: ['old'] }
  }, null, 2));

  const installResult = installUi({ settingsFile, mode: 'full' });
  const installed = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  assert.equal(installed.model, 'sonnet');
  assert.equal(installed.spinnerVerbs.mode, 'replace');
  assert.deepEqual(installResult.changedKeys, ['spinnerVerbs', 'spinnerTipsOverride', 'subagentStatusLine']);

  const uninstallResult = uninstallUi({ settingsFile });
  const restored = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  assert.equal(uninstallResult.restored, true);
  assert.deepEqual(restored, {
    model: 'sonnet',
    spinnerVerbs: { mode: 'append', verbs: ['old'] }
  });
});

test('hooks-only install is a no-op and does not create settings files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'menhera-loop-'));
  const settingsFile = path.join(dir, 'settings.json');

  const result = installUi({ settingsFile, mode: 'hooks-only' });

  assert.equal(result.skipped, true);
  assert.deepEqual(result.changedKeys, []);
  assert.equal(fs.existsSync(settingsFile), false);
});

test('setup parser accepts positional mode and scope for command UX', () => {
  assert.deepEqual(parseSetupSelection(['append', 'project']), {
    mode: 'append',
    scope: 'project',
    file: undefined
  });
});

test('verification engine rejects first green signal without requirement evidence', () => {
  const report = buildVerificationReport({
    arguments: '완료 done\n$ npm run validate\nValidation passed\nWrite scripts/foo.mjs'
  });

  assert.equal(report.ok, false);
  assert.equal(report.exhausted, false);
  assert.equal(report.missingEvidence.includes('requirements'), true);
  assert.equal(report.verdict, 'incomplete');
});

test('verification engine accepts exhausted evidence gates', () => {
  const report = buildVerificationReport({
    requirements: ['setup command preserves settings'],
    evidence: ['setup command preserves settings: npm run validate 통과'],
    files: [{ path: 'scripts/setup-ui.mjs', content: 'export const ok = true;' }],
    arguments: '$ npm run validate\nValidation passed'
  });

  assert.equal(report.ok, true);
  assert.equal(report.exhausted, true);
  assert.equal(report.verdict, 'strong_ok');
});

test('verification engine surfaces TODO as failed gate', () => {
  const report = buildVerificationReport({
    requirements: ['feature implemented'],
    evidence: ['feature implemented: npm run validate 통과'],
    files: [{ path: 'scripts/feature.mjs', content: '// TODO finish this later' }],
    arguments: '$ npm run validate\nValidation passed\nWrite scripts/feature.mjs'
  });

  assert.equal(report.ok, false);
  assert.equal(report.failedChecks.includes('todos'), true);
});
