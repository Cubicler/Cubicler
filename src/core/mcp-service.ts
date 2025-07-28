import type { MCPRequest, MCPResponse, JSONObject } from '../model/types.js';
import type { MCPFormattedTool, ToolDefinition } from '../model/tools.js';
import { MCPCompatible } from '../interface/mcp-compatible.js';

/**
 * MCP Service for Cubicler
 * Aggregates all MCPCompatible services and handles the MCP protocol
 * Uses dependency injection to manage multiple providers
 */
class MCPService {
  private providers: MCPCompatible[];

  /**
   * Constructor with dependency injection
   * @param providers Array of MCPCompatible services
   */
  constructor(providers: MCPCompatible[] = []) {
    this.providers = providers;
    console.log(`🔧 [MCPService] Created with ${providers.length} MCPCompatible providers`);
  }

  /**
   * Initialize all injected providers
   */
  async initialize(): Promise<void> {
    console.log('🔄 [MCPService] Initializing all providers...');
    
    try {
      for (const provider of this.providers) {
        await provider.initialize();
      }
      console.log('✅ [MCPService] All providers initialized successfully');
    } catch (error) {
      console.error('❌ [MCPService] Failed to initialize providers:', error);
      throw error;
    }
  }

  /**
   * Handle MCP request (main entry point for /mcp endpoint)
   */
  async handleMCPRequest(request: MCPRequest): Promise<MCPResponse> {
    console.log(`📡 [MCPService] Handling MCP request: ${request.method}`);

    try {
      switch (request.method) {
        case 'initialize':
          return this.handleInitialize(request);
        
        case 'tools/list':
          return await this.handleToolsList(request);
        
        case 'tools/call':
          return await this.handleToolsCall(request);
        
        default:
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601, // Method not found
              message: `Method not supported: ${request.method}. Supported methods: initialize, tools/list, tools/call`
            }
          };
      }
    } catch (error) {
      console.error(`❌ [MCPService] Error handling MCP request:`, error);
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603, // Internal error
          message: `Internal error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }

  /**
   * Handle MCP initialize request
   */
  private async handleInitialize(request: MCPRequest): Promise<MCPResponse> {
    console.log('🔄 [MCPService] Handling initialize request');
    
    // Initialize all providers when client requests initialization
    await this.initialize();
    
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {
            listChanged: true
          }
        },
        serverInfo: {
          name: 'Cubicler',
          version: '2.0'
        }
      }
    };
  }

  /**
   * Handle MCP tools/list request
   * Aggregates tools from all providers
   */
  private async handleToolsList(request: MCPRequest): Promise<MCPResponse> {
    console.log('🔧 [MCPService] Handling tools/list request');
    
    try {
      // Get tools from all providers
      const allTools: MCPFormattedTool[] = [];
      
      for (const provider of this.providers) {
        const providerTools = await provider.toolsList();
        const mcpFormattedTools = providerTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.parameters
        }));
        allTools.push(...mcpFormattedTools);
      }
      
      console.log(`✅ [MCPService] Returning ${allTools.length} tools from ${this.providers.length} providers`);
      
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          tools: allTools as any // MCP protocol expects this structure
        }
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: `Failed to list tools: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }

  /**
   * Get tools from a specific server identifier
   * This method is used by ProviderService for cubicler.fetch_server_tools
   */
  async getServerTools(serverIdentifier: string): Promise<ToolDefinition[]> {
    console.log(`🔧 [MCPService] Getting tools for server: ${serverIdentifier}`);
    
    try {
      // Try each provider to see if it can handle this server
      for (const provider of this.providers) {
        if (provider.identifier !== serverIdentifier) continue;
        try {
          const tools = await provider.toolsList();
          if (tools.length > 0) {
            console.log(`✅ [MCPService] Found ${tools.length} tools for server ${serverIdentifier}`);
            return tools;
          }
        } catch (error) {
          // Provider doesn't handle this server, try next one
          continue;
        }
      }
      
      // No provider found for this server
      throw new Error(`Server not found: ${serverIdentifier}`);
    } catch (error) {
      console.error(`❌ [MCPService] Failed to get tools for server ${serverIdentifier}:`, error);
      throw error;
    }
  }

  /**
   * Handle MCP tools/call request - routes to appropriate provider
   */
  private async handleToolsCall(request: MCPRequest): Promise<MCPResponse> {
    console.log('⚙️ [MCPService] Handling tools/call request');
    
    const params = request.params as JSONObject;
    if (!params || !params.name) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32602, // Invalid params
          message: 'Missing required parameter: name'
        }
      };
    }
    
    const toolName = params.name as string;
    const arguments_ = (params.arguments as JSONObject) || {};
    
    try {
      // Find the provider that can handle this tool
      for (const provider of this.providers) {
        if (await provider.canHandleRequest(toolName)) {
          const result = await provider.toolsCall(toolName, arguments_);
          
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                }
              ]
            }
          };
        }
      }
      
      // No provider can handle this tool
      throw new Error(`No provider found for tool: ${toolName}`);
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }
}

import providerMcpService from './provider-mcp-service.js';
import providerRestService from './provider-rest-service.js';
import internalToolsService from './internal-tools-service.js';

// Create and export the service (providers will be injected from index.ts)
export default new MCPService([internalToolsService, providerMcpService, providerRestService]);