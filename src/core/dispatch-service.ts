import type { MCPHandling } from '../interface/mcp-handling.js';
import { AgentsProviding } from '../interface/agents-providing.js';
import type { DispatchHandling } from '../interface/dispatch-handling.js';
import type { AgentConfig, AgentInfo } from '../model/agents.js';
import type { AgentServerInfo, AvailableServersResponse } from '../model/server.js';
import type { ToolDefinition } from '../model/tools.js';
import {
  AgentRequest,
  AgentResponse,
  DispatchRequest,
  DispatchResponse,
  Message,
  MessageSender,
} from '../model/dispatch.js';
import { AgentTransportFactory } from '../factory/agent-transport-factory.js';
import type { AgentTransport } from '../interface/agent-transport.js';
import { filterAllowedServers, filterAllowedTools } from '../utils/restriction-helper.js';
import type { ServersProviding } from '../interface/servers-providing.js';
import { SseAgentTransport } from '../transport/agent/sse-agent-transport.js';
import sseAgentService from './sse-agent-service.js';
import { withInvocationContext } from '../utils/prompt-context.js';

/**
 * Dispatch Service for Cubicler
 * Handles message dispatching to agents with enhanced message format
 * Uses dependency injection for MCP service and agent provider
 */
export class DispatchService implements DispatchHandling {
  private readonly transportFactory: AgentTransportFactory;
  private readonly transportCache = new Map<
    string,
    { transport: AgentTransport; configHash: string }
  >();

  /**
   * Creates a new DispatchService instance
   * @param mcpService - MCP service for handling tools and servers
   * @param agentProvider - Agent provider for agent operations
   */
  constructor(
    // eslint-disable-next-line no-unused-vars
    private readonly mcpService: MCPHandling,
    // eslint-disable-next-line no-unused-vars
    private readonly agentProvider: AgentsProviding,
    // eslint-disable-next-line no-unused-vars
    private readonly serversProvider: ServersProviding
  ) {
    this.transportFactory = new AgentTransportFactory(this.mcpService, this.serversProvider);
    console.log(`🔧 [DispatchService] Created with MCP service and agent provider`);
  }

  /**
   * Dispatch messages to an agent
   * @param agentId - Optional agent identifier. If not provided, uses default agent
   * @param request - Dispatch request with messages
   * @returns Agent response in DispatchResponse format
   */
  async dispatch(agentId: string | undefined, request: DispatchRequest): Promise<DispatchResponse> {
    console.log(`📨 [DispatchService] Dispatching to agent: ${agentId || 'default'}`);

    let agentInfo: AgentInfo | undefined;
    try {
      this.validateDispatchRequest(request);

      // If no specific agent is provided, check that only one agent is configured
      if (!agentId) {
        const agentCount = await this.agentProvider.getAgentCount();
        if (agentCount > 1) {
          throw new Error(
            'Multiple agents configured. Please specify an agent ID using /dispatch/:agentId endpoint'
          );
        }
      }

      // Gather all required data for the agent request
      const agentData = await this.gatherAgentData(agentId);
      const [agentInfoData, agent, prompt, serversInfo, cubiclerTools] = agentData;
      agentInfo = agentInfoData;

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

      console.log(`🚀 [DispatchService] Calling agent ${agentInfo.name} via ${agent.transport}`);

      const response = await this.callAgent(agentInfo.identifier, agent, agentRequest);
      return await this.handleAgentResponse(response, sender, agentInfo.name);
    } catch (error) {
      console.error(`❌ [DispatchService] Agent dispatch failed:`, error);

      // Re-throw "Agent not found" errors so the server can return 404
      if (error instanceof Error && error.message.includes('Agent not found')) {
        throw error;
      }

      // Re-throw validation errors since they occur before we have agent info
      if (error instanceof Error && error.message.includes('Messages array is required')) {
        throw error;
      }

      // Re-throw multiple agents configuration error
      if (error instanceof Error && error.message.includes('Multiple agents configured')) {
        throw error;
      }

      // Create a fallback sender for other error types (agent call failures, transport errors, etc.)
      // Use agent info if available, otherwise fall back to original agentId
      const fallbackId = agentInfo?.identifier || agentId || 'unknown';
      const fallbackName = agentInfo?.name || agentId || 'Unknown Agent';
      const fallbackSender = { id: fallbackId, name: fallbackName };
      return this.createErrorResponse(fallbackSender, error);
    }
  }

