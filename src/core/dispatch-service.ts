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

    this.validateDispatchRequest(request);

    // Gather all required data for the agent request
    const agentData = await this.gatherAgentData(agentId);
    const [agentInfo, agent, prompt, serversInfo, cubiclerTools] = agentData;

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

    try {
      const response = await this.callAgent(agentInfo.identifier, agent, agentRequest);
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
    const transport = this.transportFactory.createTransport(agentId, agent);

    // Register SSE transports with the SSE agent service for connection management
    if (transport instanceof SseAgentTransport) {
      sseAgentService.registerAgent(agentId, transport);
    }

    return await transport.dispatch(agentRequest);
  }

  /**
   * Gather all agent-related data in parallel for optimal performance
   */
  private async gatherAgentData(
    agentId: string | undefined
  ): Promise<[AgentInfo, AgentConfig, string, AgentServerInfo[], ToolDefinition[]]> {
    const [agentInfo, agent, prompt, serversInfo, allTools] = await Promise.all([
      this.agentProvider.getAgentInfo(agentId),
      this.agentProvider.getAgent(agentId),
      this.agentProvider.getAgentPrompt(agentId),
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

    // Get agent configuration
    const agent = await this.agentProvider.getAgent(agentId);
    const agentInfo = await this.agentProvider.getAgentInfo(agentId);

    // Create sender object for response
    const sender = { id: agentInfo.identifier, name: agentInfo.name };

    console.log(`🚀 [DispatchService] Calling agent ${agentInfo.name} via ${agent.transport}`);

    try {
      const response = await this.callAgent(agentId, agent, agentRequest);
      return await this.handleAgentResponse(response, sender, agentInfo.name);
    } catch (error) {
      console.error(`❌ [DispatchService] Webhook agent call failed:`, error);
      return this.createErrorResponse(sender, error);
    }
  }
}

import mcpService from './mcp-service.js';
import agentService from './agent-service.js';
import providerService from './provider-service.js';

// Export the class for dependency injection
export default new DispatchService(mcpService, agentService, providerService);
