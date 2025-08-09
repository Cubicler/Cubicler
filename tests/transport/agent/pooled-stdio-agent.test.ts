import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PooledStdioAgent } from '../../../src/transport/agent/pooled-stdio-agent.js';
import type { StdioAgentConfig } from '../../../src/model/agents.js';
import type { AgentRequest } from '../../../src/model/dispatch.js';
import path from 'path';

const echoScript = path.resolve(__dirname, '../../mocks/stdio-echo-agent.js');

const baseConfig: StdioAgentConfig = {
  transport: 'stdio',
  name: 'Test Agent',
  description: 'Echo',
  command: process.execPath, // node
  args: [echoScript],
};

const baseRequest: AgentRequest = {
  agent: {
    identifier: 'test',
    name: 'Test Agent',
    description: 'Echo',
    prompt: 'n/a',
  },
  servers: [],
  tools: [],
  messages: [
    {
      sender: { id: 'user', name: 'user' },
      timestamp: new Date().toISOString(),
      type: 'text',
      content: 'hello',
    },
  ],
};

describe('PooledStdioAgent', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('enforces single in-flight dispatch (busy error)', async () => {
    const onIdle = vi.fn();
    const agent = new PooledStdioAgent(baseConfig, undefined, {
      isPrimary: false,
      maxIdleTime: 1000,
      onIdleTimeout: onIdle,
    });

    const p1 = agent.dispatch(baseRequest);
    await expect(agent.dispatch(baseRequest)).rejects.toThrow(/busy/i);
    const res = await p1;
    expect(res.metadata).toBeDefined();
    agent.destroy();
  });

  it('calls onIdleTimeout after idle period for pooled worker', async () => {
    const onIdle = vi.fn();
    const agent = new PooledStdioAgent(baseConfig, undefined, {
      isPrimary: false,
      maxIdleTime: 20,
      onIdleTimeout: onIdle,
    });

    const res = await agent.dispatch(baseRequest);
    expect(res.metadata).toBeDefined();

    // wait beyond idle threshold (real timers)
    await new Promise((r) => setTimeout(r, 30));
    expect(onIdle).toHaveBeenCalledTimes(1);
    agent.destroy();
  });
});
