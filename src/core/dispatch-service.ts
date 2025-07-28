import type { ServersProviding } from '../interface/servers-providing.js';
import { fetchWithAgentTimeout } from '../utils/fetch-helper.js';
import { AgentsProviding } from '../interface/agents-providing.js';
import { ToolsListProviding } from '../interface/tools-list-providing.js';
import {
  AgentRequest,
  AgentResponse,
  DispatchRequest,
  DispatchResponse,
} from '../model/dispatch.js';

/**
 * Dispatch Service for Cubicler
 * Handles message dispatching to agents with enhanced message format
 * Uses dependency injection for both tools list provider and agent provider
 */
export class DispatchService {
  private toolsProvider: ToolsListProviding;
  private agentProvider: AgentsProviding;
  private serverProvider: ServersProviding;

  /**
   * Creates a new DispatchService instance
   * @param toolsProvider - Tools list provider for Cubicler internal tools
   * @param agentProvider - Agent provider for agent operations
   * @param serverProvider - Servers list provider for server information
   */
  constructor(
    toolsProvider: ToolsListProviding,
    agentProvider: AgentsProviding,
    serverProvider: ServersProviding
  ) {
    this.toolsProvider = toolsProvider;
    this.agentProvider = agentProvider;
    this.serverProvider = serverProvider;
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

    // Basic validation
    if (!request.messages || !Array.isArray(request.messages) || request.messages.length === 0) {
      throw new Error('Messages array is required and must not be empty');
    }

    // Get agent information
    const agentInfo = await this.agentProvider.getAgentInfo(agentId);
    const agentUrl = await this.agentProvider.getAgentUrl(agentId);

    // Compose prompt for the agent
    const prompt = await this.agentProvider.getAgentPrompt(agentId);

    // Get servers information for the agent
    const serversInfo = await this.getServersInfo();

    // Get Cubicler internal tools
    const cubiclerTools = await this.toolsProvider.toolsList();

    // Prepare agent request payload according to new specification
    const agentRequest: AgentRequest = {
      agent: {
        identifier: agentInfo.identifier,
        name: agentInfo.name,
        description: agentInfo.description,
        prompt,
      },
      tools: cubiclerTools,
      servers: serversInfo,
      messages: request.messages, // Pass messages as-is without enhancement
    };

    console.log(`🚀 [DispatchService] Calling agent ${agentInfo.name} at ${agentUrl}`);

    try {
      // Call the agent
      const response = await fetchWithAgentTimeout(agentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        data: agentRequest,
      });

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Agent responded with status ${response.status}: ${response.statusText}`);
      }

      // Parse agent response
      const agentResponse: AgentResponse = response.data;

      // Validate agent response format
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

      // Create dispatch response using agent's data
      const dispatchResponse: DispatchResponse = {
        sender: {
          id: agentInfo.identifier,
          name: agentInfo.name,
        },
        timestamp: agentResponse.timestamp,
        type: agentResponse.type,
        content: agentResponse.content,
        metadata: agentResponse.metadata,
      };

      console.log(`✅ [DispatchService] Agent ${agentInfo.name} responded successfully`);
      return dispatchResponse;
    } catch (error) {
      console.error(`❌ [DispatchService] Agent call failed:`, error);

      // Return error response in proper format
      return {
        sender: {
          id: agentInfo.identifier,
          name: agentInfo.name,
        },
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

  /**
   * Get servers information for agents
   * Returns simplified server info for agent context
   */
  private async getServersInfo(): Promise<
    Array<{ identifier: string; name: string; description: string }>
  > {
    const serversInfo = await this.serverProvider.getAvailableServers();
    return serversInfo.servers.map((server) => ({
      identifier: server.identifier,
      name: server.name,
      description: server.description,
    }));
  }
}

import internalToolsService from './internal-tools-service.js';
import agentService from './agent-service.js';
import providerService from './provider-service.js';

// Export the class for dependency injection
export default new DispatchService(internalToolsService, agentService, providerService);
