#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { calculateTrust, messageForRetry } from './menhera-ui.mjs';

const DEFAULT_CHECKS = [
  { id: 'requirements', phase: 'phase0', label: '요구사항 증거', required: true },
  { id: 'changes', phase: 'phase1', label: '변경 증거', required: true },
  { id: 'verification', phase: 'phase2', label: '검증 실행 증거', required: true },
  { id: 'todos', phase: 'phase2', label: '남은 TODO 확인', required: true },
  { id: 'blockers', phase: 'phase3', label: '외부 blocker 확인', required: false }
];

const SUCCESS_TERMS = [
  'pass',
  'passed',
  'passing',
  'ok',
  'success',
  'validated',
  '통과',
  '성공',
  '완료',
  '검증'
];

const FAILURE_TERMS = [
  'fail',
  'failed',
  'error',
  'panic',
  'exception',
  '실패',
  '오류',
  '에러'
];

const TEST_COMMAND_PATTERNS = [
  /npm\s+run\s+(?:validate|test|lint|build)\b/i,
  /npm\s+test\b/i,
  /node\s+--test\b/i,
  /pnpm\s+(?:test|run\s+(?:validate|lint|build))\b/i,
  /yarn\s+(?:test|run\s+(?:validate|lint|build))\b/i,
  /bun\s+test\b/i,
  /pytest\b/i,
  /cargo\s+test\b/i,
  /go\s+test\b/i,
  /claude\s+plugin\s+validate\b/i
];

const TODO_PATTERN = /\b(TODO|FIXME|XXX|HACK)\b|해야 함|남은|미완료|not implemented|stub|placeholder/i;

export function buildVerificationReport(input = {}) {
  const normalized = normalizeInput(input);
  const checks = DEFAULT_CHECKS.map(check => evaluateCheck(check, normalized));
  const untriedChecks = checks.filter(check => check.status === 'untried').map(check => check.id);
  const missingEvidence = checks.filter(check => check.required && check.status !== 'pass').map(check => check.id);
  const unverifiedRequirements = normalized.requirements.filter(requirement => !hasEvidenceForRequirement(requirement, normalized));
  const failedChecks = checks.filter(check => check.status === 'fail').map(check => check.id);
  const retryCount = Number(normalized.retryCount || 0);
  const falseCompletionClaims = normalized.claimedComplete && missingEvidence.length > 0 ? 1 : 0;
  const missingVerificationCount = missingEvidence.length + unverifiedRequirements.length;
  const exhausted = untriedChecks.length === 0 && missingEvidence.length === 0 && unverifiedRequirements.length === 0;
  const ok = exhausted && failedChecks.length === 0;

  return {
    ok,
    verdict: ok ? 'strong_ok' : missingEvidence.length === 0 ? 'suspect_ok' : 'incomplete',
    phase: firstBlockingPhase(checks) || 'complete',
    trust: calculateTrust({ retryCount, falseCompletionClaims, missingVerificationCount }),
    retryCount,
    retryMessage: ok ? '…이번에는 진짜네. 믿어줄게. 수고했어 ♡' : messageForRetry(retryCount),
    exhausted,
    checks,
    untriedChecks,
    missingEvidence,
    unverifiedRequirements,
    failedChecks,
    requiresHumanInput: normalized.requiresHumanInput,
    summary: summarize({ ok, missingEvidence, untriedChecks, unverifiedRequirements, failedChecks, requiresHumanInput: normalized.requiresHumanInput })
  };
}

export function normalizeInput(input = {}) {
  const text = [
    input.arguments,
    input.prompt,
    input.transcript,
    input.summary,
    input.result,
    input.hook_event_name,
    input.tool_name,
    input.transcriptText,
    input.rawEvent
  ]
    .filter(Boolean)
    .join('\n');
  const events = Array.isArray(input.events) ? input.events : [];
  const files = Array.isArray(input.files) ? input.files : [];
  const commands = [...extractCommands(text), ...events.map(event => event.command).filter(Boolean)];
  const requirements = normalizeList(input.requirements).length > 0
    ? normalizeList(input.requirements)
    : extractRequirements(text);
  const evidence = normalizeList(input.evidence).concat(extractEvidence(text));
  const todoHits = normalizeList(input.todoHits).concat(extractTodoHits(text, files));

  return {
    text,
    events,
    files,
    commands,
    requirements,
    evidence,
    todoHits,
    retryCount: Number(input.retryCount ?? process.env.MENHERA_LOOP_RETRY_COUNT ?? 0),
    claimedComplete: Boolean(input.claimedComplete) || /완료|done|finished|complete/i.test(text),
    requiresHumanInput: Boolean(input.requiresHumanInput) || /requires human|human input|사용자 확인|수동 확인|manual approval/i.test(text)
  };
}

