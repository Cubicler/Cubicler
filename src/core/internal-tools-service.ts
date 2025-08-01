import { JSONObject, JSONValue } from '../cubicler.js';
import { MCPCompatible } from '../interface/mcp-compatible.js';
import { ToolsListProviding } from '../interface/tools-list-providing.js';
import { ServersProviding } from '../interface/servers-providing.js';
import { AvailableServersResponse, ServerToolsResponse, ToolDefinition } from '../model/tools.js';
import { toSnakeCase } from '../utils/parameter-helper.js';

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
    const availableTools = this.getToolsDefinitions();
    return availableTools.some((tool) => tool.name === toolName);
  }

  /**
   * Get all internal Cubicler functions (private - used internally)
   */
  private getToolsDefinitions(): ToolDefinition[] {
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
   * Implementation of cubicler_availableServers
   * Get information about available servers managed by Cubicler
   */
  private async availableServers(): Promise<AvailableServersResponse> {
    try {
      const servers: {
        identifier: string;
        name: string;
        description: string;
        toolsCount: number;
      }[] = [];

      if (!this.serversProvider) {
        throw new Error('Servers provider not set. Cannot resolve server identifiers.');
      }

      // Get server information from each provider service
      for (const service of this.toolsProviders) {
        try {
          const tools = await service.toolsList();

          // For each tool, extract server information using server index
          const serverTools = new Map<string, number>();
          for (const tool of tools) {
            // Extract server identifier from indexed format (s0_, s1_, etc.)
            const parts = tool.name.split('_');
            if (parts.length >= 2 && parts[0] && parts[0].startsWith('s')) {
              const indexStr = parts[0].slice(1); // Remove 's' prefix
              const index = parseInt(indexStr, 10);
              if (!isNaN(index)) {
                // Get the original server identifier for this index
                const originalIdentifier = await this.serversProvider.getServerIdentifier(index);
                if (originalIdentifier) {
                  serverTools.set(originalIdentifier, (serverTools.get(originalIdentifier) || 0) + 1);
                }
              }
            }
          }

          // Add server info using snake_case identifiers
          for (const [identifier, toolsCount] of serverTools.entries()) {
            const snakeCaseIdentifier = toSnakeCase(identifier);
            servers.push({
              identifier: snakeCaseIdentifier,
              name: identifier.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()),
              description: `${service.identifier} server: ${identifier}`,
              toolsCount,
            });
          }
        } catch (error) {
          console.warn(
            `⚠️ [InternalToolsService] Failed to get tools from service ${service.identifier}:`,
            error
          );
        }
      }

      console.log(`✅ [InternalToolsService] Found ${servers.length} servers`);

      return {
        total: servers.length,
        servers,
      };
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
    if (!serverIdentifier || typeof serverIdentifier !== 'string') {
      throw new Error('serverIdentifier parameter is required and must be a string');
    }

    try {
      // Check if it's internal tools
      if (serverIdentifier === 'cubicler') {
        return {
          tools: this.getToolsDefinitions(),
        };
      }

      if (!this.serversProvider) {
        throw new Error('Servers provider not set. Cannot resolve server identifiers.');
      }

      // Find the server index for the given identifier (which comes in as snake_case)
      let targetServerIndex: number | null = null;
      for (let i = 0; i < 100; i++) { // Reasonable upper limit
        const identifier = await this.serversProvider.getServerIdentifier(i);
        if (identifier === null) break; // No more servers
        
        // Convert the original identifier to snake_case for comparison
        const snakeCaseIdentifier = toSnakeCase(identifier);
        if (snakeCaseIdentifier === serverIdentifier) {
          targetServerIndex = i;
          break;
        }
      }

      if (targetServerIndex === null) {
        throw new Error(`Server not found: ${serverIdentifier}`);
      }

      // Search through all provider services for tools from the specified server index
      for (const service of this.toolsProviders) {
        try {
          const tools = await service.toolsList();
          
          // Check if any tools from this provider match the requested server index
          const matchingTools = tools.filter(tool => {
            const parts = tool.name.split('_');
            if (parts.length >= 2 && parts[0] && parts[0].startsWith('s')) {
              const indexStr = parts[0].slice(1); // Remove 's' prefix
              const index = parseInt(indexStr, 10);
              return !isNaN(index) && index === targetServerIndex;
            }
            return false;
          });
          
          if (matchingTools.length > 0) {
            return { tools: matchingTools };
          }
        } catch (error) {
          console.warn(
            `⚠️ [InternalToolsService] Failed to get tools from service ${service.identifier}:`,
            error
          );
          // Continue to next provider instead of throwing immediately
        }
      }

      throw new Error(`Server not found: ${serverIdentifier}`);
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
}

import providerMcpService from './provider-mcp-service.js';
import providerRestService from './provider-rest-service.js';
import providerService from './provider-service.js';

// Create the internal tools service instance with providers
const internalToolsServiceInstance = new InternalToolsService([providerMcpService, providerRestService]);

// Set up the servers provider dependency
internalToolsServiceInstance.setServersProvider(providerService);

// Export default instance for backward compatibility
export default internalToolsServiceInstance;
