import type { JSONObject, JSONValue, MCPRequest, MCPResponse } from '../model/types.js';
import type { MCPTool, ToolDefinition } from '../model/tools.js';
import { fetchWithDefaultTimeout } from '../utils/fetch-helper.js';
import type { ProvidersConfigProviding } from '../interface/providers-config-providing.js';
import providersRepository from '../repository/provider-repository.js';
import { MCPCompatible } from '../interface/mcp-compatible.js';

/**
 * MCP Provider Service for Cubicler
 * Handles Model Context Protocol communication with MCP servers only
 */
class ProviderMCPService implements MCPCompatible {
  readonly identifier = 'provider-mcp';
  private readonly providerConfig: ProvidersConfigProviding;

  /**
   * Creates a new ProviderMCPService instance
   * @param providerConfig - Provider configuration service for accessing MCP server configurations
   */
  constructor(providerConfig: ProvidersConfigProviding = providersRepository) {
    this.providerConfig = providerConfig;
  }

  /**
   * Initialize the MCP provider service
   * @returns Promise that resolves when all MCP servers are initialized
   */
  async initialize(): Promise<void> {
    console.log('🔄 [ProviderMCPService] Initializing MCP provider service...');

    // Initialize all MCP servers
    const config = await this.providerConfig.getProvidersConfig();
    const mcpServers = config.mcpServers || [];
    for (const server of mcpServers) {
      try {
        await this.initializeMCPServer(server.identifier);
      } catch (error) {
        console.warn(
          `⚠️ [ProviderMCPService] Failed to initialize MCP server ${server.identifier}:`,
          error
        );
      }
    }

    console.log('✅ [ProviderMCPService] MCP provider service initialized');
  }

  /**
   * Get list of tools this service provides (MCPCompatible)
   * @returns Array of tool definitions from all MCP servers
   */
  async toolsList(): Promise<ToolDefinition[]> {
    return await this.getAllMCPTools();
  }

  /**
   * Check if this service can handle the given tool name
   * @param toolName - Name of the tool to check (format: server.function)
   * @returns true if this service can handle the tool, false otherwise
   */
  async canHandleRequest(toolName: string): Promise<boolean> {
    const parts = toolName.split('.');
    if (parts.length !== 2) return false;

    const [serverIdentifier] = parts;
    if (!serverIdentifier) return false;

    return await this.isMCPServer(serverIdentifier);
  }

  /**
   * Execute a tool call (MCPCompatible)
   * @param toolName - Name of the tool to execute (format: server.function)
   * @param parameters - Parameters to pass to the tool
   * @returns Result of the tool execution
   * @throws Error if tool execution fails
   */
  async toolsCall(toolName: string, parameters: JSONObject): Promise<JSONValue> {
    return await this.executeToolByName(toolName, parameters);
  }

  /**
   * Get all tools from all MCP servers only
   */
  private async getAllMCPTools(): Promise<ToolDefinition[]> {
    const config = await this.providerConfig.getProvidersConfig();
    const mcpServers = config.mcpServers || [];
    const allMCPTools: ToolDefinition[] = [];

    for (const server of mcpServers) {
      try {
        console.log(`🔧 [ProviderMCPService] Loading MCP tools from ${server.identifier}...`);
        const mcpTools = await this.getMCPTools(server.identifier);

        // Convert MCP tools to Cubicler function definitions
        const tools: ToolDefinition[] = mcpTools.map((tool) => ({
          name: `${server.identifier}.${tool.name}`,
          description: tool.description || `MCP tool: ${tool.name}`,
          parameters: tool.inputSchema || { type: 'object', properties: {} },
        }));

        allMCPTools.push(...tools);
        console.log(
          `✅ [ProviderMCPService] Loaded ${tools.length} tools from MCP server ${server.identifier}`
        );
      } catch (error) {
        console.warn(
          `⚠️ [ProviderMCPService] Failed to get MCP tools from ${server.identifier}:`,
          error
        );
        // Continue with other servers
      }
    }

    return allMCPTools;
  }

