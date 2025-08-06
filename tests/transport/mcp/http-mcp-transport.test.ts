import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MCPRequest } from '../../../src/model/types.js';
import type { MCPServer } from '../../../src/model/providers.js';
import { HttpMCPTransport } from '../../../src/transport/mcp/http-mcp-transport.js';
import { fetchWithDefaultTimeout } from '../../../src/utils/fetch-helper.js';
import type { AxiosResponse } from 'axios';

// Mock dependencies
vi.mock('../../../src/utils/fetch-helper.js');

const mockedFetchWithDefaultTimeout = vi.mocked(fetchWithDefaultTimeout);

describe('HttpMCPTransport', () => {
  let transport: HttpMCPTransport;
  let mockServer: MCPServer;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServer = {
      identifier: 'test-http-server',
      name: 'Test HTTP Server',
      description: 'Test HTTP MCP server',
      transport: 'http',
      config: {
        url: 'https://api.example.com/mcp',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      },
    };

    transport = new HttpMCPTransport();
  });

  describe('initialize', () => {
    it('should initialize with valid HTTP server config', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await transport.initialize(mockServer);

      expect(transport.isConnected()).toBe(true);
      expect(transport.getServerIdentifier()).toBe('test-http-server');
      expect(consoleSpy).toHaveBeenCalledWith(
        '✅ [HttpMCPTransport] Initialized HTTP transport for test-http-server'
      );

      consoleSpy.mockRestore();
    });

    it('should throw error for invalid transport type', async () => {
      const invalidServer = { ...mockServer, transport: 'stdio' as any };

      await expect(transport.initialize(invalidServer)).rejects.toThrow(
        'Invalid transport for HTTP transport: stdio'
      );
    });

    it('should throw error for missing URL', async () => {
      const invalidServer = {
        ...mockServer,
        config: { ...mockServer.config, url: undefined },
      } as unknown as MCPServer;

      await expect(transport.initialize(invalidServer)).rejects.toThrow(
        'HTTP transport requires URL for server test-http-server'
      );
    });

    it('should throw error for invalid URL format', async () => {
      const invalidServer = {
        ...mockServer,
        config: { ...mockServer.config, url: 'not-a-valid-url' },
      } as MCPServer;

      await expect(transport.initialize(invalidServer)).rejects.toThrow(
        'Invalid URL for server test-http-server: not-a-valid-url'
      );
    });

    it('should accept server config without headers', async () => {
      const serverWithoutHeaders = {
        ...mockServer,
        config: { url: (mockServer.config as any).url },
      } as MCPServer;

      await expect(transport.initialize(serverWithoutHeaders)).resolves.not.toThrow();
      expect(transport.isConnected()).toBe(true);
    });

    it('should accept various valid URL formats', async () => {
      const urlVariations = [
        'http://localhost:3000/mcp',
        'https://api.example.com/v1/mcp',
        'https://subdomain.example.com:8080/path/to/mcp',
        'http://127.0.0.1:5000/mcp',
      ];

      for (const url of urlVariations) {
        const server = { ...mockServer, url };
        const newTransport = new HttpMCPTransport();

        await expect(newTransport.initialize(server)).resolves.not.toThrow();
        expect(newTransport.getServerIdentifier()).toBe('test-http-server');
      }
    });
  });

  describe('sendRequest', () => {
    beforeEach(async () => {
      await transport.initialize(mockServer);
    });

    it('should send request successfully and return response', async () => {
      const mockAxiosResponse: AxiosResponse = {
        data: {
          jsonrpc: '2.0',
          id: 1,
          result: { success: true, data: 'test response' },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as AxiosResponse;

      mockedFetchWithDefaultTimeout.mockResolvedValue(mockAxiosResponse);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const response = await transport.sendRequest(request);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true, data: 'test response' },
      });

      expect(mockedFetchWithDefaultTimeout).toHaveBeenCalledWith('https://api.example.com/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        data: request,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '📡 [HttpMCPTransport] Sending HTTP request to test-http-server:',
        'tools/list'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        '✅ [HttpMCPTransport] HTTP request to test-http-server successful'
      );

      consoleSpy.mockRestore();
    });

    it('should handle HTTP request failure and return error response', async () => {
      const httpError = new Error('Network error');
      mockedFetchWithDefaultTimeout.mockRejectedValue(httpError);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'test-tool' },
      };

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await transport.sendRequest(request);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 2,
        error: {
          code: -32603,
          message: 'HTTP request failed: Network error',
        },
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ [HttpMCPTransport] HTTP request to test-http-server failed:',
        httpError
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle unknown error types', async () => {
      const unknownError = 'String error';
      mockedFetchWithDefaultTimeout.mockRejectedValue(unknownError);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 3,
        method: 'ping',
      };

      const response = await transport.sendRequest(request);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 3,
        error: {
          code: -32603,
          message: 'HTTP request failed: Unknown error',
        },
      });
    });

    it('should throw error when not initialized', async () => {
      const uninitializedTransport = new HttpMCPTransport();

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      };

      await expect(uninitializedTransport.sendRequest(request)).rejects.toThrow(
        'HTTP transport not initialized'
      );
    });

    it('should include server headers in request', async () => {
      const serverWithCustomHeaders = {
        ...mockServer,
        config: {
          ...mockServer.config,
          headers: {
            Authorization: 'Bearer custom-token',
            'X-Custom-Header': 'custom-value',
            'User-Agent': 'Cubicler/1.0',
          },
        },
      };

      await transport.initialize(serverWithCustomHeaders as MCPServer);

      const mockAxiosResponse: AxiosResponse = {
        data: { jsonrpc: '2.0', id: 1, result: {} },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as AxiosResponse;

      mockedFetchWithDefaultTimeout.mockResolvedValue(mockAxiosResponse);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      };

      await transport.sendRequest(request);

      expect(mockedFetchWithDefaultTimeout).toHaveBeenCalledWith('https://api.example.com/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer custom-token',
          'X-Custom-Header': 'custom-value',
          'User-Agent': 'Cubicler/1.0',
        },
        data: request,
      });
    });

    it('should work without server headers', async () => {
      const serverWithoutHeaders = {
        ...mockServer,
        config: {
          url: (mockServer.config as any).url,
        },
      } as MCPServer;

      await transport.initialize(serverWithoutHeaders);

      const mockAxiosResponse: AxiosResponse = {
        data: { jsonrpc: '2.0', id: 1, result: {} },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as AxiosResponse;

      mockedFetchWithDefaultTimeout.mockResolvedValue(mockAxiosResponse);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      };

      await transport.sendRequest(request);

      expect(mockedFetchWithDefaultTimeout).toHaveBeenCalledWith('https://api.example.com/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        data: request,
      });
    });
  });

  describe('close', () => {
    it('should close transport successfully', async () => {
      await transport.initialize(mockServer);
      expect(transport.isConnected()).toBe(true);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await transport.close();

      expect(transport.isConnected()).toBe(false);
      expect(transport.getServerIdentifier()).toBe('unknown');
      expect(consoleSpy).toHaveBeenCalledWith('🔄 [HttpMCPTransport] HTTP transport closed');

      consoleSpy.mockRestore();
    });

    it('should handle close when not initialized', async () => {
      expect(transport.isConnected()).toBe(false);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await transport.close();

      expect(transport.isConnected()).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('🔄 [HttpMCPTransport] HTTP transport closed');

      consoleSpy.mockRestore();
    });
  });

  describe('isConnected', () => {
    it('should return false when not initialized', () => {
      expect(transport.isConnected()).toBe(false);
    });

    it('should return true when initialized', async () => {
      await transport.initialize(mockServer);
      expect(transport.isConnected()).toBe(true);
    });

    it('should return false after close', async () => {
      await transport.initialize(mockServer);
      expect(transport.isConnected()).toBe(true);

      await transport.close();
      expect(transport.isConnected()).toBe(false);
    });
  });

  describe('getServerIdentifier', () => {
    it('should return unknown when not initialized', () => {
      expect(transport.getServerIdentifier()).toBe('unknown');
    });

    it('should return server identifier when initialized', async () => {
      await transport.initialize(mockServer);
      expect(transport.getServerIdentifier()).toBe('test-http-server');
    });

    it('should return unknown after close', async () => {
      await transport.initialize(mockServer);
      expect(transport.getServerIdentifier()).toBe('test-http-server');

      await transport.close();
      expect(transport.getServerIdentifier()).toBe('unknown');
    });
  });

  describe('error handling edge cases', () => {
    beforeEach(async () => {
      await transport.initialize(mockServer);
    });

    it('should handle request with missing id', async () => {
      const httpError = new Error('Bad request');
      mockedFetchWithDefaultTimeout.mockRejectedValue(httpError);

      const request = {
        jsonrpc: '2.0',
        method: 'test',
      } as MCPRequest;

      const response = await transport.sendRequest(request);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: undefined,
        error: {
          code: -32603,
          message: 'HTTP request failed: Bad request',
        },
      });
    });

    it('should handle complex error objects', async () => {
      const complexError = {
        name: 'AxiosError',
        message: 'Request failed with status code 500',
        code: 'ERR_BAD_RESPONSE',
        config: {},
        request: {},
        response: { status: 500 },
      };
      mockedFetchWithDefaultTimeout.mockRejectedValue(complexError);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      };

      const response = await transport.sendRequest(request);

      expect(response.error?.message).toBe('HTTP request failed: Unknown error');
    });
  });
});
