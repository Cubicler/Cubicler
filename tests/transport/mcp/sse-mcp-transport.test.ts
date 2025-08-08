/* eslint-disable no-undef */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SseMCPTransport } from '../../../src/transport/mcp/sse-mcp-transport.js';
import type { MCPRequest, MCPResponse } from '../../../src/model/types.js';
import type { HttpMcpServerConfig } from '../../../src/model/providers.js';
import * as fetchHelper from '../../../src/utils/fetch-helper.js';

// Mock the fetch helper
vi.mock('../../../src/utils/fetch-helper.js');

// Mock EventSource
class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  url: string;
  readyState: number = MockEventSource.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  private listeners: Map<string, ((event: any) => void)[]> = new Map();

  constructor(url: string) {
    this.url = url;
    // Simulate successful connection immediately using Promise.resolve()
    Promise.resolve().then(() => {
      this.readyState = MockEventSource.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    });
  }

  addEventListener(type: string, listener: (event: any) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }

  // Helper method to simulate receiving messages
  simulateMessage(data: any) {
    const event = new MessageEvent('message', { data: JSON.stringify(data) });
    if (this.onmessage) {
      this.onmessage(event);
    }
  }

  // Helper method to simulate custom events
  simulateCustomEvent(type: string, data: any) {
    const listeners = this.listeners.get(type);
    if (listeners) {
      const event = { data: JSON.stringify(data) };
      listeners.forEach((listener) => listener(event));
    }
  }

  // Helper method to simulate errors
  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// Replace global EventSource
(global as any).EventSource = MockEventSource;