  /**
   * Validate dispatch request
   * @param request - Dispatch request to validate
   * @throws Error if request is invalid
   */
  private validateDispatchRequest(request: DispatchRequest): void {
    if (!request) {
      throw new Error('Invalid JSON in request body');
    }

    if (!request.messages) {
      throw new Error('Messages array is required');
    }

    if (!Array.isArray(request.messages) || request.messages.length === 0) {
      throw new Error('Messages array is required and must not be empty');
    }

    // Validate message format
    for (let i = 0; i < request.messages.length; i++) {
      const message = request.messages[i];
      if (!message || !message.sender || !message.type || !message.content) {
        throw new Error(
          `Invalid message format: missing required fields (sender, type, content) at index ${i}`
        );
      }
    }
  }

  /**
   * Call the agent with the prepared request using appropriate transport
   * @param agent - Agent configuration containing transport type
   * @param agentRequest - Prepared agent request
   * @returns Agent response
   */
  private async callAgent(
    agentId: string,
    agent: AgentConfig,
    agentRequest: AgentRequest
  ): Promise<AgentResponse> {
    const transport = await this.getOrCreateTransport(agentId, agent);

    // Register SSE transports with the SSE agent service for connection management
    if (transport instanceof SseAgentTransport) {
      sseAgentService.registerAgent(agentId, transport);
    }

    return await transport.dispatch(agentRequest);
  }

  /**
   * Get existing transport or create new one if configuration changed
   * @param agentId - Agent identifier
   * @param agent - Agent configuration
   * @returns Agent transport (cached or newly created)
   */
  private async getOrCreateTransport(agentId: string, agent: AgentConfig): Promise<AgentTransport> {
    const configHash = this.generateConfigHash(agent);
    const cached = this.transportCache.get(agentId);

    // Return cached transport if configuration hasn't changed
    if (cached && cached.configHash === configHash) {
      return cached.transport;
    }

    // Clean up old transport if it exists
    if (cached) {
      console.log(
        `🔄 [DispatchService] Agent config changed for ${agentId}, cleaning up old transport`
      );
      await this.cleanupTransport(cached.transport);
    }

    // Create new transport
    console.log(`🆕 [DispatchService] Creating new transport for agent ${agentId}`);
    const transport = this.transportFactory.createTransport(agentId, agent);

    // Cache the new transport
    this.transportCache.set(agentId, { transport, configHash });

    return transport;
  }

