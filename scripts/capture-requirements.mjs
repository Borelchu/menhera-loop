#!/usr/bin/env node
import { loadState, saveState } from './state.mjs';
import { detectLanguageFromText, messagesForLanguage, resolveMessageLanguage } from './menhera-ui.mjs';

export function requirementsFromPrompt(prompt) {
  const text = String(prompt || '').trim();
  if (!text || text.startsWith('/')) return [];
  const picked = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (/^- \[[ xX]\]|^[-*] |^\d+[.)] /.test(trimmed)) {
      picked.push(trimmed.replace(/^- \[[ xX]\]\s*|^[-*]\s*|^\d+[.)]\s*/, '').slice(0, 160));
    }
  }
  if (picked.length > 0) return picked.filter(Boolean);
  return isCapturablePrompt(text) ? [text.replace(/\s+/g, ' ').slice(0, 160)] : [];
}

function isCapturablePrompt(text) {
  if (!text || text.startsWith('/')) return false;
  if (Buffer.byteLength(text, 'utf8') < 20) return false;
  if (/[?？]\s*$/.test(text)) return false;
  if (/^(?:고마워|감사|ㅇㅇ|응|네|좋아|그래|thanks|thank you|ok|okay|yes|lgtm|good|nice|了解|ありがとう)[.!。！\s]*$/i.test(text)) return false;
  return true;
}

export function isImplementationPrompt(prompt) {
  const text = String(prompt || '').trim();
  if (!text || text.startsWith('/')) return false;
  if (isQuestionOnlyPrompt(text)) return false;
  return /고쳐|수정|구현|추가|만들|작성|바꿔|해줘|완성|fix|implement|add|create|build|write|change|update|complete|修正|直して|実装|追加|作って|書いて|変更|更新/.test(text);
}

function isQuestionOnlyPrompt(text) {
  if (/[?？]\s*$/.test(text)) return true;
  return /^(?:what|why|how|explain|describe|tell me|can you explain|이게|이건|왜|뭐|무엇|어떻게|설명|알려|これは|なに|何|なぜ|どう|説明)/i.test(text);
}

export function preflightContractForPrompt(prompt, state = {}, env = process.env) {
  if (!isImplementationPrompt(prompt) || state.preflightContractShown) return null;
  const language = resolveMessageLanguage({ state, texts: [prompt], env });
  return messagesForLanguage(language).preflightContractMessage;
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


if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const raw = await readStdin();
    let input = {};
    try {
      input = raw.trim() ? JSON.parse(raw) : {};
    } catch {
      process.exit(0);
    }
    const sessionId = input.session_id || 'unknown';
    const captured = requirementsFromPrompt(input.prompt);
    const state = loadState(sessionId);
    const preflightContract = preflightContractForPrompt(input.prompt, state);
    const nextState = { ...state };
    if (captured.length > 0) {
      nextState.requirements = [...new Set([...state.requirements, ...captured])].slice(-50);
      nextState.language = detectLanguageFromText(input.prompt, state.language || process.env.MENHERA_LOOP_LANG || 'ko');
    }
    if (preflightContract) nextState.preflightContractShown = true;
    if (captured.length > 0 || preflightContract) {
      saveState(sessionId, nextState);
    }
    if (preflightContract) {
      // UserPromptSubmit context injection must be nested under
      // hookSpecificOutput; a bare top-level additionalContext is ignored.
      console.log(JSON.stringify({
        hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: preflightContract }
      }));
    }
    process.exit(0);
  } catch (error) {
    failOpen(error);
  }
}
