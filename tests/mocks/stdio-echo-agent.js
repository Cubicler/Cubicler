#!/usr/bin/env node
// Simple stdio JSON-RPC echo agent for tests (ESM)
// Reads line-delimited JSON, responds to 'dispatch' with a minimal AgentResponse

import readline from 'node:readline';
import { stdin, stdout, pid } from 'node:process';

const rl = readline.createInterface({
  input: stdin,
  crlfDelay: Infinity,
});

rl.on('line', async (line) => {
  const text = line.trim();
  if (!text) return;
  let msg;
  try {
    msg = JSON.parse(text);
  } catch {
    return; // ignore non-JSON
  }

  if (msg && msg.jsonrpc === '2.0' && msg.method === 'dispatch') {
    const response = {
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        timestamp: new Date().toISOString(),
        type: 'text',
        content: 'ok',
        metadata: { usedToken: 0, usedTools: 0, pid },
      },
    };
    stdout.write(JSON.stringify(response) + '\n');
  }
});
