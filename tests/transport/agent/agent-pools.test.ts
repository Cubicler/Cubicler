import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StdioAgentPools } from '../../../src/transport/agent/stdio-agent-pools.js';
import type { StdioAgentConfig } from '../../../src/model/agents.js';
import type { AgentRequest } from '../../../src/model/dispatch.js';
import path from 'path';

const echoScript = path.resolve(__dirname, '../../mocks/stdio-echo-agent.js');
const delayScript = path.resolve(__dirname, '../../mocks/stdio-delay-agent.js');

const makeConfig = (overrides?: Partial<StdioAgentConfig>): StdioAgentConfig => ({
  transport: 'stdio',
  name: 'Test Agent',
  description: 'Echo',
  command: process.execPath,
  args: [echoScript],
  pooling: { enabled: true, maxPoolSize: 2, maxIdleTime: 200 },
  ...overrides,
});

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

describe('StdioAgentPools', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('scales to a pooled worker under concurrent load', async () => {
    const pool = new StdioAgentPools(makeConfig());
    const p1 = pool.dispatch(baseRequest);
    const p2 = pool.dispatch(baseRequest);

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.metadata).toBeDefined();
    expect(r2.metadata).toBeDefined();
    // Expect two different PIDs when two concurrent requests are processed (metadata extended by mock agent)
    const pid1 = (r1.metadata as any).pid;
    const pid2 = (r2.metadata as any).pid;
    expect(pid1).not.toEqual(pid2);
    pool.destroy();
  });

  it('queues when saturated and reuses the same process sequentially', async () => {
    // maxPoolSize = 1 forces queue for the second concurrent request
    const pool = new StdioAgentPools(
      makeConfig({ pooling: { enabled: true, maxPoolSize: 1, maxIdleTime: 500 } })
    );
    const p1 = pool.dispatch(baseRequest);
    const p2 = pool.dispatch(baseRequest); // should queue and run after p1 completes

    const r1 = await p1;
    const r2 = await p2;
    const pid1 = (r1.metadata as any).pid;
    const pid2 = (r2.metadata as any).pid;
    expect(pid1).toEqual(pid2); // same process reused sequentially
    pool.destroy();
  });

  it('throws AgentPoolSaturatedError when queue is full', async () => {
    const pool = new StdioAgentPools(
      makeConfig({ pooling: { enabled: true, maxPoolSize: 1, maxIdleTime: 500 } })
    );
    // Occupy the only worker
    const p1 = pool.dispatch(baseRequest);
    // Force queue size to 0 so enqueue fails immediately
    (pool as any).queueMaxSize = 0;
    await expect(pool.dispatch(baseRequest)).rejects.toThrow(/Agent pool at max capacity/);
    await p1;
    pool.destroy();
  });

  it('rejects queued request on queue timeout', async () => {
    // Use a delayed agent to keep the first dispatch busy
    const pool = new StdioAgentPools(
      makeConfig({
        command: process.execPath,
        args: [delayScript],
        pooling: { enabled: true, maxPoolSize: 1, maxIdleTime: 500 },
      })
    );
    const p1 = pool.dispatch(baseRequest);
    // Set a short queue timeout
    (pool as any).queueTimeoutMs = 20;
    await expect(pool.dispatch(baseRequest)).rejects.toThrow(/Queue wait timeout/);
    await p1;
    pool.destroy();
  });

  it('removes pooled worker after idle timeout', async () => {
    const pool = new StdioAgentPools(
      makeConfig({ pooling: { enabled: true, maxPoolSize: 2, maxIdleTime: 20 } })
    );
    // Create a pooled worker by concurrent dispatches
    const r1 = pool.dispatch(baseRequest);
    const r2 = pool.dispatch(baseRequest);
    await Promise.all([r1, r2]);
    // Now both idle; wait beyond idle timeout
    await new Promise((r) => setTimeout(r, 40));
    // Expect pooled list to be empty (only primary remains)
    const pooledLen = ((pool as any).pool as unknown[]).length;
    expect(pooledLen).toBe(0);
    pool.destroy();
  });
});
