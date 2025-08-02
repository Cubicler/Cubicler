import { JSONObject, JSONValue } from '../cubicler.js';
import { MCPCompatible } from '../interface/mcp-compatible.js';
import { ToolsListProviding } from '../interface/tools-list-providing.js';
import { ServersProviding } from '../interface/servers-providing.js';
import { AvailableServersResponse } from '../model/server.js';
import { ServerToolsResponse, ToolDefinition } from '../model/tools.js';

/**
 * Internal Functions Service for Cubicler
 * Provides cubicler.* functions available to agents
 */
export class InternalToolsService implements MCPCompatible {
  readonly identifier = 'cubicler';
  private toolsProviders: ToolsListProviding[] = [];
  private serversProvider: ServersProviding | null = null;

  /**
   * Creates a new InternalToolsService instance
   * @param toolsProviders - Array of tools list providers to aggregate tools from
   */
  constructor(toolsProviders: ToolsListProviding[] = []) {
    this.toolsProviders = toolsProviders;
  }

  /**
   * Set the servers provider for server identifier mapping
   * @param serversProvider - The servers provider instance
   */
  setServersProvider(serversProvider: ServersProviding): void {
    this.serversProvider = serversProvider;
  }

  /**
   * Initialize the internal tools service
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    console.log('🔄 [InternalToolsService] Initializing internal tools service...');
    // Internal tools don't need initialization
    console.log('✅ [InternalToolsService] Internal tools service initialized');
  }

  /**
   * Get list of tools this service provides (MCPCompatible)
   * @returns Array of tool definitions for internal Cubicler functions
   */
  async toolsList(): Promise<ToolDefinition[]> {
    return [
      {
        name: 'cubicler_available_servers',
        description: 'Get information about available servers managed by Cubicler',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'cubicler_fetch_server_tools',
        description: 'Get tools from one particular server managed by Cubicler',
        parameters: {
          type: 'object',
          properties: {
            serverIdentifier: {
              type: 'string',
              description: 'Identifier of the server to fetch tools from',
            },
          },
          required: ['serverIdentifier'],
        },
      },
    ];
  }

  /**
   * Execute a tool call (MCPCompatible)
   * @param toolName - Name of the tool to execute
   * @param parameters - Parameters to pass to the tool
   * @returns Result of the tool execution
   * @throws Error if tool is unknown or execution fails
   */
  async toolsCall(toolName: string, parameters: JSONObject): Promise<JSONValue> {
    console.log(`⚙️ [InternalToolsService] Executing internal tool: ${toolName}`);

    switch (toolName) {
      case 'cubicler_available_servers':
        return await this.availableServers();

      case 'cubicler_fetch_server_tools': {
        const serverIdentifier = parameters.serverIdentifier as string;
        if (!serverIdentifier) {
          throw new Error('Missing required parameter: serverIdentifier');
        }
        return await this.fetchServerTools(serverIdentifier);
      }

      default:
        throw new Error(`Unknown internal tool: ${toolName}`);
    }
  }

  /**
   * Check if this service can handle the given tool name
   * @param toolName - Name of the tool to check
   * @returns true if this service can handle the tool, false otherwise
   */
  async canHandleRequest(toolName: string): Promise<boolean> {
    const availableTools = await this.toolsList();
    return availableTools.some((tool) => tool.name === toolName);
  }

  /**
   * Implementation of cubicler_available_servers
   * Get information about available servers managed by Cubicler
   */
  private async availableServers(): Promise<AvailableServersResponse> {
    try {
      if (!this.serversProvider) {
        throw new Error('Servers provider not set. Cannot resolve server identifiers.');
      }

      // Get server information directly from the servers provider
      // This returns all configured servers regardless of initialization status
      const result = await this.serversProvider.getAvailableServers();

      console.log(`✅ [InternalToolsService] Found ${result.total} servers`);

      return result;
    } catch (error) {
      console.error(`❌ [InternalToolsService] Error getting available servers:`, error);
      throw new Error(
        `Failed to get available servers: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Implementation of cubicler_fetch_server_tools
   * Get tools from a specific server managed by Cubicler
   */
  private async fetchServerTools(serverIdentifier: string): Promise<ServerToolsResponse> {
    this.validateServerIdentifier(serverIdentifier);

    try {
      // Handle internal tools separately
      if (serverIdentifier === 'cubicler') {
        return { tools: await this.toolsList() };
      }

      if (!this.serversProvider) {
        throw new Error('Servers provider not set. Cannot get server tools.');
      }

      const serverHash = await this.getServerHash(serverIdentifier);
      const matchingTools = await this.findToolsByServerHash(serverHash);

      console.log(
        `✅ [InternalToolsService] Found ${matchingTools.length} tools for server: ${serverIdentifier}`
      );
      return { tools: matchingTools };
    } catch (error) {
      console.error(
        `❌ [InternalToolsService] Error getting tools for server ${serverIdentifier}:`,
        error
      );
      throw new Error(
        `Failed to get tools for server ${serverIdentifier}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate server identifier parameter
   * @param serverIdentifier - Server identifier to validate
   * @throws Error if invalid
   */
  private validateServerIdentifier(serverIdentifier: string): void {
    if (!serverIdentifier || typeof serverIdentifier !== 'string') {
      throw new Error('serverIdentifier parameter is required and must be a string');
    }
  }

  /**
   * Get server hash from servers provider
   * @param serverIdentifier - Server identifier
   * @returns Server hash
   * @throws Error if server not found
   */
  private async getServerHash(serverIdentifier: string): Promise<string> {
    const serverHash = await this.serversProvider?.getServerHash(serverIdentifier);
    if (!serverHash) {
      throw new Error(`Server not found: ${serverIdentifier}`);
    }
    return serverHash;
  }

  /**
   * Find tools matching the server hash prefix
   * @param serverHash - Hash prefix to match
   * @returns Array of matching tools
   */
  private async findToolsByServerHash(serverHash: string): Promise<ToolDefinition[]> {
    const targetPrefix = `${serverHash}_`;
    const matchingTools: ToolDefinition[] = [];

    for (const service of this.toolsProviders) {
      try {
        const tools = await service.toolsList();
        const serviceMachingTools = this.filterToolsByPrefix(tools, targetPrefix);
        matchingTools.push(...serviceMachingTools);
      } catch (error) {
        console.warn(
          `⚠️ [InternalToolsService] Failed to get tools from service ${service.identifier}:`,
          error
        );
        // Continue to next provider instead of throwing immediately
      }
    }

    return matchingTools;
  }

  /**
   * Filter tools by prefix and normalize format
   * @param tools - Tools to filter
   * @param prefix - Prefix to match
   * @returns Filtered and normalized tools
   */
  private filterToolsByPrefix(tools: ToolDefinition[], prefix: string): ToolDefinition[] {
    return tools
      .filter((tool) => tool.name.startsWith(prefix))
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters || tool.inputSchema,
      }));
  }
}

import providerMcpService from './provider-mcp-service.js';
import providerRestService from './provider-rest-service.js';
import providerService from './provider-service.js';

// Create the internal tools service instance with providers
const internalToolsServiceInstance = new InternalToolsService([
  providerMcpService,
  providerRestService,
]);

// Set up the servers provider dependency
internalToolsServiceInstance.setServersProvider(providerService);

// Export default instance for backward compatibility
export default internalToolsServiceInstance;
