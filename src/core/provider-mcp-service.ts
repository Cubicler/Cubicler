import type { JSONObject, JSONValue, MCPRequest, MCPResponse } from '../model/types.js';
import type { MCPTool, ToolDefinition } from '../model/tools.js';
import type { MCPServer } from '../model/providers.js';
import { fetchWithDefaultTimeout } from '../utils/fetch-helper.js';
import {
  generateFunctionName,
  generateServerHash,
  parseFunctionName,
  toSnakeCase,
} from '../utils/parameter-helper.js';
import type { ProvidersConfigProviding } from '../interface/providers-config-providing.js';
import type { ServersProviding } from '../interface/servers-providing.js';
import providersRepository from '../repository/provider-repository.js';
import { MCPCompatible } from '../interface/mcp-compatible.js';

/**
 * MCP Provider Service for Cubicler
 * Handles Model Context Protocol communication with MCP servers only
 */
class ProviderMCPService implements MCPCompatible {
  readonly identifier = 'provider-mcp';
  private readonly providerConfig: ProvidersConfigProviding;
  private serversProvider: ServersProviding | null = null;

  /**
   * Creates a new ProviderMCPService instance
   * @param providerConfig - Provider configuration service for accessing MCP server configurations
   */
  constructor(providerConfig: ProvidersConfigProviding = providersRepository) {
    this.providerConfig = providerConfig;
  }

  /**
   * Set the servers provider for index resolution (called during DI setup)
   * @param serversProvider - The servers provider instance
   */
  setServersProvider(serversProvider: ServersProviding): void {
    this.serversProvider = serversProvider;
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
    const config = await this.providerConfig.getProvidersConfig();
    const mcpServers = config.mcpServers || [];
    const allMCPTools: ToolDefinition[] = [];

    if (!this.serversProvider) {
      console.warn('⚠️ [ProviderMCPService] ServersProvider not set, cannot generate tool names');
      return allMCPTools;
    }

    for (const server of mcpServers) {
      try {
        console.log(`🔧 [ProviderMCPService] Loading MCP tools from ${server.identifier}...`);
        const tools = await this.loadToolsFromServer(server);
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
   * Check if this service can handle the given tool name
   * @param toolName - Name of the tool to check (format: {hash}_{snake_case_function})
   * @returns true if this service can handle the tool, false otherwise
   */
  async canHandleRequest(toolName: string): Promise<boolean> {
    try {
      const { serverHash } = parseFunctionName(toolName);
      const server = await this.findServerByHash(serverHash);
      return server !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Execute a tool call (MCPCompatible)
   * @param toolName - Name of the tool to execute (format: serverCamelCase_functionCamelCase)
   * @param parameters - Parameters to pass to the tool
   * @returns Result of the tool execution
   * @throws Error if tool execution fails
   */
  async toolsCall(toolName: string, parameters: JSONObject): Promise<JSONValue> {
    console.log(`⚙️ [ProviderMCPService] Executing MCP tool: ${toolName}`);

    const { serverHash, functionName } = parseFunctionName(toolName);
    const server = await this.findServerByHash(serverHash);

    if (!server) {
      throw new Error(`Server not found for hash: ${serverHash}`);
    }

    const result = await this.executeMCPTool(server.identifier, functionName, parameters);
    return result as JSONValue;
  }

  /**
   * Load tools from a specific MCP server
   * @param server - Server configuration
   * @returns Array of tool definitions
   */
  private async loadToolsFromServer(server: MCPServer): Promise<ToolDefinition[]> {
    const mcpTools = await this.getMCPTools(server.identifier);

    return mcpTools.map((tool) => ({
      name: generateFunctionName(server.identifier, server.url, toSnakeCase(tool.name)),
      description: tool.description || `MCP tool: ${tool.name}`,
      parameters: tool.inputSchema || { type: 'object', properties: {} },
    }));
  }

  /**
   * Find server configuration by hash
   * @param serverHash - Server hash to find
   * @returns Server configuration or undefined if not found
   */
  private async findServerByHash(serverHash: string): Promise<MCPServer | undefined> {
    const config = await this.providerConfig.getProvidersConfig();
    const mcpServers = config.mcpServers || [];

    return mcpServers.find((s: MCPServer) => {
      const expectedHash = generateServerHash(s.identifier, s.url);
      return expectedHash === serverHash;
    });
  }

  /**
   * Send an MCP request to a specific server
   */
  private async sendMCPRequest(
    serverIdentifier: string,
    request: MCPRequest
  ): Promise<MCPResponse> {
    console.log(
      `📡 [ProviderMCPService] Sending MCP request to ${serverIdentifier}:`,
      request.method
    );

    const mcpServer = await this.getMCPServerConfig(serverIdentifier);
    this.validateMCPServerTransport(mcpServer);

    try {
      const response = await this.executeMCPRequest(mcpServer, request);
      console.log(`✅ [ProviderMCPService] MCP request to ${serverIdentifier} successful`);
      return response.data as MCPResponse;
    } catch (error) {
      console.error(`❌ [ProviderMCPService] MCP request to ${serverIdentifier} failed:`, error);
      return this.createMCPErrorResponse(request, error);
    }
  }

  /**
   * Get MCP server configuration
   * @param serverIdentifier - Server identifier
   * @returns Server configuration
   * @throws Error if server not found
   */
  private async getMCPServerConfig(serverIdentifier: string): Promise<MCPServer> {
    const config = await this.providerConfig.getProvidersConfig();
    const mcpServer = config.mcpServers?.find((s: MCPServer) => s.identifier === serverIdentifier);

    if (!mcpServer) {
      throw new Error(`MCP server not found: ${serverIdentifier}`);
    }

    return mcpServer;
  }

  /**
   * Validate MCP server transport
   * @param mcpServer - Server configuration
   * @throws Error if transport is not supported
   */
  private validateMCPServerTransport(mcpServer: MCPServer): void {
    if (mcpServer.transport !== 'http') {
      throw new Error(
        `Transport ${mcpServer.transport} not yet supported. Currently only HTTP transport is supported.`
      );
    }
  }

  /**
   * Execute MCP request via HTTP
   * @param mcpServer - Server configuration
   * @param request - MCP request
   * @returns HTTP response
   */
  private async executeMCPRequest(
    mcpServer: MCPServer,
    request: MCPRequest
  ): Promise<{ data: MCPResponse; status: number }> {
    return await fetchWithDefaultTimeout(mcpServer.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...mcpServer.headers,
      },
      data: request,
    });
  }

  /**
   * Create MCP error response
   * @param request - Original request
   * @param error - Error that occurred
   * @returns MCP error response
   */
  private createMCPErrorResponse(request: MCPRequest, error: unknown): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32603, // Internal error
        message: `MCP request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    };
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
