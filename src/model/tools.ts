import type { JSONValue, JSONObject } from './types.js';

/**
 * Tool definition for Cubicler tools
 */
export interface ToolDefinition extends JSONObject {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, JSONValue>;
    required?: string[];
  };
}

/**
 * Parameters for tool calls
 */
export interface ToolCallParameters extends JSONObject {
  // Any JSON object structure for tool parameters
}

/**
 * Result of tool execution
 */
export type ToolCallResult = JSONValue;

/**
 * Response for cubicler.fetch_server_tools
 */
export interface ServerToolsResponse extends JSONObject {
  tools: ToolDefinition[];
}

/**
 * MCP Tool definition (from MCP protocol)
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, JSONValue>;
    required?: string[];
  };
}

/**
 * MCP formatted tool for protocol responses
 */
export interface MCPFormattedTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, JSONValue>;
    required?: string[];
  };
}

/**
 * Available servers response for cubicler.available_servers
 */
export interface AvailableServersResponse extends JSONObject {
  total: number;
  servers: ServerInfo[];
}

/**
 * Server information
 */
export interface ServerInfo extends JSONObject {
  identifier: string;
  name: string;
  description: string;
  toolsCount: number;
}
