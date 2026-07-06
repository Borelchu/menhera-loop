#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from './state.mjs';

function readEvents(env = process.env) {
  const file = path.join(dataDir(env), 'gate-events.jsonl');
  try {
    return fs.readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function summarizeGateEvents(events) {
  const totals = { pass: 0, block: 0, gave_up: 0 };
  const gateCounts = {};
  const bySession = new Map();

  for (const event of events) {
    if (Object.prototype.hasOwnProperty.call(totals, event.outcome)) totals[event.outcome] += 1;
    for (const gate of event.missingEvidence || []) gateCounts[gate] = (gateCounts[gate] || 0) + 1;
    for (const gate of event.failedChecks || []) gateCounts[gate] = (gateCounts[gate] || 0) + 1;
    if (event.sessionId) {
      const list = bySession.get(event.sessionId) || [];
      list.push(event.outcome);
      bySession.set(event.sessionId, list);
    }
  }

  let blockedSessions = 0;
  let blockToPassSessions = 0;
  let gaveUpSessions = 0;
  for (const outcomes of bySession.values()) {
    if (!outcomes.includes('block')) continue;
    blockedSessions += 1;
    const firstBlock = outcomes.indexOf('block');
    if (outcomes.slice(firstBlock + 1).includes('pass')) blockToPassSessions += 1;
    if (outcomes.slice(firstBlock + 1).includes('gave_up')) gaveUpSessions += 1;
  }

  return {
    events: events.length,
    totals,
    gateCounts,
    sessions: {
      blocked: blockedSessions,
      blockToPass: blockToPassSessions,
      gaveUp: gaveUpSessions,
      blockToPassRate: blockedSessions ? blockToPassSessions / blockedSessions : null,
      gaveUpRate: blockedSessions ? gaveUpSessions / blockedSessions : null
    }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(summarizeGateEvents(readEvents()), null, 2));
}
