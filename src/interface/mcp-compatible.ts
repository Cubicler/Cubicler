import type { JSONObject, JSONValue } from '../model/types.js';
import { ToolsListProviding } from './tools-list-providing.js';

/**
 * Interface for services that can handle MCP protocol requests
 * Extends ToolsListProviding to ensure all MCP services can provide tools
 */
export interface MCPCompatible extends ToolsListProviding {
  /**
   * Initialize the service (called when MCP client sends initialize request)
   */
  initialize(): Promise<void>;

  /**
   * Execute a tool/function call
   */
  toolsCall(toolName: string, parameters: JSONObject): Promise<JSONValue>;

  /**
   * Check if this service can handle the given request/tool
   */
  canHandleRequest(toolName: string): Promise<boolean>;
}
