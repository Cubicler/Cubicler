import type { AgentTransport } from '../interface/agent-transport.js';
import type { AgentRequest, AgentResponse } from '../model/dispatch.js';
import type { HttpTransportConfig } from '../model/agents.js';
import { fetchWithAgentTimeout } from '../utils/fetch-helper.js';
import jwtHelper from '../utils/jwt-helper.js';

/**
 * HTTP transport implementation for agent communication
 * Handles HTTP-based communication with agents
 */
export class HttpAgentTransport implements AgentTransport {
  /**
   * Creates a new HttpAgentTransport instance
   * @param config - HTTP transport configuration
   */
  constructor(private readonly config: HttpTransportConfig) {
    if (!config?.url || typeof config.url !== 'string') {
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
    console.log(`🚀 [HttpAgentTransport] Calling agent at ${this.config.url}`);

    try {
      const headers = await this.buildHeaders();
      
      const response = await fetchWithAgentTimeout(this.config.url, {
        method: 'POST',
        headers,
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
   * Build HTTP headers including JWT authentication if configured
   * @returns Promise that resolves to headers object
   * @throws Error if JWT token cannot be obtained
   */
  private async buildHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.auth?.type === 'jwt') {
      const token = await jwtHelper.getToken(this.config.auth.config);
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
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
