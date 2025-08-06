import type { MCPRequest, MCPResponse } from '../../model/types.js';
import type { MCPServer } from '../../model/providers.js';
import type { MCPTransport } from '../../interface/mcp-transport.js';
import { fetchWithDefaultTimeout } from '../../utils/fetch-helper.js';

/**
 * HTTP MCP Transport implementation
 * Handles MCP communication over HTTP protocol
 */
export class HttpMCPTransport implements MCPTransport {
  private server: MCPServer | null = null;
  private isInitialized = false;

  /**
   * Initialize the HTTP transport
   * @param server - Server configuration
   */
  async initialize(server: MCPServer): Promise<void> {
    this.validateServerConfig(server);
    this.server = server;
    this.isInitialized = true;

    console.log(`✅ [HttpMCPTransport] Initialized HTTP transport for ${server.identifier}`);
  }

  /**
   * Send a request to the MCP server via HTTP
   * @param request - MCP request to send
   * @returns Promise that resolves to MCP response
   */
  async sendRequest(request: MCPRequest): Promise<MCPResponse> {
    if (!this.server || !this.isInitialized) {
      throw new Error('HTTP transport not initialized');
    }

    console.log(
      `📡 [HttpMCPTransport] Sending HTTP request to ${this.server.identifier}:`,
      request.method
    );

    try {
      if (!('url' in this.server.config) || !this.server.config.url) {
        throw new Error('Server URL not available');
      }
      const response = await fetchWithDefaultTimeout(this.server.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...('headers' in this.server.config ? this.server.config.headers : {}),
        },
        data: request,
      });

      console.log(`✅ [HttpMCPTransport] HTTP request to ${this.server.identifier} successful`);
      return response.data as MCPResponse;
    } catch (error) {
      console.error(
        `❌ [HttpMCPTransport] HTTP request to ${this.server.identifier} failed:`,
        error
      );
      return this.createErrorResponse(request, error);
    }
  }

  /**
   * Close the HTTP transport (no-op for HTTP)
   */
  async close(): Promise<void> {
    this.isInitialized = false;
    this.server = null;
    console.log('🔄 [HttpMCPTransport] HTTP transport closed');
  }

  /**
   * Check if the transport is connected
   */
  isConnected(): boolean {
    return this.isInitialized && this.server !== null;
  }

  /**
   * Get the server identifier
   */
  getServerIdentifier(): string {
    return this.server?.identifier || 'unknown';
  }

  /**
   * Validate server configuration for HTTP transport
   * @param server - Server configuration to validate
   * @throws Error if configuration is invalid
   */
  private validateServerConfig(server: MCPServer): void {
    if (server.transport !== 'http') {
      throw new Error(`Invalid transport for HTTP transport: ${server.transport}`);
    }

    if (!server.config.url) {
      throw new Error(`HTTP transport requires URL for server ${server.identifier}`);
    }

    try {
      new URL(server.config.url);
    } catch {
      throw new Error(`Invalid URL for server ${server.identifier}: ${server.config.url}`);
    }
  }

  /**
   * Create an error response for failed requests
   * @param request - Original request
   * @param error - Error that occurred
   * @returns MCP error response
   */
  private createErrorResponse(request: MCPRequest, error: unknown): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32603, // Internal error
        message: `HTTP request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    };
  }
}
