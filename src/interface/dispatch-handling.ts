import type { AgentRequest, DispatchRequest, DispatchResponse } from '../model/dispatch.js';

/**
 * Interface for handling message dispatching to agents
 * Used for dependency injection in services that need to dispatch messages
 */
export interface DispatchHandling {
  /**
   * Dispatch messages to an agent
   * @param _agentId - Optional agent identifier. If not provided, uses default agent
   * @param _request - Dispatch request with messages
   * @returns Promise resolving to agent response in DispatchResponse format
   */
  dispatch(_agentId: string | undefined, _request: DispatchRequest): Promise<DispatchResponse>;

  /**
   * Dispatch a webhook trigger to a specific agent
   * @param _agentId - The agent identifier
   * @param _agentRequest - Complete agent request with webhook trigger context
   * @returns Promise resolving to dispatch response
   */
  dispatchWebhook(_agentId: string, _agentRequest: AgentRequest): Promise<DispatchResponse>;
}