describe('SseMCPTransport', () => {
  const serverId = 'test-sse-server';
  const mockConfig: HttpMcpServerConfig = {
    name: 'Test SSE Server',
    description: 'Test SSE MCP Server',
    url: 'http://localhost:3000',
    headers: { 'Custom-Header': 'test-value' },
  };

  let transport: SseMCPTransport;
  const mockFetchWithDefaultTimeout = vi.mocked(fetchHelper.fetchWithDefaultTimeout);

  beforeEach(() => {
    vi.clearAllMocks();
    transport = new SseMCPTransport();
  });

  describe('initialize', () => {
    it('should initialize SSE transport successfully', async () => {
      await transport.initialize(serverId, mockConfig);

      // Wait for next tick to allow Promise.resolve() to complete
      await new Promise((resolve) => process.nextTick(resolve));

      expect(transport.isConnected()).toBe(true);
      expect(transport.getServerIdentifier()).toBe('test-sse-server');
    });

    // Transport type validation removed

    it('should throw error for missing URL', async () => {
      const invalidConfig: any = { ...mockConfig };
      delete invalidConfig.url;
      await expect(transport.initialize(serverId, invalidConfig)).rejects.toThrow(
        'SSE transport requires URL for server test-sse-server'
      );
    });

    it('should throw error for invalid URL', async () => {
      const invalidConfig = { ...mockConfig, url: 'invalid-url' };
      await expect(transport.initialize(serverId, invalidConfig)).rejects.toThrow(
        'Invalid URL for server test-sse-server: invalid-url'
      );
    });
  });

  describe('sendRequest', () => {
    const mockRequest: MCPRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    };

    const mockResponse: MCPResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: { tools: [] },
    };

    beforeEach(async () => {
      await transport.initialize(serverId, mockConfig);
      // Wait for next tick to allow Promise.resolve() to complete
      await new Promise((resolve) => process.nextTick(resolve));
    });

    it('should send request and receive response via SSE', async () => {
      mockFetchWithDefaultTimeout.mockResolvedValue({
        status: 200,
        data: {},
      } as any);

      const responsePromise = transport.sendRequest(mockRequest);

      // Simulate receiving response via SSE
      setTimeout(() => {
        const eventSource = (transport as any).eventSource as MockEventSource;
        eventSource.simulateMessage(mockResponse);
      }, 50);

      const result = await responsePromise;

      expect(mockFetchWithDefaultTimeout).toHaveBeenCalledWith('http://localhost:3000/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Custom-Header': 'test-value',
        },
        data: mockRequest,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle custom mcp-response event', async () => {
      mockFetchWithDefaultTimeout.mockResolvedValue({
        status: 200,
        data: {},
      } as any);

      const responsePromise = transport.sendRequest(mockRequest);

      // Simulate receiving response via custom event
      setTimeout(() => {
        const eventSource = (transport as any).eventSource as MockEventSource;
        eventSource.simulateCustomEvent('mcp-response', mockResponse);
      }, 50);

      const result = await responsePromise;
      expect(result).toEqual(mockResponse);
    });

    it('should timeout if response not received', async () => {
      // Mock the request timeout to be very short for testing
      (transport as any).requestTimeout = 100;

      mockFetchWithDefaultTimeout.mockResolvedValue({
        status: 200,
        data: {},
      } as any);

      await expect(transport.sendRequest(mockRequest)).rejects.toThrow(
        'Request 1 timed out after 100ms'
      );
    });

    it('should throw error if transport not initialized', async () => {
      const uninitializedTransport = new SseMCPTransport();

      await expect(uninitializedTransport.sendRequest(mockRequest)).rejects.toThrow(
        'SSE transport not initialized'
      );
    });

    it('should throw error if SSE connection is not open', async () => {
      // Initialize but simulate closed connection
      await transport.initialize(serverId, mockConfig);
      const eventSource = (transport as any).eventSource as MockEventSource;
      eventSource.readyState = 2; // CLOSED

      await expect(transport.sendRequest(mockRequest)).rejects.toThrow(
        'SSE connection to test-sse-server is not open'
      );
    });

    it('should handle HTTP request failure', async () => {
      const httpError = new Error('HTTP request failed');
      mockFetchWithDefaultTimeout.mockRejectedValue(httpError);

      await expect(transport.sendRequest(mockRequest)).rejects.toThrow(
        'Failed to send SSE request: HTTP request failed'
      );
    });
  });

  describe('close', () => {
    it('should close transport and clean up resources', async () => {
      await transport.initialize(serverId, mockConfig);
      // Wait for next tick to allow Promise.resolve() to complete
      await new Promise((resolve) => process.nextTick(resolve));
      const eventSource = (transport as any).eventSource as MockEventSource;

      expect(transport.isConnected()).toBe(true);

      await transport.close();

      expect(transport.isConnected()).toBe(false);
      expect(eventSource.readyState).toBe(MockEventSource.CLOSED);
      expect(transport.getServerIdentifier()).toBe('unknown');
    });

    it('should reject pending requests when closing', async () => {
      await transport.initialize(serverId, mockConfig);
      // Wait for next tick to allow Promise.resolve() to complete
      await new Promise((resolve) => process.nextTick(resolve));

      mockFetchWithDefaultTimeout.mockResolvedValue({
        status: 200,
        data: {},
      } as any);

      const responsePromise = transport.sendRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });

      // Close before response arrives
      await transport.close();

      await expect(responsePromise).rejects.toThrow('Connection to test-sse-server was closed');
    });
  });

  describe('isConnected', () => {
    it('should return false when not initialized', () => {
      expect(transport.isConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      await transport.initialize(serverId, mockConfig);
      // Wait for next tick to allow Promise.resolve() to complete
      await new Promise((resolve) => process.nextTick(resolve));
      expect(transport.isConnected()).toBe(true);
    });

    it('should return false when closed', async () => {
      await transport.initialize(serverId, mockConfig);
      await transport.close();
      expect(transport.isConnected()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle malformed JSON responses', async () => {
      await transport.initialize(serverId, mockConfig);
      // Wait for next tick to allow Promise.resolve() to complete
      await new Promise((resolve) => process.nextTick(resolve));

      const eventSource = (transport as any).eventSource as MockEventSource;

      // Mock console.error to suppress error output in tests
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Simulate malformed JSON
      if (eventSource.onmessage) {
        const malformedEvent = new MessageEvent('message', { data: 'invalid-json' });
        eventSource.onmessage(malformedEvent);
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SseMCPTransport] Failed to parse SSE message'),
        'invalid-json',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle responses for unknown requests', async () => {
      await transport.initialize(serverId, mockConfig);
      // Wait for next tick to allow Promise.resolve() to complete
      await new Promise((resolve) => process.nextTick(resolve));

      const eventSource = (transport as any).eventSource as MockEventSource;
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Simulate response for unknown request
      eventSource.simulateMessage({
        jsonrpc: '2.0',
        id: 999, // Unknown request ID
        result: {},
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Received SSE response for unknown request 999')
      );

      consoleSpy.mockRestore();
    });
  });
});
