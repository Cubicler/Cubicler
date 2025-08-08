import type { AgentTransport } from '../../interface/agent-transport.js';
import type { AgentRequest, AgentResponse } from '../../model/dispatch.js';
import type { DirectAgentConfig } from '../../model/agents.js';
import type { MCPHandling } from '../../interface/mcp-handling.js';
import type { ServersProviding } from '../../interface/servers-providing.js';
import type {
  AgentClient,
  AgentServer,
  JSONObject,
  JSONValue,
  RequestHandler,
} from '@cubicler/cubicagentkit';
import { validateToolAccess } from '../../utils/restriction-helper.js';

/**
 * Direct transport implementation for agent communication
 * Implements both AgentClient and AgentServer interfaces for in-process execution
 * Creates a fresh agent instance for each dispatch call
 */
export abstract class DirectAgentTransport implements AgentTransport, AgentClient, AgentServer {
  /**
   * Creates a new DirectAgentTransport instance
   * @param config - The direct transport configuration
   * @param mcpService - MCP service for handling tools and servers
   * @param agent - Agent configuration for restriction validation
   */
  constructor(
    // eslint-disable-next-line no-unused-vars
    protected readonly config: DirectAgentConfig,
    // eslint-disable-next-line no-unused-vars
    protected readonly mcpService: MCPHandling,
    // eslint-disable-next-line no-unused-vars
    protected readonly agent: DirectAgentConfig & { identifier: string },
    // eslint-disable-next-line no-unused-vars
    protected readonly serversProvider: ServersProviding
  ) {
    // Validation should be handled by subclasses
  }

  // ===== AgentTransport Implementation =====

  /**
   * Call the agent directly using the provider's service
   * Creates a fresh agent instance for each call to ensure complete isolation
   * @param agentRequest - The request to send to the agent
   * @returns Promise that resolves to the agent's response
   * @throws Error if the agent call fails
   */
  abstract dispatch(_agentRequest: AgentRequest): Promise<AgentResponse>;

  // ===== AgentClient Implementation =====

  /**
   * Initialize the client by initializing the MCP service
   */
  async initialize(): Promise<void> {
    console.log(`🔄 [DirectAgentTransport] Initializing MCP service...`);
    await this.mcpService.initialize();
    console.log(`✅ [DirectAgentTransport] Client initialized successfully`);
  }

  /**
   * Call a tool directly through Cubicler's MCP service
   * @param toolName - Tool name to call
   * @param parameters - Tool arguments as JSONObject
   * @returns Tool execution result as JSONValue
   */
  async callTool(toolName: string, parameters: JSONObject): Promise<JSONValue> {
    console.log(`🛠️ [DirectAgentTransport] Calling tool: ${toolName} with args:`, parameters);

    try {
      // Validate tool access based on agent restrictions
      await validateToolAccess(this.agent, toolName, this.serversProvider);

      // Create MCP request for tool call - same pattern as /mcp endpoint
      const mcpRequest = {
        jsonrpc: '2.0' as const,
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: parameters,
        },
      };

      // Let MCPService handle both internal and external tools
      const mcpResponse = await this.mcpService.handleMCPRequest(mcpRequest);

      if (mcpResponse.error) {
        throw new Error(`MCP Error: ${mcpResponse.error.message}`);
      }

      return mcpResponse.result as JSONValue;
    } catch (error) {
      console.error(`❌ [DirectAgentTransport] Tool call failed for ${toolName}:`, error);
      throw error;
    }
  }

  // ===== AgentServer Implementation =====

  /**
   * Start the server with the provided request handler
   * Direct agents don't need an actual server since they run in-process
   * @param _handler - The request handler function
   */
  async start(_handler: RequestHandler): Promise<void> {
    console.log(`✅ [DirectAgentTransport] Server started (no-op for direct transport)`);
  }

  /**
   * Stop the server (no-op for direct transport)
   */
  async stop(): Promise<void> {
    console.log(`✅ [DirectAgentTransport] Server stopped (no-op for direct transport)`);
  }
}