  /**
   * Generate a hash of agent configuration to detect changes
   * @param agent - Agent configuration
   * @returns Configuration hash string
   */
  private generateConfigHash(agent: AgentConfig): string {
    // Create a simple hash of the relevant configuration properties
    const configString = JSON.stringify({
      transport: agent.transport,
      command: 'command' in agent ? agent.command : undefined,
      args: 'args' in agent ? agent.args : undefined,
      env: 'env' in agent ? agent.env : undefined,
      cwd: 'cwd' in agent ? agent.cwd : undefined,
      url: 'url' in agent ? agent.url : undefined,
      provider: 'provider' in agent ? agent.provider : undefined,
      model: 'model' in agent ? agent.model : undefined,
      temperature: 'temperature' in agent ? agent.temperature : undefined,
      maxTokens: 'maxTokens' in agent ? agent.maxTokens : undefined,
      pooling: 'pooling' in agent ? agent.pooling : undefined,
    });

    // Simple hash function (could use crypto.createHash for production)
    let hash = 0;
    for (let i = 0; i < configString.length; i++) {
      const char = configString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(36);
  }

  /**
   * Clean up a transport instance
   * @param transport - Transport to clean up
   */
  private async cleanupTransport(transport: AgentTransport): Promise<void> {
    try {
      // Check if transport has a cleanup/destroy method
      if ('destroy' in transport && typeof transport.destroy === 'function') {
        await transport.destroy();
      } else if ('cleanup' in transport && typeof transport.cleanup === 'function') {
        await (transport as { cleanup(): Promise<void> }).cleanup();
      }
    } catch (error) {
      console.warn(`⚠️ [DispatchService] Error cleaning up transport:`, error);
    }
  }

  /**
   * Clear all cached transports (useful for testing or configuration reloads)
   */
  public async clearTransportCache(): Promise<void> {
    console.log(
      `🧹 [DispatchService] Clearing transport cache (${this.transportCache.size} transports)`
    );

    const cleanupPromises: Promise<void>[] = [];

    for (const [agentId, cached] of this.transportCache.entries()) {
      console.log(`🧹 [DispatchService] Cleaning up transport for agent ${agentId}`);
      cleanupPromises.push(this.cleanupTransport(cached.transport));
    }

    // Wait for all cleanup operations to complete
    await Promise.all(cleanupPromises);

    // Clear the cache
    this.transportCache.clear();

    console.log(`✅ [DispatchService] Transport cache cleared successfully`);
  }

  /**
   * Gather all agent-related data in parallel for optimal performance
   */
  private async gatherAgentData(
    agentId: string | undefined
  ): Promise<[AgentInfo, AgentConfig, string, AgentServerInfo[], ToolDefinition[]]> {
    // First check agent existence to fail fast and avoid unnecessary MCP calls
    const [agentInfo, agent, prompt] = await Promise.all([
      this.agentProvider.getAgentInfo(agentId),
      this.agentProvider.getAgent(agentId),
      this.agentProvider.getAgentPrompt(agentId),
    ]);

    // Only make MCP calls if agent exists
    const [serversInfo, allTools] = await Promise.all([
      // Inline servers info retrieval via MCP service
      this.mcpService
        .handleMCPRequest({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: 'cubicler_available_servers',
            arguments: {},
          },
        })
        .then((response) => {
          if (response.error) {
            throw new Error(`MCP Error: ${response.error.message}`);
          }
          const result = response.result as AvailableServersResponse;
          return result.servers || [];
        }),
      // Tools list retrieval via MCP service
      this.mcpService
        .handleMCPRequest({
          jsonrpc: '2.0',
          id: Date.now() + 1,
          method: 'tools/list',
          params: {},
        })
        .then((response) => {
          if (response.error) {
            throw new Error(`MCP Error: ${response.error.message}`);
          }
          const result = response.result as { tools: ToolDefinition[] };
          return result.tools || [];
        }),
    ]);

    // Apply agent restrictions
    const filteredServers = filterAllowedServers(agent, serversInfo);
    const filteredTools = await filterAllowedTools(agent, allTools, this.serversProvider);

    return [agentInfo, agent, prompt, filteredServers, filteredTools];
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
    // Augment prompt with invocation context (message dispatch)
    const contextualPrompt = withInvocationContext(prompt, { type: 'message' });

    return {
      agent: {
        identifier: agentInfo.identifier,
        name: agentInfo.name,
        description: agentInfo.description,
        prompt: contextualPrompt,
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
    agentResponse: AgentResponse,
    sender: MessageSender,
    agentName: string
  ): Promise<DispatchResponse> {
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

  /**
   * Dispatch a webhook trigger to a specific agent
   * @param agentId - The agent identifier
   * @param agentRequest - Complete agent request with webhook trigger context
   * @returns Promise resolving to dispatch response
   */
  async dispatchWebhook(agentId: string, agentRequest: AgentRequest): Promise<DispatchResponse> {
    console.log(`🪝 [DispatchService] Dispatching webhook to agent: ${agentId}`);

    try {
      // Get agent configuration
      const agent = await this.agentProvider.getAgent(agentId);
      const agentInfo = await this.agentProvider.getAgentInfo(agentId);

      // Create sender object for response
      const sender = { id: agentInfo.identifier, name: agentInfo.name };

      console.log(`🚀 [DispatchService] Calling agent ${agentInfo.name} via ${agent.transport}`);

      const response = await this.callAgent(agentId, agent, agentRequest);
      return await this.handleAgentResponse(response, sender, agentInfo.name);
    } catch (error) {
      console.error(`❌ [DispatchService] Webhook dispatch failed:`, error);

      // Re-throw "Agent not found" errors so the server can return 404
      if (error instanceof Error && error.message.includes('Agent not found')) {
        throw error;
      }

      // Create a fallback sender for other error types (validation, agent call failures, etc.)
      const fallbackSender = { id: agentId, name: agentId };
      return this.createErrorResponse(fallbackSender, error);
    }
  }
}

import mcpService from './mcp-service.js';
import agentService from './agent-service.js';
import providerService from './provider-service.js';

// Export the class for dependency injection
export default new DispatchService(mcpService, agentService, providerService);
