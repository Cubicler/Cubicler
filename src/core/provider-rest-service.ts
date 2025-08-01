import type { JSONObject, JSONValue } from '../model/types.js';
import { fetchWithDefaultTimeout } from '../utils/fetch-helper.js';
import { convertToQueryParams, replacePathParameters, generateFunctionName, generateServerHash, parseFunctionName, toSnakeCase } from '../utils/parameter-helper.js';
import type { ProvidersConfigProviding } from '../interface/providers-config-providing.js';
import type { ServersProviding } from '../interface/servers-providing.js';
import providersRepository from '../repository/provider-repository.js';
import { MCPCompatible } from '../interface/mcp-compatible.js';
import { ToolDefinition } from '../model/tools.js';

/**
 * REST Provider Service for Cubicler
 * Handles REST server communication and tool execution
 */
class ProviderRESTService implements MCPCompatible {
  readonly identifier = 'provider-rest';
  private readonly configProvider: ProvidersConfigProviding;
  private serversProvider: ServersProviding | null = null;

  /**
   * Creates a new ProviderRESTService instance
   * @param configProvider - Provider configuration service for accessing REST server configurations
   */
  constructor(configProvider: ProvidersConfigProviding) {
    this.configProvider = configProvider;
  }

  /**
   * Set the servers provider for index resolution (called during DI setup)
   * @param serversProvider - The servers provider instance
   */
  setServersProvider(serversProvider: ServersProviding): void {
    this.serversProvider = serversProvider;
  }

  /**
   * Initialize the REST provider service
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    console.log('🔄 [ProviderRESTService] Initializing REST provider service...');
    // REST servers typically don't need initialization
    console.log('✅ [ProviderRESTService] REST provider service initialized');
  }

  /**
   * Get list of tools this service provides (MCPCompatible)
   * @returns Array of tool definitions from all REST servers
   */
  async toolsList(): Promise<ToolDefinition[]> {
    // Return all tools from all REST servers
    const config = await this.configProvider.getProvidersConfig();
    const restServers = config.restServers || [];
    const allTools: ToolDefinition[] = [];

    if (!this.serversProvider) {
      console.warn('⚠️ [ProviderRESTService] ServersProvider not set, cannot generate tool names');
      return allTools;
    }

    for (const server of restServers) {
      try {
        const serverTools = await this.getRESTTools(server.identifier);
        allTools.push(...serverTools);
      } catch (error) {
        console.warn(
          `⚠️ [RESTService] Failed to get tools from REST server ${server.identifier}:`,
          error
        );
        // Continue with other servers
      }
    }

    return allTools;
  }

    /**
   * Execute a REST tool by parsing function name and delegating to executeRESTTool
   * @param toolName - Name of the tool to execute (format: s{hash}_{snake_case_function})
   * @param parameters - Parameters for the tool execution
   * @returns Result of the tool execution
   * @throws Error if tool name format is invalid or execution fails
   */
  async toolsCall(toolName: string, parameters: JSONObject): Promise<JSONValue> {
    const { serverHash, functionName } = parseFunctionName(toolName);
    
    // Find server by hash
    const config = await this.configProvider.getProvidersConfig();
    const restServers = config.restServers || [];
    
    const server = restServers.find(s => {
      const expectedHash = generateServerHash(s.identifier, s.url);
      return expectedHash === serverHash;
    });
    
    if (!server) {
      throw new Error(`REST server not found for hash: ${serverHash}`);
    }

    return await this.executeRESTTool(server.identifier, functionName, parameters);
  }

