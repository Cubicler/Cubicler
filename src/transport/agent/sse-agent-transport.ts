import type { AgentTransport } from '../../interface/agent-transport.js';
import type { AgentRequest, AgentResponse } from '../../model/dispatch.js';
import type { SseTransportConfig } from '../../model/agents.js';
import { Response } from 'express';

/**
 * SSE transport implementation for agent communication
 * Cubicler acts as SSE server, agents connect to receive requests
 */
export class SseAgentTransport implements AgentTransport {
  private readonly agentId: string;
  private connectedAgent: Response | null = null;
  private readonly pendingRequests = new Map<
    string,
    {
      resolve: (_response: AgentResponse) => void;
      reject: (_error: Error) => void;
      timeout: ReturnType<typeof globalThis.setTimeout>;
    }
  >();
  private readonly requestTimeout = 300000; // 5 minutes timeout for agent responses

  /**
   * Creates a new SseAgentTransport instance
   * @param _config - SSE transport configuration (unused - agents connect to Cubicler)
   * @param agentId - Unique identifier for this agent
   */
  constructor(
    private readonly _config: SseTransportConfig,
    agentId: string
  ) {
    // No URL validation needed - SSE agents connect TO Cubicler
    this.agentId = agentId;
  }

  /**
   * Dispatch request to agent via SSE
   * @param agentRequest - The request to send to the agent
   * @returns Promise that resolves to the agent's response
   * @throws Error if no agent is connected or request fails
   */
  async dispatch(agentRequest: AgentRequest): Promise<AgentResponse> {
    if (!this.connectedAgent) {
      throw new Error(`No agent connected for ${this.agentId}`);
    }

    console.log(`🚀 [SseAgentTransport] Dispatching request to agent ${this.agentId}`);

    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();

      // Set up timeout
      const timeout = globalThis.setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(
          new Error(
            `Agent ${this.agentId} request ${requestId} timed out after ${this.requestTimeout}ms`
          )
        );
      }, this.requestTimeout);

      // Store pending request
      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // Send request to agent via SSE
      try {
        const sseData = {
          id: requestId,
          type: 'agent_request',
          data: agentRequest,
        };

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Safe: checked above
        this.connectedAgent!.write(`id: ${requestId}\n`);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Safe: checked above
        this.connectedAgent!.write(`event: agent_request\n`);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Safe: checked above
        this.connectedAgent!.write(`data: ${JSON.stringify(sseData)}\n\n`);

        console.log(`📡 [SseAgentTransport] Request ${requestId} sent to agent ${this.agentId}`);
      } catch (error) {
        globalThis.clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(
          new Error(
            `Failed to send request to agent ${this.agentId}: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
      }
    });
  }

  /**
   * Register agent connection for SSE
   * @param response - Express response object for SSE connection
   */
  registerAgentConnection(response: Response): void {
    console.log(`✅ [SseAgentTransport] Agent ${this.agentId} connected via SSE`);

    // Set up SSE headers
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Send initial connection message
    response.write(`event: connected\n`);
    response.write(`data: {"message": "Connected to Cubicler", "agentId": "${this.agentId}"}\n\n`);

    this.connectedAgent = response;

    // Handle connection close
    response.on('close', () => {
      console.log(`🔄 [SseAgentTransport] Agent ${this.agentId} disconnected`);
      this.connectedAgent = null;

      // Reject all pending requests
      for (const [_requestId, pending] of this.pendingRequests.entries()) {
        globalThis.clearTimeout(pending.timeout);
        pending.reject(new Error(`Agent ${this.agentId} disconnected`));
      }
      this.pendingRequests.clear();
    });
  }

  /**
   * Handle response from agent
   * @param requestId - ID of the original request
   * @param response - Agent response
   */
  handleAgentResponse(requestId: string, response: AgentResponse): void {
    const pending = this.pendingRequests.get(requestId);

    if (pending) {
      globalThis.clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);

      console.log(
        `✅ [SseAgentTransport] Received response from agent ${this.agentId} for request ${requestId}`
      );
      pending.resolve(response);
    } else {
      console.warn(
        `⚠️ [SseAgentTransport] Received response for unknown request ${requestId} from agent ${this.agentId}`
      );
    }
  }

  /**
   * Check if agent is connected
   */
  isAgentConnected(): boolean {
    return this.connectedAgent !== null && !this.connectedAgent.destroyed;
  }

  /**
   * Get agent ID
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Disconnect agent and clean up resources
   */
  disconnect(): void {
    if (this.connectedAgent && !this.connectedAgent.destroyed) {
      this.connectedAgent.end();
    }
    this.connectedAgent = null;

    // Reject all pending requests
    for (const [, pending] of this.pendingRequests.entries()) {
      globalThis.clearTimeout(pending.timeout);
      pending.reject(new Error(`Agent ${this.agentId} transport disconnected`));
    }
    this.pendingRequests.clear();

    console.log(`🔄 [SseAgentTransport] Agent ${this.agentId} transport disconnected`);
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${this.agentId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
