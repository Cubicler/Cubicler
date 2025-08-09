#!/usr/bin/env node
// ESM stdio JSON-RPC agent that delays the response to simulate long-running work
import readline from 'node:readline';
import { stdin, stdout, pid } from 'node:process';
import { setTimeout } from 'node:timers';

const rl = readline.createInterface({ input: stdin, crlfDelay: Infinity });

const delayMs = 200; // fixed delay for test timing

rl.on('line', async (line) => {
  const text = line.trim();
  if (!text) return;
  let msg;
  try {
    msg = JSON.parse(text);
  } catch {
    return;
  }
  if (msg && msg.jsonrpc === '2.0' && msg.method === 'dispatch') {
    setTimeout(() => {
      const response = {
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          timestamp: new Date().toISOString(),
          type: 'text',
          content: 'ok-delay',
          metadata: { usedToken: 0, usedTools: 0, pid },
        },
      };
      stdout.write(JSON.stringify(response) + '\n');
    }, delayMs);
  }
});

