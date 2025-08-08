import type { McpServerConfig } from '../model/providers.js';
import type { MCPTransport } from '../interface/mcp-transport.js';
import { HttpMCPTransport } from '../transport/mcp/http-mcp-transport.js';
import { StdioMCPTransport } from '../transport/mcp/stdio-mcp-transport.js';
import { SseMCPTransport } from '../transport/mcp/sse-mcp-transport.js';
import { AutoSseHttpTransport } from '../transport/mcp/auto-sse-http-mcp-transport.js';

/**
 * Auto transport that prefers SSE and falls back to HTTP if SSE initialization fails.
 * Triggered when a URL-based MCP server omits an explicit transport field.
 */

/**
 * Factory for creating MCP transport instances based on server configuration
 */
export class MCPTransportFactory {
  /**
   * Create an MCP transport instance for the given server configuration
   * @param serverId - Server identifier
   * @param server - Server configuration
   * @returns Appropriate MCP transport instance
   * @throws Error if transport type is not supported
   */
  static createTransport(serverId: string, server: McpServerConfig): MCPTransport {
    // Determine transport type based on server configuration
    if ('command' in server) {
      return new StdioMCPTransport();
    } else if ('url' in server) {
      // If transport not specified, attempt SSE then fallback to HTTP automatically
      if (!server.transport) {
        return new AutoSseHttpTransport();
      }
      switch (server.transport) {
        case 'http':
          return new HttpMCPTransport();
        case 'sse':
          return new SseMCPTransport();
        default:
          throw new Error(
            `Transport ${server.transport} is not yet implemented. Currently supported: http, stdio, sse`
          );
      }
    } else {
      throw new Error(
        `Invalid server configuration: missing 'command' (stdio) or 'url' (http/sse) property`
      );
    }
  }

  /**
   * Get list of supported transport types
   */
  static getSupportedTransports(): string[] {
    return ['http', 'stdio', 'sse'];
  }

  /**
   * Check if a transport type is supported
   * @param transport - Transport type to check
   */
  static isTransportSupported(transport: string): boolean {
    return this.getSupportedTransports().includes(transport);
  }
}
