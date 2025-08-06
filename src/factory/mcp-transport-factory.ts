import type { MCPServer } from '../model/providers.js';
import type { MCPTransport } from '../interface/mcp-transport.js';
import { HttpMCPTransport } from '../transport/mcp/http-mcp-transport.js';
import { StdioMCPTransport } from '../transport/mcp/stdio-mcp-transport.js';
import { SseMCPTransport } from '../transport/mcp/sse-mcp-transport.js';

/**
 * Factory for creating MCP transport instances based on server configuration
 */
export class MCPTransportFactory {
  /**
   * Create an MCP transport instance for the given server configuration
   * @param server - Server configuration
   * @returns Appropriate MCP transport instance
   * @throws Error if transport type is not supported
   */
  static createTransport(server: MCPServer): MCPTransport {
    switch (server.transport) {
      case 'http':
        return new HttpMCPTransport();
      case 'stdio':
        return new StdioMCPTransport();
      case 'sse':
        return new SseMCPTransport();
      case 'websocket':
        throw new Error(
          `Transport ${server.transport} is not yet implemented. Currently supported: http, stdio, sse`
        );
      default:
        throw new Error(
          `Unknown transport type: ${server.transport}. Supported transports: http, stdio, sse`
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
