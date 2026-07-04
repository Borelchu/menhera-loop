#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const dataDir = process.env.CLAUDE_PLUGIN_DATA || path.join(process.cwd(), '.menhera-loop');
const eventsFile = path.join(dataDir, 'events.jsonl');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  input += chunk;
});
process.stdin.on('end', () => {
  fs.mkdirSync(dataDir, { recursive: true });
  let event = {};
  try {
    event = input.trim() ? JSON.parse(input) : {};
  } catch (error) {
    event = { parseError: error.message };
  }
  const record = {
    at: new Date().toISOString(),
    event: event.hook_event_name || event.event || 'unknown',
    tool: event.tool_name || event.tool || null,
    status: event.error || event.parseError ? 'failed' : 'ok'
  };
  fs.appendFileSync(eventsFile, `${JSON.stringify(record)}\n`);
  console.log('방금 뭘 했는지 기억해뒀어.');
});
process.stdin.resume();