  /**
   * Check if this service can handle the given tool name
   * @param toolName - Name of the tool to check (format: s{hash}_{snake_case_function})
   * @returns true if this service can handle the tool, false otherwise
   */
  async canHandleRequest(toolName: string): Promise<boolean> {
    try {
      const { serverHash } = parseFunctionName(toolName);
      
      const config = await this.configProvider.getProvidersConfig();
      const restServers = config.restServers || [];
      
      const server = restServers.find(s => {
        const expectedHash = generateServerHash(s.identifier, s.url);
        return expectedHash === serverHash;
      });
      
      return server !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Get tools from a specific REST server
   */
  private async getRESTTools(serverIdentifier: string): Promise<ToolDefinition[]> {
    const config = await this.configProvider.getProvidersConfig();
    const restServer = config.restServers?.find((s) => s.identifier === serverIdentifier);

    if (!restServer) {
      throw new Error(`REST server not found: ${serverIdentifier}`);
    }

    // Convert REST endpoints to tool definitions
    const tools: ToolDefinition[] = restServer.endPoints.map((endpoint) => {
      // Build parameters object with path variables as root parameters
      const properties: Record<string, JSONValue> = {};
      const required: string[] = [];

      // Extract path parameters from the path template
      const pathParamMatches = endpoint.path.match(/\{(\w+)\}/g);
      if (pathParamMatches) {
        for (const match of pathParamMatches) {
          const paramName = match.slice(1, -1); // Remove { and }
          properties[paramName] = { type: 'string' };
          required.push(paramName);
        }
      }

      // Add query parameters as an object if endpoint has parameters
      if (endpoint.parameters?.properties) {
        properties.query = {
          type: 'object',
          properties: endpoint.parameters.properties,
          required: endpoint.parameters.required || [],
        };
      }

      // Add payload parameters as an object if endpoint has payload
      if (endpoint.payload?.properties) {
        properties.payload = {
          type: 'object',
          properties: endpoint.payload.properties,
          required: endpoint.payload.required || [],
        };
      }

      return {
        name: generateFunctionName(restServer.identifier, restServer.url, toSnakeCase(endpoint.name)),
        description: endpoint.description,
        parameters: {
          type: 'object',
          properties,
          required,
        },
      };
    });

    return tools;
  }

  /**
   * Execute a REST tool/function
   */
  private async executeRESTTool(
    serverIdentifier: string,
    functionName: string,
    parameters: Record<string, JSONValue>
  ): Promise<JSONValue> {
    console.log(`🌐 [RESTService] Executing REST tool: ${serverIdentifier}.${functionName}`);

    const config = await this.configProvider.getProvidersConfig();
    const restServer = config.restServers?.find((s) => s.identifier === serverIdentifier);

    if (!restServer) {
      throw new Error(`REST server not found: ${serverIdentifier}`);
    }

    // Find the endpoint
    const endpoint = restServer.endPoints.find((ep) => toSnakeCase(ep.name) === functionName);
    if (!endpoint) {
      throw new Error(`REST endpoint not found: ${functionName} in server ${serverIdentifier}`);
    }

    try {
      // Extract path parameters (root level parameters that match {variable} in path)
      const pathParamMatches = endpoint.path.match(/\{(\w+)\}/g);
      const pathParams: Record<string, string> = {};
      const remainingParams: Record<string, JSONValue> = { ...parameters };

      if (pathParamMatches) {
        for (const match of pathParamMatches) {
          const paramName = match.slice(1, -1); // Remove { and }
          if (paramName in parameters) {
            pathParams[paramName] = String(parameters[paramName]);
            delete remainingParams[paramName];
          }
        }
      }

      // Build the full URL with path parameters replaced
      const pathWithParams = replacePathParameters(endpoint.path, pathParams);
      const fullUrl = `${restServer.url}${pathWithParams}`;

      // Extract query parameters from the 'query' object
      let queryParams: Record<string, string> = {};
      if (
        remainingParams.query &&
        typeof remainingParams.query === 'object' &&
        remainingParams.query !== null
      ) {
        queryParams = convertToQueryParams(remainingParams.query as Record<string, JSONValue>);
      }

      // Extract payload parameters from the 'payload' object
      let body: Record<string, JSONValue> | null = null;
      if (
        endpoint.payload &&
        remainingParams.payload &&
        typeof remainingParams.payload === 'object' &&
        remainingParams.payload !== null
      ) {
        body = remainingParams.payload as Record<string, JSONValue>;
      }

      // Build query string
      const queryString = Object.entries(queryParams)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');

      const finalUrl = queryString ? `${fullUrl}?${queryString}` : fullUrl;

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...restServer.defaultHeaders,
        ...endpoint.headers,
      };

      // Prepare request options
      const requestOptions: {
        method: string;
        headers: Record<string, string>;
        data?: Record<string, JSONValue>;
      } = {
        method: endpoint.method,
        headers,
      };

      // Add body for any method if payload is provided
      if (body) {
        requestOptions.data = body;
      }

      console.log(`🚀 [RESTService] Calling ${endpoint.method} ${finalUrl}`);

      const response = await fetchWithDefaultTimeout(finalUrl, requestOptions);

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`REST call failed with status ${response.status}: ${response.statusText}`);
      }

      console.log(`✅ [RESTService] REST call successful`);
      return response.data;
    } catch (error) {
      console.error(`❌ [RESTService] REST call failed:`, error);
      throw new Error(
        `REST execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// Export the class for dependency injection and a default instance for backward compatibility
export { ProviderRESTService };
export default new ProviderRESTService(providersRepository);
