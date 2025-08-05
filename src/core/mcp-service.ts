import type { JSONObject, JSONValue, MCPRequest, MCPResponse } from '../model/types.js';
import type { MCPFormattedTool } from '../model/tools.js';
import type { MCPHandling } from '../interface/mcp-handling.js';
import { MCPCompatible } from '../interface/mcp-compatible.js';

/**
 * MCP Service for Cubicler
 * Aggregates all MCPCompatible services and handles the MCP protocol
 * Uses dependency injection to manage multiple providers
 */
export class MCPService implements MCPHandling {
  private providers: MCPCompatible[];

  /**
   * Creates a new MCPService instance
   * @param providers - Array of MCPCompatible services
   */
  constructor(providers: MCPCompatible[] = []) {
    this.providers = providers;
    console.log(`🔧 [MCPService] Created with ${providers.length} MCPCompatible providers`);
  }

  /**
   * Initialize all injected providers
   * @returns Promise that resolves when all providers are initialized
   * @throws Error if any provider fails to initialize
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
   * @param request - MCP request object with method and parameters
   * @returns MCP response object with result or error
   */
  async handleMCPRequest(request: MCPRequest): Promise<MCPResponse> {
    console.log(`📡 [MCPService] Handling MCP request: ${request.method}`);

    try {
      return await this.routeRequest(request);
    } catch (error) {
      console.error(`❌ [MCPService] Error handling MCP request:`, error);
      return this.createErrorResponse(
        request.id,
        -32603,
        `Internal error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Route MCP request to appropriate handler
   * @param request - MCP request object
   * @returns MCP response object
   * @throws Error if method is not supported
   */
  private async routeRequest(request: MCPRequest): Promise<MCPResponse> {
    switch (request.method) {
      case 'initialize':
        return await this.handleInitialize(request);

      case 'tools/list':
        return await this.handleToolsList(request);

      case 'tools/call':
        return await this.handleToolsCall(request);

      default:
        return this.createErrorResponse(
          request.id,
          -32601,
          `Method not supported: ${request.method}. Supported methods: initialize, tools/list, tools/call`
        );
    }
  }

  /**
   * Create standardized error response
   * @param id - Request ID
   * @param code - Error code
   * @param message - Error message
   * @returns MCP error response
   */
  private createErrorResponse(
    id: string | number | null,
    code: number,
    message: string
  ): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: id ?? 'unknown',
      error: { code, message },
    };
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
            listChanged: true,
          },
        },
        serverInfo: {
          name: 'Cubicler',
          version: '2.0',
        },
      },
    };
  }

  /**
   * Handle MCP tools/list request
   * Aggregates tools from all providers
   */
  private async handleToolsList(request: MCPRequest): Promise<MCPResponse> {
    console.log('🔧 [MCPService] Handling tools/list request');

    try {
      const allTools = await this.aggregateToolsFromProviders();

      console.log(
        `✅ [MCPService] Returning ${allTools.length} tools from ${this.providers.length} providers`
      );

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          tools: allTools as unknown as JSONValue,
        },
      };
    } catch (error) {
      return this.createErrorResponse(
        request.id,
        -32603,
        `Failed to list tools: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Aggregate tools from all providers
   * @returns Array of MCP formatted tools
   */
  private async aggregateToolsFromProviders(): Promise<MCPFormattedTool[]> {
    const allTools: MCPFormattedTool[] = [];

    for (const provider of this.providers) {
      const providerTools = await provider.toolsList();
      const mcpFormattedTools = providerTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.parameters,
      }));
      allTools.push(...mcpFormattedTools);
    }

    return allTools;
  }

  /**
   * Handle MCP tools/call request - routes to appropriate provider
   */
  private async handleToolsCall(request: MCPRequest): Promise<MCPResponse> {
    console.log('⚙️ [MCPService] Handling tools/call request');

    const params = request.params as JSONObject;
    const toolCallParams = this.validateToolCallParams(params);

    if (!toolCallParams) {
      return this.createErrorResponse(request.id, -32602, 'Missing required parameter: name');
    }

    try {
      const result = await this.executeToolCall(toolCallParams.toolName, toolCallParams.arguments);

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        },
      };
    } catch (error) {
      return this.createErrorResponse(
        request.id,
        -32603,
        `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate tool call parameters
   * @param params - Request parameters
   * @returns Validated parameters or null if invalid
   */
  private validateToolCallParams(
    params: JSONObject | null
  ): { toolName: string; arguments: JSONObject } | null {
    if (!params || !params.name) {
      return null;
    }

    return {
      toolName: params.name as string,
      arguments: (params.arguments as JSONObject) || {},
    };
  }

  /**
   * Execute tool call by finding appropriate provider
   * @param toolName - Name of the tool to execute
   * @param arguments_ - Arguments to pass to the tool
   * @returns Tool execution result
   * @throws Error if no provider can handle the tool or execution fails
   */
  private async executeToolCall(toolName: string, arguments_: JSONObject): Promise<JSONValue> {
    for (const provider of this.providers) {
      if (await provider.canHandleRequest(toolName)) {
        return await provider.toolsCall(toolName, arguments_);
      }
    }

    throw new Error(`No provider found for tool: ${toolName}`);
  }
}

import providerMcpService from './provider-mcp-service.js';
import providerRestService from './provider-rest-service.js';
import internalToolsService from './internal-tools-service.js';

// Export default instance for backward compatibility
export default new MCPService([internalToolsService, providerMcpService, providerRestService]);