function evaluateCheck(check, input) {
  if (check.id === 'requirements') {
    if (input.requirements.length === 0) return fail(check, '요구사항 또는 수용 기준을 찾지 못함');
    return pass(check, `${input.requirements.length}개 요구사항 후보 발견`);
  }
  if (check.id === 'changes') {
    if (input.files.length > 0 || /Write|Edit|MultiEdit|created|modified|변경|수정|추가/.test(input.text)) {
      return pass(check, '변경 흔적 발견');
    }
    return untried(check, '변경 파일/작업 흔적 없음');
  }
  if (check.id === 'verification') {
    const attempted = input.commands.some(command => TEST_COMMAND_PATTERNS.some(pattern => pattern.test(command)))
      || TEST_COMMAND_PATTERNS.some(pattern => pattern.test(input.text));
    if (!attempted) return untried(check, '테스트/빌드/검증 명령 증거 없음');
    const failed = FAILURE_TERMS.some(term => input.text.toLowerCase().includes(term)) && !SUCCESS_TERMS.some(term => input.text.toLowerCase().includes(term));
    if (failed) return fail(check, '검증 실패 신호 발견');
    return pass(check, '검증 명령 실행 증거 발견');
  }
  if (check.id === 'todos') {
    if (input.todoHits.length > 0) return fail(check, `남은 TODO 후보 ${input.todoHits.length}개 발견`);
    return pass(check, '남은 TODO 후보 없음');
  }
  if (check.id === 'blockers') {
    if (input.requiresHumanInput) return pass(check, '외부 입력 blocker 명시됨');
    return pass(check, '외부 blocker 없음');
  }
  return untried(check, '알 수 없는 check');
}

function pass(check, reason) {
  return { ...check, status: 'pass', reason };
}

function fail(check, reason) {
  return { ...check, status: 'fail', reason };
}

function untried(check, reason) {
  return { ...check, status: 'untried', reason };
}

function firstBlockingPhase(checks) {
  const blocking = checks.find(check => check.required && check.status !== 'pass');
  return blocking?.phase;
}

function summarize(report) {
  if (report.ok) return '모든 필수 검증 게이트가 통과됨';
  const parts = [];
  if (report.missingEvidence.length) parts.push(`missing=${report.missingEvidence.join(',')}`);
  if (report.untriedChecks.length) parts.push(`untried=${report.untriedChecks.join(',')}`);
  if (report.unverifiedRequirements.length) parts.push(`requirements=${report.unverifiedRequirements.length}`);
  if (report.failedChecks.length) parts.push(`failed=${report.failedChecks.join(',')}`);
  if (report.requiresHumanInput) parts.push('human_input=true');
  return parts.join('; ') || '검증 부족';
}

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return [String(value)].filter(Boolean);
}

function extractRequirements(text) {
  const requirements = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (/^- \[[ xX]\]/.test(trimmed) || /수용 기준|requirement|acceptance/i.test(trimmed)) {
      requirements.push(trimmed);
    }
  }
  return requirements;
}

function extractEvidence(text) {
  return text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => TEST_COMMAND_PATTERNS.some(pattern => pattern.test(line)) || /pass|passed|통과|Validation passed/i.test(line));
}

function extractCommands(text) {
  return text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /^(?:>|\$)?\s*(npm|node|pnpm|yarn|bun|pytest|cargo|go|claude)\b/.test(line));
}

function extractTodoHits(text, files) {
  const hits = [];
  for (const line of text.split(/\r?\n/)) {
    if (TODO_PATTERN.test(line)) hits.push(line.trim().slice(0, 160));
  }
  for (const file of files) {
    if (typeof file === 'object' && TODO_PATTERN.test(file.content || '')) hits.push(file.path || 'inline-file');
  }
  return hits;
}

function hasEvidenceForRequirement(requirement, input) {
  const words = String(requirement).toLowerCase().split(/[^\p{L}\p{N}_-]+/u).filter(word => word.length >= 3);
  if (words.length === 0) return input.evidence.length > 0;
  return input.evidence.some(item => {
    const lower = item.toLowerCase();
    return words.some(word => lower.includes(word));
  }) || input.text.toLowerCase().includes(String(requirement).toLowerCase());
}

function readStdin() {
  return new Promise(resolve => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      input += chunk;
    });
    process.stdin.on('end', () => resolve(input));
    process.stdin.resume();
  });
}

export function loadHookInput(raw) {
  let input;
  try {
    input = raw.trim() ? JSON.parse(raw) : { arguments: process.argv.slice(2).join(' ') };
  } catch {
    input = { arguments: raw };
  }

  if (input.transcript_path && fs.existsSync(input.transcript_path)) {
    try {
      input.transcriptText = fs.readFileSync(input.transcript_path, 'utf8');
    } catch (error) {
      input.transcriptReadError = error.message;
    }
  }
  input.rawEvent = raw;
  return input;
}

export function persistReport(report, env = process.env) {
  const dataDir = env.CLAUDE_PLUGIN_DATA;
  if (!dataDir) return null;
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'last-verification.json');
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const raw = await readStdin();
  const input = loadHookInput(raw);
  const report = buildVerificationReport(input);
  const reportFile = persistReport(report);
  console.log(JSON.stringify({ ...report, reportFile }, null, 2));
  process.exit(report.ok || report.requiresHumanInput ? 0 : 1);
}
