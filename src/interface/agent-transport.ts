import type { AgentRequest, AgentResponse } from '../model/dispatch.js';

/**
 * Agent transport interface for different communication methods
 * Abstracts the communication layer between Cubicler and agents
 */
export interface AgentTransport {
  /**
   * Call the agent with the provided request
   * @param agentRequest - The request to send to the agent
   * @returns Promise that resolves to the agent's response
   * @throws Error if the agent call fails
   */
  dispatch(_agentRequest: AgentRequest): Promise<AgentResponse>;
}
