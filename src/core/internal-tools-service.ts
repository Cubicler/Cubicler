import { JSONObject, JSONValue } from '../cubicler.js';
import { MCPCompatible } from '../interface/mcp-compatible.js';
import { ToolsListProviding } from '../interface/tools-list-providing.js';
import { ToolDefinition, AvailableServersResponse, ServerToolsResponse } from '../model/tools.js';

/**
 * Internal Functions Service for Cubicler
 * Provides cubicler.* functions available to agents
 */
class InternalToolsService implements MCPCompatible {
  readonly identifier = 'cubicler';
  private toolsProviders: ToolsListProviding[] = [];

  constructor(toolsProviders: ToolsListProviding[] = []) {
    this.toolsProviders = toolsProviders;
  }

  /**
   * Initialize the internal tools service
   */
  async initialize(): Promise<void> {
    console.log('🔄 [InternalToolsService] Initializing internal tools service...');
    // Internal tools don't need initialization
    console.log('✅ [InternalToolsService] Internal tools service initialized');
  }

  /**
   * Get list of tools this service provides (MCPCompatible)
   */
  async toolsList(): Promise<ToolDefinition[]> {
    return [
      {
        name: 'cubicler.available_servers',
        description: 'Get information about available servers managed by Cubicler',
        parameters: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'cubicler.fetch_server_tools',
        description: 'Get tools from one particular server managed by Cubicler',
        parameters: {
          type: 'object',
          properties: {
            serverIdentifier: {
              type: 'string',
              description: 'Identifier of the server to fetch tools from'
            }
          },
          required: ['serverIdentifier']
        }
      }
    ];
  }

  /**
   * Execute a tool call (MCPCompatible)
   */
  async toolsCall(toolName: string, parameters: JSONObject): Promise<JSONValue> {
    console.log(`⚙️ [InternalToolsService] Executing internal tool: ${toolName}`);
    
    switch (toolName) {
      case 'cubicler.available_servers':
        return await this.availableServers();
      
      case 'cubicler.fetch_server_tools':
        const serverIdentifier = parameters.serverIdentifier as string;
        if (!serverIdentifier) {
          throw new Error('Missing required parameter: serverIdentifier');
        }
        return await this.fetchServerTools(serverIdentifier);
      
      default:
        throw new Error(`Unknown internal tool: ${toolName}`);
    }
  }

  /**
   * Check if this service can handle the given tool name
   */
  async canHandleRequest(toolName: string): Promise<boolean> {
    const availableTools = this.getToolsDefinitions();
    return availableTools.some(tool => tool.name === toolName);
  }

  /**
   * Get all internal Cubicler functions (private - used internally)
   */
  private getToolsDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'cubicler.available_servers',
        description: 'Get information about available servers managed by Cubicler',
        parameters: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'cubicler.fetch_server_tools',
        description: 'Get tools from one particular server managed by Cubicler',
        parameters: {
          type: 'object',
          properties: {
            serverIdentifier: {
              type: 'string',
              description: 'Identifier of the server to fetch tools from'
            }
          },
          required: ['serverIdentifier']
        }
      }
    ];
  }

  /**
   * Implementation of cubicler.available_servers
   * Get information about available servers managed by Cubicler
   */
  private async availableServers(): Promise<AvailableServersResponse> {
    try {
      const servers: { identifier: string; name: string; description: string; toolsCount: number }[] = [];
      
      // Get server information from each provider service
      for (const service of this.toolsProviders) {
        try {
          const tools = await service.toolsList();
          
          // For each tool, extract server information
          const serverTools = new Map<string, number>();
          for (const tool of tools) {
            const serverIdentifier = tool.name.split('.')[0];
            if (serverIdentifier) {
              serverTools.set(serverIdentifier, (serverTools.get(serverIdentifier) || 0) + 1);
            }
          }
          
          // Add server info (we'll need to enhance this to get proper name/description)
          for (const [identifier, toolsCount] of serverTools.entries()) {
            servers.push({
              identifier,
              name: identifier.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              description: `${service.identifier} server: ${identifier}`,
              toolsCount
            });
          }
        } catch (error) {
          console.warn(`⚠️ [InternalToolsService] Failed to get tools from service ${service.identifier}:`, error);
        }
      }

      console.log(`✅ [InternalToolsService] Found ${servers.length} servers`);
      
      return {
        total: servers.length,
        servers
      };
    } catch (error) {
      console.error(`❌ [InternalToolsService] Error getting available servers:`, error);
      throw new Error(`Failed to get available servers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Implementation of cubicler.fetch_server_tools
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
          tools: this.getToolsDefinitions()
        };
      }

      // Search through all provider services for tools from the specified server
      for (const service of this.toolsProviders) {
        try {
          const tools = await service.toolsList();
          const serverTools = tools.filter(tool => tool.name.startsWith(`${serverIdentifier}.`));
          
          if (serverTools.length > 0) {
            return { tools: serverTools };
          }
        } catch (error) {
          console.warn(`⚠️ [InternalToolsService] Failed to get tools from service ${service.identifier}:`, error);
        }
      }

      throw new Error(`Server not found: ${serverIdentifier}`);
    } catch (error) {
      console.error(`❌ [InternalToolsService] Error getting tools for server ${serverIdentifier}:`, error);
      throw new Error(`Failed to get tools for server ${serverIdentifier}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

import providerMcpService from './provider-mcp-service.js';
import providerRestService from './provider-rest-service.js';
// Export the class for dependency injection
export default new InternalToolsService([providerMcpService, providerRestService]);
