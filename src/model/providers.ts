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
 * HTTP transport configuration for MCP servers
 */
export interface McpHttpTransportConfig {
  url: string;
  headers?: Record<string, string>;
}

/**
 * SSE transport configuration for MCP servers
 */
export interface McpSseTransportConfig {
  url: string;
  headers?: Record<string, string>;
}

/**
 * WebSocket transport configuration for MCP servers
 */
export interface McpWebSocketTransportConfig {
  url: string;
  headers?: Record<string, string>;
}

/**
 * Stdio transport configuration for MCP servers
 */
export interface McpStdioTransportConfig {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

/**
 * Union type for all MCP transport configurations
 */
export type McpTransportConfig =
  | McpHttpTransportConfig
  | McpSseTransportConfig
  | McpWebSocketTransportConfig
  | McpStdioTransportConfig;

/**
 * Base MCP Server configuration
 */
export interface BaseMcpServer {
  identifier: string; // lowercase, no spaces, only - or _
  name: string;
  description: string;
}

/**
 * MCP Server with HTTP transport
 */
export interface HttpMcpServer extends BaseMcpServer {
  transport: 'http';
  config: McpHttpTransportConfig;
}

/**
 * MCP Server with SSE transport
 */
export interface SseMcpServer extends BaseMcpServer {
  transport: 'sse';
  config: McpSseTransportConfig;
}

/**
 * MCP Server with WebSocket transport
 */
export interface WebSocketMcpServer extends BaseMcpServer {
  transport: 'websocket';
  config: McpWebSocketTransportConfig;
}

/**
 * MCP Server with Stdio transport
 */
export interface StdioMcpServer extends BaseMcpServer {
  transport: 'stdio';
  config: McpStdioTransportConfig;
}

/**
 * Union type for all MCP server configurations
 */
export type MCPServer = HttpMcpServer | SseMcpServer | WebSocketMcpServer | StdioMcpServer;

/**
 * HTTP transport configuration for REST servers
 */
export interface RestHttpTransportConfig {
  url: string; // base URL
  defaultHeaders?: Record<string, string>;
}

/**
 * REST endpoint configuration with OpenAI schema format
 */
export interface RESTEndpoint {
  name: string; // lowercase, no spaces, only - or _
  description: string; // description of what this endpoint does
  path: string; // relative to server URL, supports {variable} placeholders
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  parameters?: {
    type: 'object';
    properties: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- OpenAI schema supports complex nested structures
    required?: string[];
  };
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
  response_transform?: ResponseTransform[]; // Array of transformations to apply to response
  // Support for individual path parameter definitions (e.g., userId: {type: "string"})
  [parameterName: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Allows dynamic path parameter definitions
}

/**
 * REST Server configuration from providers.json
 */
export interface RESTServer {
  identifier: string; // lowercase, no spaces, only - or _
  name: string;
  description: string;
  transport: 'http';
  config: RestHttpTransportConfig;
  endPoints: RESTEndpoint[];
}

/**
 * Providers configuration (JSON format)
 */
export interface ProvidersConfig {
  mcpServers?: MCPServer[];
  restServers?: RESTServer[];
}
