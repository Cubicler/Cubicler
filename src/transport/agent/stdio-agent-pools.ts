import type { AgentTransport } from '../../interface/agent-transport.js';
import type { AgentRequest, AgentResponse } from '../../model/dispatch.js';
import type { MCPHandling } from '../../interface/mcp-handling.js';
import type { StdioAgentConfig } from '../../model/agents.js';
import { PooledStdioAgent } from './pooled-stdio-agent.js';
import { clearTimeout, setTimeout } from 'node:timers';

export class AgentPoolSaturatedError extends Error {
  constructor(message = 'Agent pool at max capacity and queue is full or timed out') {
    super(message);
    this.name = 'AgentPoolSaturatedError';
  }
}

interface Waiter {
  resolve: (_agent: PooledStdioAgent) => void;
  reject: (_err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * StdioAgentPools implements AgentTransport and manages multiple stdio transports.
 * - One in-flight dispatch per transport.
 * - Round-robin selection for idle transports.
 * - Scales up to maxPoolSize; beyond that, requests join a FIFO queue with timeout.
 */
export class StdioAgentPools implements AgentTransport {
  private readonly config: StdioAgentConfig;
  private readonly mcpService: MCPHandling | undefined;

  private readonly primary: PooledStdioAgent;
  private readonly pool: PooledStdioAgent[] = [];
  private rrCursor = 0; // round-robin index across [primary, ...pool]

  private readonly maxIdleTime: number;
  private readonly maxPoolSize: number; // includes primary

  // Simple reservation set to prevent races where two callers get same idle transport
  private readonly reserved = new Set<PooledStdioAgent>();

  // FIFO wait queue when saturated
  private readonly waiters: Waiter[] = [];
  private readonly queueTimeoutMs: number;
  private readonly queueMaxSize: number;

  constructor(config: StdioAgentConfig, mcpService?: MCPHandling) {
    this.config = config;
    this.mcpService = mcpService;

    // Defaults
    const pooling = config.pooling || { enabled: false };
    this.maxIdleTime = pooling.maxIdleTime ?? 300_000;
    this.maxPoolSize = Math.max(1, pooling.maxPoolSize ?? 4); // includes primary
    this.queueTimeoutMs = pooling.queueTimeoutMs ?? 30_000;
    this.queueMaxSize = pooling.queueMaxSize ?? 100;

    // Create primary (never idles out)
    this.primary = new PooledStdioAgent(this.config, this.mcpService, {
      isPrimary: true,
      maxIdleTime: 0,
      onIdleTimeout: () => {
        /* primary never times out */
      },
    });
  }

  /**
   * Dispatch via an available transport (RR + scale + queue).
   */
  async dispatch(agentRequest: AgentRequest): Promise<AgentResponse> {
    const transport = await this.getTransportOrQueue();
    try {
      const result = await transport.dispatch(agentRequest);
      return result;
    } finally {
      // Unreserve and attempt to satisfy queued waiters
      this.reserved.delete(transport);
      this.satisfyOneWaiter();
    }
  }

  /**
   * Destroy the pool and all transports.
   */
  destroy(): void {
    try {
      // Reject waiters
      while (this.waiters.length) {
        const w = this.waiters.shift();
        if (w) {
          clearTimeout(w.timeout);
          w.reject(new Error('Agent pool destroyed'));
        }
      }
      // Destroy pooled workers
      for (const t of this.pool) {
        try {
          t.destroy();
        } catch {
          // Ignore destroy errors during cleanup
        }
      }
      // Destroy primary last
      this.primary.destroy();
      this.pool.length = 0;
      this.reserved.clear();
    } catch (err) {
      console.warn('[StdioAgentPools] Destroy error:', err);
    }
  }

  /**
   * Remove a pooled transport on idle-timeout.
   */
  removeTransport(transport: PooledStdioAgent): void {
    const idx = this.pool.indexOf(transport);
    if (idx >= 0) {
      this.pool.splice(idx, 1);
    }
    this.reserved.delete(transport);
    try {
      transport.destroy();
    } catch {
      // Ignore destroy errors during cleanup
    }
    // Try to satisfy any waiting requests now that overall load changed
    this.satisfyOneWaiter();
  }

  /**
   * Get current pool status for monitoring.
   */
  getPoolStatus() {
    return {
      totalTransports: this.totalTransports(),
      busyTransports: this.countBusy(),
      idleTransports: this.totalTransports() - this.countBusy(),
      queuedRequests: this.waiters.length,
      reservedTransports: this.reserved.size,
      primaryBusy: this.primary.isBusy(),
      config: {
        maxPoolSize: this.maxPoolSize,
        maxIdleTime: this.maxIdleTime,
        queueTimeoutMs: this.queueTimeoutMs,
        queueMaxSize: this.queueMaxSize,
      },
    };
  }

  /**
   * Attempt to acquire an idle transport immediately; else scale or queue.
   */
  private async getTransportOrQueue(): Promise<PooledStdioAgent> {
    const immediate = this.tryAcquireImmediate();
    if (immediate) return immediate;

    // Scale up if possible
    if (this.totalTransports() < this.maxPoolSize) {
      const t = this.createPooledWorker();
      this.reserve(t);
      return t;
    }

    // Queue if saturated
    return await this.enqueueWaiter();
  }

  private tryAcquireImmediate(): PooledStdioAgent | null {
    // Build the list [primary, ...pool]
    const all: PooledStdioAgent[] = [this.primary, ...this.pool];
    const n = all.length;
    if (n === 0) return null;

    for (let i = 0; i < n; i++) {
      const idx = (this.rrCursor + i) % n;
      const t = all[idx];
      if (!t) continue;
      if (!t.isBusy() && !this.reserved.has(t)) {
        // advance rrCursor and reserve
        this.rrCursor = (idx + 1) % n;
        this.reserve(t);
        return t;
      }
    }
    return null;
  }

  private reserve(t: PooledStdioAgent): void {
    this.reserved.add(t);
  }

  private createPooledWorker(): PooledStdioAgent {
    const worker = new PooledStdioAgent(this.config, this.mcpService, {
      isPrimary: false,
      maxIdleTime: this.maxIdleTime,
      onIdleTimeout: (agent) => this.removeTransport(agent),
    });
    this.pool.push(worker);
    return worker;
  }

  private totalTransports(): number {
    return 1 + this.pool.length; // primary + pooled
  }

  private countBusy(): number {
    let busy = this.primary.isBusy() ? 1 : 0;
    for (const t of this.pool) {
      if (t.isBusy()) busy++;
    }
    return busy;
  }

  private enqueueWaiter(): Promise<PooledStdioAgent> {
    if (this.waiters.length >= this.queueMaxSize) {
      throw new AgentPoolSaturatedError('Agent pool at max capacity and queue full');
    }

    return new Promise<PooledStdioAgent>((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Remove this waiter if still queued
        const idx = this.waiters.findIndex((w) => w.resolve === resolve);
        if (idx >= 0) this.waiters.splice(idx, 1);
        reject(new AgentPoolSaturatedError('Queue wait timeout'));
      }, this.queueTimeoutMs);

      this.waiters.push({ resolve, reject, timeout });
    });
  }

  private satisfyOneWaiter(): void {
    if (this.waiters.length === 0) return;
    const acquired = this.tryAcquireImmediate();
    if (acquired === null) return;

    const waiter = this.waiters.shift();
    if (!waiter) return;

    clearTimeout(waiter.timeout);
    try {
      waiter.resolve(acquired);
    } catch {
      // If waiter resolve throws, unreserve and try next waiter
      this.reserved.delete(acquired);
      this.satisfyOneWaiter();
    }
  }
}
