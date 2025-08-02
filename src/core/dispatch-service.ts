import type { ServersProviding } from '../interface/servers-providing.js';
import { fetchWithAgentTimeout } from '../utils/fetch-helper.js';
import { AgentsProviding } from '../interface/agents-providing.js';
import { ToolsListProviding } from '../interface/tools-list-providing.js';
import type { AgentInfo } from '../model/agents.js';
import type { AgentServerInfo } from '../model/server.js';
import type { ToolDefinition } from '../model/tools.js';
import {
  AgentRequest,
  AgentResponse,
  DispatchRequest,
  DispatchResponse,
  Message,
  MessageSender,
} from '../model/dispatch.js';

/**
 * Dispatch Service for Cubicler
 * Handles message dispatching to agents with enhanced message format
 * Uses dependency injection for both tools list provider and agent provider
 */
export class DispatchService {
  /**
   * Creates a new DispatchService instance
   * @param toolsProvider - Tools list provider for Cubicler internal tools
   * @param agentProvider - Agent provider for agent operations
   * @param serverProvider - Servers list provider for server information
   */
  constructor(
    // eslint-disable-next-line no-unused-vars
    private readonly toolsProvider: ToolsListProviding,
    // eslint-disable-next-line no-unused-vars
    private readonly agentProvider: AgentsProviding,
    // eslint-disable-next-line no-unused-vars
    private readonly serverProvider: ServersProviding
  ) {
    console.log(
      `🔧 [DispatchService] Created with tools list provider, agent provider, and servers provider`
    );
  }

  /**
   * Dispatch messages to an agent
   * @param agentId - Optional agent identifier. If not provided, uses default agent
   * @param request - Dispatch request with messages
   * @returns Agent response in DispatchResponse format
   */
  async dispatch(agentId: string | undefined, request: DispatchRequest): Promise<DispatchResponse> {
    console.log(`📨 [DispatchService] Dispatching to agent: ${agentId || 'default'}`);

    this.validateDispatchRequest(request);

    // Gather all required data for the agent request
    const [agentInfo, agentUrl, prompt, serversInfo, cubiclerTools] =
      await this.gatherAgentData(agentId);

    // Create sender object once for reuse
    const sender = { id: agentInfo.identifier, name: agentInfo.name };

    // Prepare and send request to agent
    const agentRequest = this.buildAgentRequest(
      agentInfo,
      prompt,
      serversInfo,
      cubiclerTools,
      request.messages
    );

    console.log(`🚀 [DispatchService] Calling agent ${agentInfo.name} at ${agentUrl}`);

    try {
      const response = await this.callAgent(agentUrl, agentRequest);
      return await this.handleAgentResponse(response, sender, agentInfo.name);
    } catch (error) {
      console.error(`❌ [DispatchService] Agent call failed:`, error);
      return this.createErrorResponse(sender, error);
    }
  }

  /**
   * Validate dispatch request
   * @param request - Dispatch request to validate
   * @throws Error if request is invalid
   */
  private validateDispatchRequest(request: DispatchRequest): void {
    if (!request.messages || !Array.isArray(request.messages) || request.messages.length === 0) {
      throw new Error('Messages array is required and must not be empty');
    }
  }

  /**
   * Call the agent with the prepared request
   * @param agentUrl - Agent URL endpoint
   * @param agentRequest - Prepared agent request
   * @returns Agent response
   */
  private async callAgent(
    agentUrl: string,
    agentRequest: AgentRequest
  ): Promise<{ data: AgentResponse; status: number; statusText?: string }> {
    return await fetchWithAgentTimeout(agentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: agentRequest,
    });
  }

  /**
   * Gather all agent-related data in parallel for optimal performance
   */
  private async gatherAgentData(agentId: string | undefined) {
    return Promise.all([
      this.agentProvider.getAgentInfo(agentId),
      this.agentProvider.getAgentUrl(agentId),
      this.agentProvider.getAgentPrompt(agentId),
      // Inline servers info retrieval
      this.serverProvider.getAvailableServers().then((serversInfo) =>
        serversInfo.servers.map((server) => ({
          identifier: server.identifier,
          name: server.name,
          description: server.description,
        }))
      ),
      this.toolsProvider.toolsList(),
    ]);
  }

  /**
   * Build the agent request payload according to specification
   */
  private buildAgentRequest(
    agentInfo: AgentInfo,
    prompt: string,
    serversInfo: AgentServerInfo[],
    cubiclerTools: ToolDefinition[],
    messages: Message[]
  ): AgentRequest {
    return {
      agent: {
        identifier: agentInfo.identifier,
        name: agentInfo.name,
        description: agentInfo.description,
        prompt,
      },
      tools: cubiclerTools,
      servers: serversInfo,
      messages, // Pass messages as-is without enhancement
    };
  }

  /**
   * Handle the agent response, validate it, and convert to dispatch response format
   */
  private async handleAgentResponse(
    response: { data: AgentResponse; status: number; statusText?: string },
    sender: MessageSender,
    agentName: string
  ): Promise<DispatchResponse> {
    this.validateAgentResponseStatus(response);

    const agentResponse: AgentResponse = response.data;
    this.validateAgentResponseFormat(agentResponse);

    console.log(`✅ [DispatchService] Agent ${agentName} responded successfully`);

    return {
      sender,
      timestamp: agentResponse.timestamp,
      type: agentResponse.type,
      content: agentResponse.content,
      metadata: agentResponse.metadata,
    };
  }

  /**
   * Validate agent response HTTP status
   * @param response - HTTP response from agent
   * @throws Error if status indicates failure
   */
  private validateAgentResponseStatus(response: { status: number; statusText?: string }): void {
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
  private validateAgentResponseFormat(agentResponse: AgentResponse): void {
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

  /**
   * Create error response in proper dispatch format
   */
  private createErrorResponse(sender: MessageSender, error: unknown): DispatchResponse {
    return {
      sender,
      timestamp: new Date().toISOString(),
      type: 'text',
      content: `Sorry, I encountered an error while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      metadata: {
        usedToken: 0,
        usedTools: 0,
      },
    };
  }
}

import internalToolsService from './internal-tools-service.js';
import agentService from './agent-service.js';
import providerService from './provider-service.js';

// Export the class for dependency injection
export default new DispatchService(internalToolsService, agentService, providerService);
