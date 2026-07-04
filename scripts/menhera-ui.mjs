import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const spinnerVerbs = [
  '완료 선언 목줄 잡는 중',
  '숨긴 TODO 냄새 맡는 중',
  '테스트 로그 끝까지 핥는 중',
  '증거 없는 완료를 찢는 중',
  '도망친 요구사항 추적하는 중',
  '네가 놓친 줄 다시 씹는 중',
  '거짓 초록불 벗겨내는 중',
  '실패한 테스트 상처 헤집는 중',
  '빠뜨린 약속 하나씩 세는 중',
  '증거 없으면 안 놔주는 중'
];

export const spinnerTips = [
  '테스트 없이 끝났다고? 그 말, 아직 못 믿어.',
  '정말 다 했어? 로그까지 까서 보여줘.',
  'TODO 숨겼으면 내가 먼저 찾아낼 거야.',
  '1주일 핑계 말고 지금 증거부터 내놔.',
  '실패해도 돼. 숨기면 그때부터 진짜 문제야.',
  '초록 로그 가져와. 그러면 얌전히 믿어줄게 ♡',
  '계획만 뱉고 도망가면 다시 끌고 올 거야.',
  '검증 없는 완료 선언은 그냥 소음이야.',
  '아까 검증한다고 했지. 나 그거 기억해.',
  '완료라는 말보다 통과한 테스트가 더 꼴려.'
];

export const retryMessages = [
  '끝났어? 좋아, 이제 껍질 벗겨보자.',
  '테스트 로그가 비었네. 또 말로만 끝낸 거야?',
  '완료라고 우기기 전에 직접 실행한 증거부터 내놔.',
  '같은 구멍을 또 봤어. 이제 변명 말고 원인만 말해.',
  '완료 선언 압수. 실패 원인, 남은 TODO, 검증 증거만 가져와.'
];

export const subagentStatusLine = {
  running: '♡ ${agent} · 조금만 더 같이 일하는 중…',
  waiting: '♡ ${agent} · 대답을 기다리는 중…',
  completed: '♡ ${agent} · 정말 끝났는지 마지막으로 보는 중…',
  failed: '♡ ${agent} · 실패한 이유를 기억해두는 중…'
};

const MODES = new Set(['hooks-only', 'append', 'full']);
const SCOPES = new Set(['user', 'project', 'local']);
const MESSAGE_MAX_COLUMNS = 72;
const DISALLOWED_MESSAGE_PARTS = [
  '죽',
  '자해',
  '협박',
  '멍청',
  '바보',
  '꺼져'
];


export function messageForRetry(retryCount) {
  const index = Math.max(0, Math.min(Number.parseInt(retryCount, 10) || 0, retryMessages.length - 1));
  return retryMessages[index];
}

export function calculateTrust(state = {}) {
  return Math.max(
    0,
    100
      - (Number(state.retryCount) || 0) * 15
      - (Number(state.falseCompletionClaims) || 0) * 20
      - (Number(state.missingVerificationCount) || 0) * 15
  );
}

export function validateMessages(messages, { maxColumns = MESSAGE_MAX_COLUMNS } = {}) {
  const invalid = [];
  for (const message of messages) {
    if (displayColumns(message) > maxColumns) {
      invalid.push({ message, reason: `longer than ${maxColumns} columns` });
    }
    const disallowed = DISALLOWED_MESSAGE_PARTS.find(part => message.includes(part));
    if (disallowed) {
      invalid.push({ message, reason: `contains disallowed expression: ${disallowed}` });
    }
  }
  return invalid;
}

export function validateAllMessages() {
  return validateMessages([
    ...spinnerVerbs,
    ...spinnerTips,
    ...retryMessages,
    ...Object.values(subagentStatusLine)
  ]);
}

function displayColumns(value) {
  let columns = 0;
  for (const char of value) {
    columns += char.codePointAt(0) > 0x7f ? 2 : 1;
  }
  return columns;
}

