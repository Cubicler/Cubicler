import type { AgentTransport } from '../../interface/agent-transport.js';
import type { AgentRequest, AgentResponse } from '../../model/dispatch.js';
import type { StdioAgentConfig } from '../../model/agents.js';
import type { MCPHandling } from '../../interface/mcp-handling.js';
import { StdioAgentTransport } from './stdio-agent-transport.js';
import { clearTimeout, setTimeout } from 'timers';

/**
 * Lightweight wrapper around StdioAgentTransport to enforce single in-flight dispatch
 * and manage idle timeout for pooled workers. The primary transport never idles out.
 */
export class PooledStdioAgent implements AgentTransport {
  private readonly underlying: StdioAgentTransport;
  private busy = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly maxIdleTime: number;
  private readonly isPrimary: boolean;
  private readonly onIdleTimeout: (_agent: PooledStdioAgent) => void;

  constructor(
    config: StdioAgentConfig,
    mcpService: MCPHandling | undefined,
    options: {
      isPrimary: boolean;
      maxIdleTime: number;
      onIdleTimeout: (_agent: PooledStdioAgent) => void;
    }
  ) {
    this.underlying = new StdioAgentTransport(config, mcpService);
    this.isPrimary = options.isPrimary;
    this.maxIdleTime = options.maxIdleTime;
    this.onIdleTimeout = options.onIdleTimeout;
  }

  isBusy(): boolean {
    return this.busy;
  }

  /**
   * Dispatch a request. Enforces exactly one in-flight call per process.
   */
  async dispatch(agentRequest: AgentRequest): Promise<AgentResponse> {
    if (this.busy) {
      throw new Error('PooledStdioAgent is busy');
    }

    this.stopIdleTimer();
    this.busy = true;
    try {
      const res = await this.underlying.dispatch(agentRequest);
      return res;
    } finally {
      this.busy = false;
      if (!this.isPrimary) {
        this.startIdleTimer();
      }
    }
  }

  /**
   * Start idle timer for pooled workers.
   */
  private startIdleTimer(): void {
    if (this.isPrimary) return;
    this.stopIdleTimer();
    if (this.maxIdleTime <= 0) return;
    this.idleTimer = setTimeout(() => {
      try {
        this.onIdleTimeout(this);
      } catch (err) {
        console.warn('[PooledStdioAgent] Idle timeout callback failed:', err);
      }
    }, this.maxIdleTime);
  }

  private stopIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * Destroy underlying transport and clear timers.
   */
  destroy(): void {
    this.stopIdleTimer();
    try {
      this.underlying.destroy();
    } catch (err) {
      console.warn('[PooledStdioAgent] Destroy error:', err);
    }
  }
}
