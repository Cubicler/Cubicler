import type { MCPRequest, MCPResponse } from '../model/types.js';

/**
 * Interface for MCP handling capabilities
 * Provides methods for processing MCP protocol requests and initialization
 */
export interface MCPHandling {
  /**
   * Initialize the MCP service and all its providers
   * @returns Promise that resolves when initialization is complete
   * @throws Error if initialization fails
   */
  initialize(): Promise<void>;

  /**
   * Handle an MCP protocol request
   * @param request - The MCP request to process
   * @returns Promise that resolves to the MCP response
   * @throws Error if the request cannot be processed
   */
  handleMCPRequest(request: MCPRequest): Promise<MCPResponse>;
}