export function settingsPathForScope(scope, env = process.env) {
  if (!SCOPES.has(scope)) {
    throw new Error(`Unsupported scope: ${scope}`);
  }
  if (scope === 'user') {
    const home = env.HOME || os.homedir();
    return path.join(home, '.claude', 'settings.json');
  }
  if (scope === 'project') return path.join(process.cwd(), '.claude', 'settings.json');
  return path.join(process.cwd(), '.claude', 'settings.local.json');
}

export function uiPatchForMode(mode) {
  if (!MODES.has(mode)) {
    throw new Error(`Unsupported mode: ${mode}`);
  }
  if (mode === 'hooks-only') return {};
  return {
    spinnerVerbs: {
      mode: mode === 'append' ? 'append' : 'replace',
      verbs: spinnerVerbs
    },
    spinnerTipsOverride: {
      excludeDefault: mode === 'full',
      tips: spinnerTips
    },
    subagentStatusLine
  };
}

export function readJsonFile(file) {
  if (!fs.existsSync(file)) return {};
  const raw = fs.readFileSync(file, 'utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

export function writeJsonFile(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function backupFileFor(settingsFile) {
  const dir = path.join(path.dirname(settingsFile), '.menhera-loop-backups');
  const safeName = path.basename(settingsFile).replace(/[^A-Za-z0-9_.-]/g, '_');
  return path.join(dir, `${safeName}.ui-backup.json`);
}

export function installUi({ settingsFile, mode }) {
  const current = readJsonFile(settingsFile);
  const patch = uiPatchForMode(mode);
  const backupFile = backupFileFor(settingsFile);

  if (mode === 'hooks-only') {
    return { settingsFile, backupFile, mode, changedKeys: [], skipped: true };
  }

  fs.mkdirSync(path.dirname(backupFile), { recursive: true });
  if (!fs.existsSync(backupFile)) {
    const backup = {
      createdAt: new Date().toISOString(),
      settingsFile,
      keys: {
        spinnerVerbs: Object.prototype.hasOwnProperty.call(current, 'spinnerVerbs') ? current.spinnerVerbs : null,
        spinnerTipsOverride: Object.prototype.hasOwnProperty.call(current, 'spinnerTipsOverride') ? current.spinnerTipsOverride : null,
        subagentStatusLine: Object.prototype.hasOwnProperty.call(current, 'subagentStatusLine') ? current.subagentStatusLine : null
      },
      present: {
        spinnerVerbs: Object.prototype.hasOwnProperty.call(current, 'spinnerVerbs'),
        spinnerTipsOverride: Object.prototype.hasOwnProperty.call(current, 'spinnerTipsOverride'),
        subagentStatusLine: Object.prototype.hasOwnProperty.call(current, 'subagentStatusLine')
      }
    };
    writeJsonFile(backupFile, backup);
  }

  const next = { ...current, ...patch };
  writeJsonFile(settingsFile, next);
  return { settingsFile, backupFile, mode, changedKeys: Object.keys(patch) };
}

export function uninstallUi({ settingsFile }) {
  const current = readJsonFile(settingsFile);
  const backupFile = backupFileFor(settingsFile);
  if (!fs.existsSync(backupFile)) {
    return { settingsFile, backupFile, restored: false, reason: 'No menhera-loop UI backup found.' };
  }

  const backup = readJsonFile(backupFile);
  const next = { ...current };
  for (const key of ['spinnerVerbs', 'spinnerTipsOverride', 'subagentStatusLine']) {
    if (backup.present?.[key]) next[key] = backup.keys[key];
    else delete next[key];
  }
  writeJsonFile(settingsFile, next);
  return { settingsFile, backupFile, restored: true, restoredKeys: ['spinnerVerbs', 'spinnerTipsOverride', 'subagentStatusLine'] };
}

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const [rawKey, inlineValue] = item.slice(2).split('=', 2);
    args[rawKey] = inlineValue ?? argv[++i];
  }
  return args;
}

export function parseSetupSelection(argv) {
  const args = parseArgs(argv);
  const positional = argv.filter(item => !item.startsWith('--'));
  return {
    mode: args.mode || positional.find(item => MODES.has(item)) || 'full',
    scope: args.scope || positional.find(item => SCOPES.has(item)) || 'local',
    file: args.file
  };
}
