/**
 * MCP Server configuration from providers.json
 */
export interface MCPServer {
  identifier: string; // lowercase, no spaces, only - or _
  name: string;
  description: string;
  transport: 'http' | 'sse' | 'websocket' | 'stdio'; // start with http
  url: string;
  headers?: Record<string, string>;
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
  payload?: {
    type: 'object';
    properties: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- OpenAI schema supports complex nested structures
    required?: string[];
  };
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