  /**
   * Execute a tool by parsing the full function name {serverIdentifier}.{functionName}
   */
  private async executeToolByName(fullFunctionName: string, parameters: JSONObject): Promise<JSONValue> {
    console.log(`⚙️ [ProviderMCPService] Executing MCP tool: ${fullFunctionName}`);

    // Parse the function name
    const parts = fullFunctionName.split('.');
    if (parts.length !== 2) {
      throw new Error(
        `Invalid function name format: ${fullFunctionName}. Expected format: server.function`
      );
    }

    const [serverIdentifier, functionName] = parts;

    if (!serverIdentifier || !functionName) {
      throw new Error(
        `Invalid function name format: ${fullFunctionName}. Expected format: server.function`
      );
    }

    // Execute MCP tool
    const result = await this.executeMCPTool(serverIdentifier, functionName, parameters);
    return result as JSONValue;
  }

  /**
   * Send an MCP request to a specific server
   */
  private async sendMCPRequest(serverIdentifier: string, request: MCPRequest): Promise<MCPResponse> {
    console.log(
      `📡 [ProviderMCPService] Sending MCP request to ${serverIdentifier}:`,
      request.method
    );

    // Get the MCP server configuration
    const config = await this.providerConfig.getProvidersConfig();
    const mcpServer = config.mcpServers?.find((s) => s.identifier === serverIdentifier);

    if (!mcpServer) {
      throw new Error(`MCP server not found: ${serverIdentifier}`);
    }

    if (mcpServer.transport !== 'http') {
      throw new Error(
        `Transport ${mcpServer.transport} not yet supported. Currently only HTTP transport is supported.`
      );
    }

    try {
      const response = await fetchWithDefaultTimeout(mcpServer.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...mcpServer.headers,
        },
        data: request,
      });

      console.log(`✅ [ProviderMCPService] MCP request to ${serverIdentifier} successful`);
      return response.data as MCPResponse;
    } catch (error) {
      console.error(`❌ [ProviderMCPService] MCP request to ${serverIdentifier} failed:`, error);

      // Return MCP error response
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603, // Internal error
          message: `MCP request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      };
    }
  }

  /**
   * Get tools from an MCP server
   * Implements the MCP tools/list method
   */
  private async getMCPTools(serverIdentifier: string): Promise<MCPTool[]> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: 'tools-request',
      method: 'tools/list',
      params: {},
    };

    const response = await this.sendMCPRequest(serverIdentifier, request);

    if (response.error) {
      throw new Error(`MCP tools request failed: ${response.error.message}`);
    }

    // Extract tools from MCP response
    if (response.result && typeof response.result === 'object' && 'tools' in response.result) {
      const result = response.result as unknown as { tools: MCPTool[] };
      return result.tools || [];
    }

    return [];
  }

  /**
   * Execute an MCP tool/function
   */
  private async executeMCPTool(
    serverIdentifier: string,
    toolName: string,
    parameters: JSONObject
  ): Promise<JSONValue> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: `execute-${toolName}`,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: parameters,
      },
    };

    const response = await this.sendMCPRequest(serverIdentifier, request);

    if (response.error) {
      throw new Error(`MCP tool execution failed: ${response.error.message}`);
    }

    return response.result || null;
  }

  /**
   * Initialize connection to an MCP server
   */
  private async initializeMCPServer(serverIdentifier: string): Promise<void> {
    console.log(`🔄 [ProviderMCPService] Initializing MCP server: ${serverIdentifier}`);

    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: 'initialize',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        clientInfo: {
          name: 'Cubicler',
          version: '2.0',
        },
      },
    };

    const response = await this.sendMCPRequest(serverIdentifier, request);

    if (response.error) {
      throw new Error(`MCP server initialization failed: ${response.error.message}`);
    }

    console.log(`✅ [ProviderMCPService] MCP server ${serverIdentifier} initialized`);
  }

  /**
   * Check if a server is an MCP server
   */
  private async isMCPServer(serverIdentifier: string): Promise<boolean> {
    const config = await this.providerConfig.getProvidersConfig();
    const mcpServer = config.mcpServers?.find((s) => s.identifier === serverIdentifier);
    return mcpServer !== undefined;
  }
}

// Export the class for dependency injection and a default instance for backward compatibility
export { ProviderMCPService };
export default new ProviderMCPService();
