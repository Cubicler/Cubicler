/**
 * JWT authentication configuration for providers
 */
export interface ProviderJwtAuthConfig {
  token?: string; // Static token
  tokenUrl?: string; // URL to fetch token
  clientId?: string; // For OAuth2 client credentials
  clientSecret?: string; // For OAuth2 client credentials
  audience?: string; // JWT audience claim
  refreshThreshold?: number; // Minutes before expiry to refresh (default: 5)
}

/**
 * Response transformation configuration
 */
export interface ResponseTransform {
  path: string; // JSON path: "some.property", "_root[]", "some[].property", etc.
  transform: 'map' | 'date_format' | 'template' | 'regex_replace' | 'remove';
  map?: Record<string, string>; // For map transform
  format?: string; // For date_format transform
  template?: string; // For template transform, use {value} for original value
  pattern?: string; // For regex_replace transform
  replacement?: string; // For regex_replace transform
}

/**
 * Base MCP Server configuration (native MCP format)
 */
export interface BaseMcpServerConfig {
  name: string;
  description: string;
}

/**
 * STDIO MCP Server configuration (native MCP format)
 */
export interface StdioMcpServerConfig extends BaseMcpServerConfig {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

/**
 * HTTP/SSE MCP Server configuration (native MCP format)
 */
export interface HttpMcpServerConfig extends BaseMcpServerConfig {
  transport?: 'http' | 'sse'; // Optional, auto-detected from URL if not specified
  url: string;
  headers?: Record<string, string>;
  auth?: {
    type: 'jwt';
    config: ProviderJwtAuthConfig;
  };
}

/**
 * Union type for MCP server configurations
 */
export type McpServerConfig = StdioMcpServerConfig | HttpMcpServerConfig;

/**
 * MCP Servers collection (native MCP format - keyed by identifier)
 */
export type MCPServers = Record<string, McpServerConfig>;

/**
 * REST endpoint configuration (native format)
 */
export interface RESTEndpoint {
  name: string;
  description: string;
  path: string; // relative to server URL, supports {variable} placeholders
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  query?: {
    type: 'object';
    properties: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- OpenAI schema supports complex nested structures
    required?: string[];
  };
  payload?: {
    type: 'object';
    properties: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- OpenAI schema supports complex nested structures
    required?: string[];
  };
  response_transform?: ResponseTransform[];
}

/**
 * REST Server configuration (native format)
 */
export interface RESTServerConfig {
  name: string;
  description: string;
  url: string; // base URL
  defaultHeaders?: Record<string, string>;
  auth?: {
    type: 'jwt';
    config: ProviderJwtAuthConfig;
  };
  endpoints: Record<string, RESTEndpoint>; // keyed by endpoint identifier
}

/**
 * REST Servers collection (native format - keyed by identifier)
 */
export type RESTServers = Record<string, RESTServerConfig>;

/**
 * Providers configuration (native MCP format)
 */
export interface ProvidersConfig {
  mcpServers: MCPServers;
  restServers: RESTServers;
}

/**
 * @deprecated Legacy MCPServer type for backward compatibility
 * Use McpServerConfig with serverId separately instead
 */
export interface MCPServer {
  identifier: string;
  name: string;
  description: string;
  transport: 'http' | 'sse' | 'websocket' | 'stdio';
  config: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- legacy compatibility
}
