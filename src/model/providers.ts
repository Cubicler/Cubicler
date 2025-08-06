/**
 * MCP Server configuration from providers.json
 */
export interface MCPServer {
  identifier: string; // lowercase, no spaces, only - or _
  name: string;
  description: string;
  transport: 'http' | 'sse' | 'websocket' | 'stdio'; // start with http
  url?: string; // Required for http/sse/websocket, optional for stdio
  headers?: Record<string, string>; // For HTTP transport
  command?: string; // Required for stdio transport
  args?: string[]; // Optional arguments for stdio command
  cwd?: string; // Optional working directory for stdio command
  env?: Record<string, string>; // Optional environment variables for stdio command
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
  url: string; // base URL
  defaultHeaders?: Record<string, string>;
  endPoints: RESTEndpoint[];
}

/**
 * Providers configuration (JSON format)
 */
export interface ProvidersConfig {
  mcpServers?: MCPServer[];
  restServers?: RESTServer[];
}
