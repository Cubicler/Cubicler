import type { Response } from 'express';
import type { AgentResponse } from '../model/dispatch.js';
import type { SseAgentTransport } from '../transport/agent/sse-agent-transport.js';

/**
 * Service for managing SSE agent connections
 * Handles agent registration, connection management, and response routing
 */
export class SseAgentService {
  private readonly connectedAgents = new Map<string, SseAgentTransport>();

  /**
   * Register an SSE agent transport for connection management
   * @param agentId - Unique identifier for the agent
   * @param transport - SSE agent transport instance
   */
  registerAgent(agentId: string, transport: SseAgentTransport): void {
    this.connectedAgents.set(agentId, transport);
    console.log(`🔄 [SseAgentService] Registered SSE transport for agent ${agentId}`);
  }

  /**
   * Handle agent connection via SSE
   * @param agentId - Unique identifier for the agent
   * @param response - Express response object for SSE connection
   * @returns Whether the connection was successful
   */
  handleAgentConnection(agentId: string, response: Response): boolean {
    const transport = this.connectedAgents.get(agentId);

    if (!transport) {
      console.warn(`⚠️ [SseAgentService] No transport registered for agent ${agentId}`);
      return false;
    }

    transport.registerAgentConnection(response);
    return true;
  }

  /**
   * Handle response from agent
   * @param agentId - Unique identifier for the agent
   * @param requestId - ID of the original request
   * @param response - Agent response
   * @returns Whether the response was handled
   */
  handleAgentResponse(agentId: string, requestId: string, response: AgentResponse): boolean {
    const transport = this.connectedAgents.get(agentId);

    if (!transport) {
      console.warn(`⚠️ [SseAgentService] No transport registered for agent ${agentId}`);
      return false;
    }

    transport.handleAgentResponse(requestId, response);
    return true;
  }

  /**
   * Check if agent is connected via SSE
   * @param agentId - Unique identifier for the agent
   * @returns Whether the agent is connected
   */
  isAgentConnected(agentId: string): boolean {
    const transport = this.connectedAgents.get(agentId);
    return transport ? transport.isAgentConnected() : false;
  }

  /**
   * Disconnect agent and clean up resources
   * @param agentId - Unique identifier for the agent
   */
  disconnectAgent(agentId: string): void {
    const transport = this.connectedAgents.get(agentId);

    if (transport) {
      transport.disconnect();
      this.connectedAgents.delete(agentId);
      console.log(`🔄 [SseAgentService] Disconnected agent ${agentId}`);
    }
  }

  /**
   * Get list of connected agent IDs
   * @returns Array of connected agent identifiers
   */
  getConnectedAgentIds(): string[] {
    const connectedIds: string[] = [];

    for (const [agentId, transport] of this.connectedAgents.entries()) {
      if (transport.isAgentConnected()) {
        connectedIds.push(agentId);
      }
    }

    return connectedIds;
  }

  /**
   * Disconnect all agents and clean up resources
   */
  disconnectAllAgents(): void {
    for (const [agentId, transport] of this.connectedAgents.entries()) {
      transport.disconnect();
      console.log(`🔄 [SseAgentService] Disconnected agent ${agentId}`);
    }

    this.connectedAgents.clear();
    console.log(`🔄 [SseAgentService] All agents disconnected`);
  }
}

// Export default instance for singleton usage
export default new SseAgentService();
