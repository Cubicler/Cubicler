import { describe, it, expect } from 'vitest';
import { MCPTransportFactory } from '../../src/factory/mcp-transport-factory.js';
import { HttpMCPTransport } from '../../src/transport/mcp/http-mcp-transport.js';
import { StdioMCPTransport } from '../../src/transport/mcp/stdio-mcp-transport.js';
import { SseMCPTransport } from '../../src/transport/mcp/sse-mcp-transport.js';
import type { MCPServer } from '../../src/model/providers.js';

describe('MCP Transport Factory', () => {
  describe('createTransport', () => {
    it('should create HTTP transport for http transport type', () => {
      const server: MCPServer = {
        identifier: 'test_server',
        name: 'Test Server',
        description: 'Test HTTP server',
        transport: 'http',
        config: {
          url: 'http://localhost:4000/mcp',
        },
      };

      const transport = MCPTransportFactory.createTransport(server);

      expect(transport).toBeInstanceOf(HttpMCPTransport);
    });

    it('should create Stdio transport for stdio transport type', () => {
      const server: MCPServer = {
        identifier: 'test_server',
        name: 'Test Server',
        description: 'Test stdio server',
        transport: 'stdio',
        config: {
          command: '/usr/local/bin/test-server',
        },
      };

      const transport = MCPTransportFactory.createTransport(server);

      expect(transport).toBeInstanceOf(StdioMCPTransport);
    });

    it('should create SSE transport for sse transport type', () => {
      const server: MCPServer = {
        identifier: 'test_server',
        name: 'Test Server',
        description: 'Test SSE server',
        transport: 'sse',
        config: {
          url: 'http://localhost:4000/sse',
        },
      };

      const transport = MCPTransportFactory.createTransport(server);

      expect(transport).toBeInstanceOf(SseMCPTransport);
    });

    it('should throw error for unsupported websocket transport', () => {
      const server = {
        identifier: 'test_server',
        name: 'Test Server',
        description: 'Test WebSocket server',
        transport: 'websocket',
        config: {
          url: 'ws://localhost:4000/ws',
        },
      } as unknown as MCPServer;

      expect(() => MCPTransportFactory.createTransport(server)).toThrow(
        'Transport websocket is not yet implemented. Currently supported: http, stdio, sse'
      );
    });

    it('should throw error for unknown transport type', () => {
      const server = {
        identifier: 'test_server',
        name: 'Test Server',
        description: 'Test unknown server',
        transport: 'unknown',
        config: {
          url: 'unknown://localhost:4000',
        },
      } as unknown as MCPServer;

      expect(() => MCPTransportFactory.createTransport(server)).toThrow(
        'Unknown transport type: unknown. Supported transports: http, stdio, sse'
      );
    });
  });

  describe('getSupportedTransports', () => {
    it('should return list of supported transports', () => {
      const supportedTransports = MCPTransportFactory.getSupportedTransports();

      expect(supportedTransports).toEqual(['http', 'stdio', 'sse']);
    });

    it('should return immutable list', () => {
      const supportedTransports1 = MCPTransportFactory.getSupportedTransports();
      const supportedTransports2 = MCPTransportFactory.getSupportedTransports();

      // Should return new arrays each time (defensive copying)
      expect(supportedTransports1).toEqual(supportedTransports2);
      expect(supportedTransports1).not.toBe(supportedTransports2);
    });
  });

  describe('isTransportSupported', () => {
    it('should return true for supported transport types', () => {
      expect(MCPTransportFactory.isTransportSupported('http')).toBe(true);
      expect(MCPTransportFactory.isTransportSupported('stdio')).toBe(true);
      expect(MCPTransportFactory.isTransportSupported('sse')).toBe(true);
    });

    it('should return false for unsupported transport types', () => {
      expect(MCPTransportFactory.isTransportSupported('websocket')).toBe(false);
      expect(MCPTransportFactory.isTransportSupported('unknown')).toBe(false);
      expect(MCPTransportFactory.isTransportSupported('')).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(MCPTransportFactory.isTransportSupported('HTTP')).toBe(false);
      expect(MCPTransportFactory.isTransportSupported('Http')).toBe(false);
      expect(MCPTransportFactory.isTransportSupported('STDIO')).toBe(false);
    });
  });
});
