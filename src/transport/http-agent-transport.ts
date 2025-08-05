import type { AgentTransport } from '../interface/agent-transport.js';
import type { AgentRequest, AgentResponse } from '../model/dispatch.js';
import { fetchWithAgentTimeout } from '../utils/fetch-helper.js';

/**
 * HTTP transport implementation for agent communication
 * Handles HTTP-based communication with agents
 */
export class HttpAgentTransport implements AgentTransport {
  /**
   * Creates a new HttpAgentTransport instance
   * @param url - The HTTP URL endpoint for the agent
   */
  constructor(private readonly url: string) {
    if (!url || typeof url !== 'string') {
      throw new Error('Agent URL must be a non-empty string');
    }
  }

  /**
   * Call the agent via HTTP POST request
   * @param agentRequest - The request to send to the agent
   * @returns Promise that resolves to the agent's response
   * @throws Error if the HTTP request fails or returns invalid response
   */
  async dispatch(agentRequest: AgentRequest): Promise<AgentResponse> {
    console.log(`🚀 [HttpAgentTransport] Calling agent at ${this.url}`);

    try {
      const response = await fetchWithAgentTimeout(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: agentRequest,
      });

      this.validateHttpResponse(response);
      this.validateAgentResponse(response.data);

      console.log(`✅ [HttpAgentTransport] Agent responded successfully`);
      return response.data;
    } catch (error) {
      console.error(`❌ [HttpAgentTransport] Agent call failed:`, error);
      throw error;
    }
  }

  /**
   * Validate HTTP response status
   * @param response - HTTP response from agent
   * @throws Error if status indicates failure
   */
  private validateHttpResponse(response: { status: number; statusText?: string }): void {
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `Agent responded with status ${response.status}: ${response.statusText || 'Unknown error'}`
      );
    }
  }

  /**
   * Validate agent response format
   * @param agentResponse - Agent response to validate
   * @throws Error if response format is invalid
   */
  private validateAgentResponse(agentResponse: AgentResponse): void {
    if (
      !agentResponse.timestamp ||
      !agentResponse.type ||
      agentResponse.content === undefined ||
      !agentResponse.metadata
    ) {
      throw new Error(
        'Invalid agent response format: missing required fields (timestamp, type, content, metadata)'
      );
    }
  }
}
