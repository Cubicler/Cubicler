import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SseAgentTransport } from '../../../src/transport/agent/sse-agent-transport.js';
import type { SseTransportConfig } from '../../../src/model/agents.js';
import type { AgentRequest } from '../../../src/model/dispatch.js';

// Mock the fetch helper
vi.mock('../../../src/utils/fetch-helper.js', () => ({
  fetchWithAgentTimeout: vi.fn(),
}));

// Mock JWT helper
vi.mock('../../../src/utils/jwt-helper.js', () => ({
  default: {
    getToken: vi.fn().mockResolvedValue('mock-jwt-token'),
  },
}));

import { fetchWithAgentTimeout } from '../../../src/utils/fetch-helper.js';
import jwtHelper from '../../../src/utils/jwt-helper.js';

describe('SseAgentTransport', () => {
  const mockConfig: SseTransportConfig = {
    url: 'https://test-agent.example.com/sse',
  };

  const mockConfigWithAuth: SseTransportConfig = {
    url: 'https://test-agent.example.com/sse',
    auth: {
      type: 'jwt',
      config: {
        token: 'test-token',
      },
    },
  };

  const mockAgentRequest: AgentRequest = {
    agent: {
      identifier: 'test-agent',
      name: 'Test Agent',
      description: 'Test agent for SSE',
      prompt: 'You are a test agent',
    },
    tools: [],
    servers: [],
    messages: [
      {
        sender: { id: 'user', name: 'Test User' },
        timestamp: '2024-01-01T00:00:00Z',
        type: 'text',
        content: 'Hello, agent!',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(jwtHelper.getToken).mockResolvedValue('mock-jwt-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      const transport = new SseAgentTransport(mockConfig);
      expect(transport).toBeInstanceOf(SseAgentTransport);
    });

    it('should throw error for missing url', () => {
      expect(() => new SseAgentTransport({ url: '' })).toThrow(
        'Agent URL must be a non-empty string'
      );
    });

    it('should throw error for invalid config', () => {
      expect(() => new SseAgentTransport({} as SseTransportConfig)).toThrow(
        'Agent URL must be a non-empty string'
      );
    });
  });

  describe('dispatch', () => {
    it('should successfully handle SSE stream with complete response', async () => {
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            // Simulate streaming response
            setTimeout(() => {
              callback(Buffer.from('data: {"type":"content_delta","content":"Hello"}\n\n'));
              callback(Buffer.from('data: {"type":"content_delta","content":" there!"}\n\n'));
              callback(
                Buffer.from(
                  'data: {"type":"response_complete","timestamp":"2024-01-01T00:00:00Z","metadata":{"usedToken":10,"usedTools":0}}\n\n'
                )
              );
              callback(Buffer.from('data: [DONE]\n\n'));
            }, 10);
          }
          if (event === 'end') {
            setTimeout(() => callback(), 50);
          }
        }),
      };

      const mockResponse = {
        status: 200,
        data: mockStream,
      };

      (fetchWithAgentTimeout as any).mockResolvedValue(mockResponse);

      const transport = new SseAgentTransport(mockConfig);
      const result = await transport.dispatch(mockAgentRequest);

      expect(result).toEqual({
        timestamp: '2024-01-01T00:00:00Z',
        type: 'text',
        content: 'Hello there!',
        metadata: { usedToken: 10, usedTools: 0 },
      });

      expect(fetchWithAgentTimeout).toHaveBeenCalledWith(mockConfig.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        data: mockAgentRequest,
        responseType: 'stream',
      });
    });

    it('should handle SSE stream without explicit completion', async () => {
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => {
              callback(Buffer.from('data: {"type":"content_delta","content":"Hello world"}\n\n'));
            }, 10);
          }
          if (event === 'end') {
            setTimeout(() => callback(), 30);
          }
        }),
      };

      const mockResponse = {
        status: 200,
        data: mockStream,
      };

      (fetchWithAgentTimeout as any).mockResolvedValue(mockResponse);

      const transport = new SseAgentTransport(mockConfig);
      const result = await transport.dispatch(mockAgentRequest);

      expect(result.content).toBe('Hello world');
      expect(result.type).toBe('text');
      expect(result.metadata).toEqual({ usedToken: 0, usedTools: 0 });
    });

    it('should include JWT authorization when configured', async () => {
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => {
              callback(Buffer.from('data: {"type":"content_delta","content":"Response"}\n\n'));
              callback(
                Buffer.from(
                  'data: {"type":"response_complete","timestamp":"2024-01-01T00:00:00Z","metadata":{"usedToken":5,"usedTools":0}}\n\n'
                )
              );
              callback(Buffer.from('data: [DONE]\n\n'));
            }, 10);
          }
          if (event === 'end') {
            setTimeout(() => callback(), 30);
          }
        }),
      };

      const mockResponse = {
        status: 200,
        data: mockStream,
      };

      (fetchWithAgentTimeout as any).mockResolvedValue(mockResponse);

      const transport = new SseAgentTransport(mockConfigWithAuth);
      await transport.dispatch(mockAgentRequest);

      expect(fetchWithAgentTimeout).toHaveBeenCalledWith(mockConfigWithAuth.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
          Authorization: 'Bearer mock-jwt-token',
        },
        data: mockAgentRequest,
        responseType: 'stream',
      });
    });

    it('should handle HTTP errors', async () => {
      const mockResponse = {
        status: 500,
        statusText: 'Internal Server Error',
        data: null,
      };

      (fetchWithAgentTimeout as any).mockResolvedValue(mockResponse);

      const transport = new SseAgentTransport(mockConfig);

      await expect(transport.dispatch(mockAgentRequest)).rejects.toThrow(
        'Agent responded with status 500: Internal Server Error'
      );
    });

    it('should handle stream errors', async () => {
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Stream connection lost')), 10);
          }
        }),
      };

      const mockResponse = {
        status: 200,
        data: mockStream,
      };

      (fetchWithAgentTimeout as any).mockResolvedValue(mockResponse);

      const transport = new SseAgentTransport(mockConfig);

      await expect(transport.dispatch(mockAgentRequest)).rejects.toThrow(
        'SSE stream error: Stream connection lost'
      );
    });

    it('should handle empty stream', async () => {
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'end') {
            setTimeout(() => callback(), 10);
          }
        }),
      };

      const mockResponse = {
        status: 200,
        data: mockStream,
      };

      (fetchWithAgentTimeout as any).mockResolvedValue(mockResponse);

      const transport = new SseAgentTransport(mockConfig);

      await expect(transport.dispatch(mockAgentRequest)).rejects.toThrow(
        'SSE stream ended without receiving any data'
      );
    });

    it('should handle malformed SSE data gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => {
              callback(Buffer.from('data: {"invalid":"json"}\n\n')); // Missing required fields
              callback(Buffer.from('data: invalid json\n\n')); // Invalid JSON
              callback(Buffer.from('data: {"type":"content_delta","content":"Valid content"}\n\n'));
              callback(
                Buffer.from(
                  'data: {"type":"response_complete","timestamp":"2024-01-01T00:00:00Z","metadata":{"usedToken":3,"usedTools":0}}\n\n'
                )
              );
              callback(Buffer.from('data: [DONE]\n\n'));
            }, 10);
          }
          if (event === 'end') {
            setTimeout(() => callback(), 50);
          }
        }),
      };

      const mockResponse = {
        status: 200,
        data: mockStream,
      };

      (fetchWithAgentTimeout as any).mockResolvedValue(mockResponse);

      const transport = new SseAgentTransport(mockConfig);
      const result = await transport.dispatch(mockAgentRequest);

      expect(result.content).toBe('Valid content');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse SSE data:'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle network errors', async () => {
      (fetchWithAgentTimeout as any).mockRejectedValue(new Error('Network error'));

      const transport = new SseAgentTransport(mockConfig);

      await expect(transport.dispatch(mockAgentRequest)).rejects.toThrow('Network error');
    });

    it('should validate invalid response format', async () => {
      const mockResponse = {
        status: 200,
        data: 'not a stream object',
      };

      (fetchWithAgentTimeout as any).mockResolvedValue(mockResponse);

      const transport = new SseAgentTransport(mockConfig);

      await expect(transport.dispatch(mockAgentRequest)).rejects.toThrow(
        'Invalid SSE response format'
      );
    });
  });
});
