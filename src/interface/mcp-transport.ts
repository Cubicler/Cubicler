import type { MCPRequest, MCPResponse } from '../model/types.js';
import type { McpServerConfig } from '../model/providers.js';

/**
 * Interface for MCP transport implementations
 * Handles communication with MCP servers regardless of transport protocol
 */
export interface MCPTransport {
  /**
   * Initialize the transport connection
   * @param _serverId - Server identifier
   * @param _server - Server configuration
   */
  initialize(_serverId: string, _server: McpServerConfig): Promise<void>;

  /**
   * Send a request to the MCP server
   * @param _request - MCP request to send
   * @returns Promise that resolves to MCP response
   */
  sendRequest(_request: MCPRequest): Promise<MCPResponse>;

  /**
   * Close the transport connection
   */
  close(): Promise<void>;

  /**
   * Check if the transport is connected/available
   */
  isConnected(): boolean;

  /**
   * Get the server identifier this transport is connected to
   */
  getServerIdentifier(): string;
}
