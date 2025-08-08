import type { JSONObject, JSONValue, MCPRequest } from '../model/types.js';
import type { MCPTool, ToolDefinition } from '../model/tools.js';
import type { McpServerConfig } from '../model/providers.js';
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
import { MCPTransportFactory } from '../factory/mcp-transport-factory.js';
import type { MCPTransport } from '../interface/mcp-transport.js';

/**
 * MCP Provider Service for Cubicler
 * Handles Model Context Protocol communication with MCP servers using transport abstraction
 */
class ProviderMCPService implements MCPCompatible {
  readonly identifier = 'provider-mcp';
  private readonly providerConfig: ProvidersConfigProviding;
  private serversProvider: ServersProviding | null = null;
  private readonly transports = new Map<string, MCPTransport>();

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
    const mcpServers = config.mcpServers || {};

    for (const [serverId, server] of Object.entries(mcpServers)) {
      try {
        await this.initializeMCPServer(serverId, server);
      } catch (error) {
        console.warn(`⚠️ [ProviderMCPService] Failed to initialize MCP server ${serverId}:`, error);
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
    const mcpServers = config.mcpServers || {};
    const allMCPTools: ToolDefinition[] = [];

    if (!this.serversProvider) {
      console.warn('⚠️ [ProviderMCPService] ServersProvider not set, cannot generate tool names');
      return allMCPTools;
    }

    for (const [serverId, server] of Object.entries(mcpServers)) {
      try {
        console.log(`🔧 [ProviderMCPService] Loading MCP tools from ${serverId}...`);
        const tools = await this.loadToolsFromServer(serverId, server);
        allMCPTools.push(...tools);
        console.log(
          `✅ [ProviderMCPService] Loaded ${tools.length} tools from MCP server ${serverId}`
        );
      } catch (error) {
        console.warn(`⚠️ [ProviderMCPService] Failed to get MCP tools from ${serverId}:`, error);
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
      const result = await this.findServerByHash(serverHash);
      return result !== undefined;
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
    const result = await this.findServerByHash(serverHash);

    if (!result) {
      throw new Error(`Server not found for hash: ${serverHash}`);
    }

    const { serverId, server } = result;

    // Ensure transport exists for this server
    if (!this.transports.has(serverId)) {
      try {
        const transport = MCPTransportFactory.createTransport(serverId, server);
        await transport.initialize(serverId, server);
        this.transports.set(serverId, transport);
      } catch (error) {
        throw new Error(
          `Failed to create transport for ${serverId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    const toolResult = await this.executeMCPTool(serverId, functionName, parameters);
    return toolResult as JSONValue;
  }

  /**
   * Initialize a single MCP server
   * @param serverId - Server identifier
   * @param server - Server configuration
   */
  private async initializeMCPServer(serverId: string, server: McpServerConfig): Promise<void> {
    console.log(`🔄 [ProviderMCPService] Initializing MCP server: ${serverId}`);

    // Create and initialize transport
    const transport = MCPTransportFactory.createTransport(serverId, server);
    await transport.initialize(serverId, server);

    // Store transport (even if initialization fails, we keep it for tool operations)
    this.transports.set(serverId, transport);

    // Send initialize request
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

    try {
      const response = await transport.sendRequest(request);

      if (response.error) {
        throw new Error(`MCP server initialization failed: ${response.error.message}`);
      }
    } catch (error) {
      throw new Error(
        `MCP server initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    console.log(`✅ [ProviderMCPService] MCP server ${serverId} initialized`);
  }

  /**
   * Load tools from a specific MCP server
   * @param server - Server configuration
   * @returns Array of tool definitions
   */
  private async loadToolsFromServer(
    serverId: string,
    server: McpServerConfig
  ): Promise<ToolDefinition[]> {
    // Ensure transport exists for this server
    if (!this.transports.has(serverId)) {
      try {
        const transport = MCPTransportFactory.createTransport(serverId, server);
        await transport.initialize(serverId, server);
        this.transports.set(serverId, transport);
      } catch (error) {
        console.warn(`⚠️ [ProviderMCPService] Failed to create transport for ${serverId}:`, error);
        return [];
      }
    }

    const mcpTools = await this.getMCPTools(serverId);

    // Get identifier string based on server type
    let serverIdentifierString = '';
    if ('command' in server) {
      // STDIO server
      serverIdentifierString = server.command;
    } else if ('url' in server) {
      // HTTP/SSE server
      serverIdentifierString = server.url;
    }

    return mcpTools.map((tool) => ({
      name: generateFunctionName(serverId, serverIdentifierString, toSnakeCase(tool.name)),
      description: tool.description || `MCP tool: ${tool.name}`,
      parameters: tool.inputSchema || { type: 'object', properties: {} },
    }));
  }

  /**
   * Find server configuration by hash
   * @param serverHash - Server hash to find
   * @returns Server configuration or undefined if not found
   */
  private async findServerByHash(
    serverHash: string
  ): Promise<{ serverId: string; server: McpServerConfig } | undefined> {
    const config = await this.providerConfig.getProvidersConfig();
    const mcpServers = config.mcpServers || {};

    for (const [serverId, server] of Object.entries(mcpServers)) {
      // Get identifier string based on server type
      let serverIdentifierString = '';
      if ('command' in server) {
        // STDIO server
        serverIdentifierString = server.command;
      } else if ('url' in server) {
        // HTTP/SSE server
        serverIdentifierString = server.url;
      }

      const expectedHash = generateServerHash(serverId, serverIdentifierString);
      if (expectedHash === serverHash) {
        return { serverId, server };
      }
    }

    return undefined;
  }

  /**
   * Get tools from an MCP server
   * Implements the MCP tools/list method
   */
  private async getMCPTools(serverIdentifier: string): Promise<MCPTool[]> {
    const transport = this.transports.get(serverIdentifier);
    if (!transport) {
      throw new Error(`Transport not found for server: ${serverIdentifier}`);
    }

    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: 'tools-request',
      method: 'tools/list',
      params: {},
    };

    const response = await transport.sendRequest(request);

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
    const transport = this.transports.get(serverIdentifier);
    if (!transport) {
      throw new Error(`Transport not found for server: ${serverIdentifier}`);
    }

    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: `execute-${toolName}`,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: parameters,
      },
    };

    const response = await transport.sendRequest(request);

    if (response.error) {
      throw new Error(`MCP tool execution failed: ${response.error.message}`);
    }

    return response.result || null;
  }

  /**
   * Cleanup method to close all transports
   */
  async cleanup(): Promise<void> {
    console.log('🔄 [ProviderMCPService] Cleaning up transports...');

    for (const [identifier, transport] of this.transports.entries()) {
      try {
        await transport.close();
        console.log(`✅ [ProviderMCPService] Closed transport for ${identifier}`);
      } catch (error) {
        console.warn(`⚠️ [ProviderMCPService] Failed to close transport for ${identifier}:`, error);
      }
    }

    this.transports.clear();
    console.log('✅ [ProviderMCPService] All transports cleaned up');
  }
}

// Export the class for dependency injection and a default instance for backward compatibility
export { ProviderMCPService };
export default new ProviderMCPService();
