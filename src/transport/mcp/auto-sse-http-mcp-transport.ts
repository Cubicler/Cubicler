import type { MCPTransport } from '../../interface/mcp-transport.js';
import type { McpServerConfig } from '../../model/providers.js';
import type { MCPRequest, MCPResponse } from '../../model/types.js';
import { SseMCPTransport } from './sse-mcp-transport.js';
import { HttpMCPTransport } from './http-mcp-transport.js';

/**
 * Auto transport that prefers SSE and falls back to HTTP if SSE initialization fails.
 * Activated when a URL-based MCP server omits an explicit transport value.
 */
export class AutoSseHttpTransport implements MCPTransport {
  private chosen: MCPTransport | null = null;
  private serverId: string | null = null;
  private server: McpServerConfig | null = null;

  /**
   * Initialize by attempting SSE first, then falling back to HTTP.
   */
  async initialize(serverId: string, server: McpServerConfig): Promise<void> {
    this.serverId = serverId;
    this.server = server;

    if (!('url' in server)) {
      throw new Error('AutoSseHttpTransport can only be used with URL-based MCP servers');
    }

    // Attempt SSE first
    const sse = new SseMCPTransport();
    try {
      console.log(`🔄 [AutoSseHttpTransport] Attempting SSE transport for ${serverId} (auto)`);
      await sse.initialize(serverId, server);
      this.chosen = sse;
      console.log(`✅ [AutoSseHttpTransport] Using SSE transport for ${serverId}`);
      return;
    } catch (error) {
      console.warn(
        `⚠️ [AutoSseHttpTransport] SSE initialization failed for ${serverId}, falling back to HTTP:`,
        error
      );
    }

    // Fallback to HTTP
    const http = new HttpMCPTransport();
    try {
      await http.initialize(serverId, server);
      this.chosen = http;
      console.log(`✅ [AutoSseHttpTransport] Using HTTP transport for ${serverId}`);
    } catch (error) {
      throw new Error(
        `Both SSE and HTTP initialization failed for ${serverId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async sendRequest(request: MCPRequest): Promise<MCPResponse> {
    if (!this.chosen) {
      throw new Error('AutoSseHttpTransport not initialized');
    }
    return this.chosen.sendRequest(request);
  }

  async close(): Promise<void> {
    if (this.chosen) {
      await this.chosen.close();
    }
    this.chosen = null;
    this.serverId = null;
    this.server = null;
  }

  isConnected(): boolean {
    return this.chosen?.isConnected() || false;
  }

  getServerIdentifier(): string {
    return this.chosen?.getServerIdentifier() || this.serverId || 'unknown';
  }
}

export default AutoSseHttpTransport;
