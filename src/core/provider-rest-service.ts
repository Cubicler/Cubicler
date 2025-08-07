import type { JSONObject, JSONValue } from '../model/types.js';
import { fetchWithDefaultTimeout } from '../utils/fetch-helper.js';
import {
  convertToQueryParams,
  generateFunctionName,
  generateServerHash,
  parseFunctionName,
  replacePathParameters,
  toSnakeCase,
} from '../utils/parameter-helper.js';
import { transformResponse } from '../utils/response-transformer.js';
import type { ProvidersConfigProviding } from '../interface/providers-config-providing.js';
import type { ServersProviding } from '../interface/servers-providing.js';
import providersRepository from '../repository/provider-repository.js';
import { MCPCompatible } from '../interface/mcp-compatible.js';
import { ToolDefinition } from '../model/tools.js';
import type { RESTEndpoint, RESTServer } from '../model/providers.js';
import jwtHelper from '../utils/jwt-helper.js';

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
   * @param toolName - Name of the tool to execute (format: {hash}_{snake_case_function})
   * @param parameters - Parameters for the tool execution
   * @returns Result of the tool execution
   * @throws Error if tool name format is invalid or execution fails
   */
  async toolsCall(toolName: string, parameters: JSONObject): Promise<JSONValue> {
    const { serverHash, functionName } = parseFunctionName(toolName);
    const server = await this.findRestServerByHash(serverHash);

    if (!server) {
      throw new Error(`REST server not found for hash: ${serverHash}`);
    }

    return await this.executeRESTTool(server.identifier, functionName, parameters);
  }

  /**
   * Check if this service can handle the given tool name
   * @param toolName - Name of the tool to check (format: {hash}_{snake_case_function})
   * @returns true if this service can handle the tool, false otherwise
   */
  async canHandleRequest(toolName: string): Promise<boolean> {
    try {
      console.log(`🔍 [ProviderRESTService] Checking if can handle: ${toolName}`);
      const { serverHash } = parseFunctionName(toolName);
      const server = await this.findRestServerByHash(serverHash);
      const canHandle = server !== undefined;
      console.log(`🔍 [ProviderRESTService] Can handle ${toolName}: ${canHandle}`);
      return canHandle;
    } catch (error) {
      console.log(`🔍 [ProviderRESTService] Error checking ${toolName}: ${error}`);
      return false;
    }
  }

  /**
   * Find REST server configuration by hash
   * @param serverHash - Server hash to find
   * @returns Server configuration or undefined if not found
   */
  private async findRestServerByHash(serverHash: string): Promise<RESTServer | undefined> {
    const config = await this.configProvider.getProvidersConfig();
    const restServers = config.restServers || [];

    return restServers.find((server) => {
      if (!server.config) {
        return false;
      }
      const expectedHash = generateServerHash(server.identifier, server.config.url);
      return expectedHash === serverHash;
    });
  }

  /**
   * Get tools from a specific REST server
   * @param serverIdentifier - The identifier of the REST server
   * @returns Promise resolving to array of tool definitions for the server
   * @throws Error if server is not found
   */
  private async getRESTTools(serverIdentifier: string): Promise<ToolDefinition[]> {
    const config = await this.configProvider.getProvidersConfig();
    const restServer = config.restServers?.find((s) => s.identifier === serverIdentifier);

    if (!restServer) {
      throw new Error(`REST server not found: ${serverIdentifier}`);
    }

    return restServer.endPoints.map((endpoint) => this.createToolDefinition(restServer, endpoint));
  }

  /**
   * Create a tool definition from REST server and endpoint configuration
   * @param restServer - The REST server configuration
   * @param endpoint - The endpoint configuration
   * @returns Tool definition for the endpoint
   */
  private createToolDefinition(restServer: RESTServer, endpoint: RESTEndpoint): ToolDefinition {
    if (!restServer.config) {
      throw new Error(`REST server ${restServer.identifier} missing config`);
    }
    const { properties, required } = this.buildToolParameters(endpoint);

    return {
      name: generateFunctionName(
        restServer.identifier,
        restServer.config.url,
        toSnakeCase(endpoint.name)
      ),
      description: endpoint.description,
      parameters: {
        type: 'object',
        properties,
        required,
      },
    };
  }

  /**
   * Build tool parameters from endpoint configuration
   * @param endpoint - The endpoint configuration
   * @returns Object containing properties and required parameter arrays
   */
  private buildToolParameters(endpoint: RESTEndpoint): {
    properties: Record<string, JSONValue>;
    required: string[];
  } {
    const properties: Record<string, JSONValue> = {};
    const required: string[] = [];

    this.addPathParameters(endpoint, properties, required);
    this.addQueryParameters(endpoint, properties);
    this.addPayloadParameters(endpoint, properties);

    return { properties, required };
  }

  /**
   * Add path parameters to tool definition
   * @param endpoint - The endpoint configuration
   * @param properties - Properties object to modify
   * @param required - Required parameters array to modify
   */
  private addPathParameters(
    endpoint: RESTEndpoint,
    properties: Record<string, JSONValue>,
    required: string[]
  ): void {
    const pathParamMatches = endpoint.path.match(/\{(\w+)\}/g);
    if (!pathParamMatches) return;

    for (const match of pathParamMatches) {
      const paramName = match.slice(1, -1); // Remove { and }

      // Check if this path parameter has a specific definition in the endpoint
      const paramDefinition = (endpoint as any)[paramName]; // eslint-disable-line @typescript-eslint/no-explicit-any -- Dynamic path parameter access
      if (paramDefinition && typeof paramDefinition === 'object') {
        properties[paramName] = paramDefinition;
      } else {
        // Default to string type if no specific definition
        properties[paramName] = { type: 'string' };
      }
      required.push(paramName);
    }
  }

  /**
   * Add query parameters to tool definition
   * @param endpoint - The endpoint configuration
   * @param properties - Properties object to modify
   */
  private addQueryParameters(endpoint: RESTEndpoint, properties: Record<string, JSONValue>): void {
    // Add query parameters as an object if endpoint has query
    if (endpoint.query?.properties) {
      properties.query = {
        type: 'object',
        properties: endpoint.query.properties,
        required: endpoint.query.required || [],
      };
    }

    // Add general parameters as query object if endpoint has parameters field
    // This is for backward compatibility and simpler endpoint definitions
    if (endpoint.parameters?.properties) {
      properties.query = {
        type: 'object',
        properties: endpoint.parameters.properties,
        required: endpoint.parameters.required || [],
      };
    }
  }

  /**
   * Add payload parameters to tool definition
   * @param endpoint - The endpoint configuration
   * @param properties - Properties object to modify
   */
  private addPayloadParameters(
    endpoint: RESTEndpoint,
    properties: Record<string, JSONValue>
  ): void {
    if (endpoint.payload?.properties) {
      properties.payload = {
        type: 'object',
        properties: endpoint.payload.properties,
        required: endpoint.payload.required || [],
      };
    }
  }

  /**
   * Execute a REST tool/function
   * @param serverIdentifier - Identifier of the REST server
   * @param functionName - Name of the function to execute
   * @param parameters - Parameters for the function execution
   * @returns Promise resolving to the execution result
   * @throws Error if server or endpoint not found, or execution fails
   */
  private async executeRESTTool(
    serverIdentifier: string,
    functionName: string,
    parameters: Record<string, JSONValue>
  ): Promise<JSONValue> {
    console.log(`🌐 [RESTService] Executing REST tool: ${serverIdentifier}.${functionName}`);

    const { restServer, endpoint } = await this.getServerAndEndpoint(
      serverIdentifier,
      functionName
    );

    try {
      const requestConfig = await this.buildRequestConfiguration(endpoint, restServer, parameters);
      const response = await this.executeHttpRequest(requestConfig);

      console.log(`✅ [RESTService] REST call successful`);

      // Apply response transformations if configured
      if (endpoint.response_transform && endpoint.response_transform.length > 0) {
        console.log(
          `🔄 [RESTService] Applying ${endpoint.response_transform.length} response transformations`
        );
        const transformedData = transformResponse(response.data, endpoint.response_transform);
        return transformedData;
      }

      return response.data;
    } catch (error) {
      console.error(`❌ [RESTService] REST call failed:`, error);
      throw new Error(
        `REST execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get REST server and endpoint configurations
   * @param serverIdentifier - Identifier of the REST server
   * @param functionName - Name of the function/endpoint
   * @returns Object containing server and endpoint configurations
   * @throws Error if server or endpoint not found
   */
  private async getServerAndEndpoint(
    serverIdentifier: string,
    functionName: string
  ): Promise<{ restServer: RESTServer; endpoint: RESTEndpoint }> {
    const config = await this.configProvider.getProvidersConfig();
    const restServer = config.restServers?.find((s) => s.identifier === serverIdentifier);

    if (!restServer) {
      throw new Error(`REST server not found: ${serverIdentifier}`);
    }

    const endpoint = restServer.endPoints.find((ep) => toSnakeCase(ep.name) === functionName);
    if (!endpoint) {
      throw new Error(`REST endpoint not found: ${functionName} in server ${serverIdentifier}`);
    }

    return { restServer, endpoint };
  }

  /**
   * Build HTTP request configuration from endpoint and parameters
   * @param endpoint - The endpoint configuration
   * @param restServer - The REST server configuration
   * @param parameters - The request parameters
   * @returns Promise resolving to request configuration object
   */
  private async buildRequestConfiguration(
    endpoint: RESTEndpoint,
    restServer: RESTServer,
    parameters: Record<string, JSONValue>
  ): Promise<{
    url: string;
    method: string;
    headers: Record<string, string>;
    data?: Record<string, JSONValue>;
  }> {
    const { pathParams, remainingParams } = this.extractPathParameters(endpoint, parameters);
    const url = this.buildRequestUrl(endpoint, restServer, pathParams, remainingParams);
    const headers = await this.buildRequestHeaders(endpoint, restServer);
    const body = this.extractRequestBody(endpoint, remainingParams);

    const requestConfig: {
      url: string;
      method: string;
      headers: Record<string, string>;
      data?: Record<string, JSONValue>;
    } = {
      url,
      method: endpoint.method,
      headers,
    };

    if (body) {
      requestConfig.data = body;
    }

    return requestConfig;
  }

  /**
   * Extract path parameters from request parameters
   * @param endpoint - The endpoint configuration
   * @param parameters - The request parameters
   * @returns Object containing path parameters and remaining parameters
   */
  private extractPathParameters(
    endpoint: RESTEndpoint,
    parameters: Record<string, JSONValue>
  ): {
    pathParams: Record<string, string>;
    remainingParams: Record<string, JSONValue>;
  } {
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

    return { pathParams, remainingParams };
  }

  /**
   * Build the complete request URL with path parameters and query string
   * @param endpoint - The endpoint configuration
   * @param restServer - The REST server configuration
   * @param pathParams - Path parameters to replace in URL
   * @param remainingParams - Remaining parameters for query string
   * @returns Complete request URL
   */
  private buildRequestUrl(
    endpoint: RESTEndpoint,
    restServer: RESTServer,
    pathParams: Record<string, string>,
    remainingParams: Record<string, JSONValue>
  ): string {
    const pathWithParams = replacePathParameters(endpoint.path, pathParams);
    const fullUrl = `${restServer.config.url}${pathWithParams}`;

    const queryParams = this.extractQueryParameters(remainingParams);
    const queryString = this.buildQueryString(queryParams);

    return queryString ? `${fullUrl}?${queryString}` : fullUrl;
  }

  /**
   * Extract query parameters from remaining parameters
   * @param remainingParams - Parameters remaining after path extraction
   * @returns Query parameters as string key-value pairs
   */
  private extractQueryParameters(
    remainingParams: Record<string, JSONValue>
  ): Record<string, string> {
    if (
      remainingParams.query &&
      typeof remainingParams.query === 'object' &&
      remainingParams.query !== null
    ) {
      return convertToQueryParams(remainingParams.query as Record<string, JSONValue>);
    }
    return {};
  }

  /**
   * Build query string from query parameters
   * @param queryParams - Query parameters as key-value pairs
   * @returns URL-encoded query string
   */
  private buildQueryString(queryParams: Record<string, string>): string {
    return Object.entries(queryParams)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }

  /**
   * Build request headers from endpoint and server configurations
   * @param endpoint - The endpoint configuration
   * @param restServer - The REST server configuration
   * @returns Promise resolving to headers object
   */
  private async buildRequestHeaders(
    endpoint: RESTEndpoint,
    restServer: RESTServer
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...restServer.config.defaultHeaders,
      ...endpoint.headers,
    };

    // Add JWT authentication if configured
    if (restServer.config.auth?.type === 'jwt') {
      const token = await jwtHelper.getToken(restServer.config.auth.config);
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Extract request body from remaining parameters
   * @param endpoint - The endpoint configuration
   * @param remainingParams - Parameters remaining after path extraction
   * @returns Request body or null if no payload
   */
  private extractRequestBody(
    endpoint: RESTEndpoint,
    remainingParams: Record<string, JSONValue>
  ): Record<string, JSONValue> | null {
    if (
      endpoint.payload &&
      remainingParams.payload &&
      typeof remainingParams.payload === 'object' &&
      remainingParams.payload !== null
    ) {
      return remainingParams.payload as Record<string, JSONValue>;
    }
    return null;
  }

  /**
   * Execute the HTTP request
   * @param requestConfig - Request configuration
   * @returns Promise resolving to the HTTP response
   * @throws Error if request fails
   */
  private async executeHttpRequest(requestConfig: {
    url: string;
    method: string;
    headers: Record<string, string>;
    data?: Record<string, JSONValue>;
  }): Promise<{ status: number; statusText: string; data: JSONValue }> {
    console.log(`🚀 [RESTService] Calling ${requestConfig.method} ${requestConfig.url}`);

    const requestOptions: {
      method: string;
      headers: Record<string, string>;
      data?: Record<string, JSONValue>;
    } = {
      method: requestConfig.method,
      headers: requestConfig.headers,
    };

    if (requestConfig.data) {
      requestOptions.data = requestConfig.data;
    }

    const response = await fetchWithDefaultTimeout(requestConfig.url, requestOptions);

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`REST call failed with status ${response.status}: ${response.statusText}`);
    }

    return response;
  }
}

// Export the class for dependency injection and a default instance for backward compatibility
export { ProviderRESTService };
export default new ProviderRESTService(providersRepository);
