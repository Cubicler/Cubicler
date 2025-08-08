import type { MCPRequest, MCPResponse } from '../../model/types.js';
import type { HttpMcpServerConfig } from '../../model/providers.js';
import type { MCPTransport } from '../../interface/mcp-transport.js';
import { fetchWithDefaultTimeout } from '../../utils/fetch-helper.js';
import jwtHelper from '../../utils/jwt-helper.js';

/**
 * HTTP MCP Transport implementation
 * Handles MCP communication over HTTP protocol
 */
export class HttpMCPTransport implements MCPTransport {
  private serverId: string | null = null;
  private server: HttpMcpServerConfig | null = null;
  private isInitialized = false;

  /**
   * Initialize the HTTP transport
   * @param serverId - Server identifier
   * @param server - Server configuration
   */
  async initialize(serverId: string, server: HttpMcpServerConfig): Promise<void> {
    this.validateServerConfig(serverId, server);
    this.serverId = serverId;
    this.server = server;
    this.isInitialized = true;

    console.log(`✅ [HttpMCPTransport] Initialized HTTP transport for ${serverId}`);
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

    console.log(`📡 [HttpMCPTransport] Sending HTTP request to ${this.serverId}:`, request.method);

    try {
      if (!this.server.url) {
        throw new Error('Server URL not available');
      }
      const headers = await this.buildHeaders();
      const response = await fetchWithDefaultTimeout(this.server.url, {
        method: 'POST',
        headers,
        data: request,
      });

      console.log(`✅ [HttpMCPTransport] HTTP request to ${this.serverId} successful`);
      return response.data as MCPResponse;
    } catch (error) {
      console.error(`❌ [HttpMCPTransport] HTTP request to ${this.serverId} failed:`, error);
      return this.createErrorResponse(request, error);
    }
  }

  /**
   * Close the HTTP transport (no-op for HTTP)
   */
  async close(): Promise<void> {
    this.isInitialized = false;
    this.serverId = null;
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
    return this.serverId || 'unknown';
  }

  /**
   * Build HTTP headers including JWT authentication if configured
   * @returns Promise that resolves to headers object
   * @throws Error if JWT token cannot be obtained
   */
  private async buildHeaders(): Promise<Record<string, string>> {
    if (!this.server) {
      throw new Error('Server not configured');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.server.headers,
    };

    if (this.server.auth?.type === 'jwt') {
      const token = await jwtHelper.getToken(this.server.auth.config);
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Validate server configuration for HTTP transport
   * @param serverId - Server identifier
   * @param server - Server configuration to validate
   * @throws Error if configuration is invalid
   */
  private validateServerConfig(serverId: string, server: HttpMcpServerConfig): void {
    if (!server.url) {
      throw new Error(`HTTP transport requires URL for server ${serverId}`);
    }

    try {
      new URL(server.url);
    } catch {
      throw new Error(`Invalid URL for server ${serverId}: ${server.url}`);
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
