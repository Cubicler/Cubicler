import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpAgentTransport } from '../../src/transport/http-agent-transport.js';
import type { AgentRequest, AgentResponse } from '../../src/model/dispatch.js';
import * as fetchHelper from '../../src/utils/fetch-helper.js';

// Mock the fetch helper
vi.mock('../../src/utils/fetch-helper.js');

describe('HttpAgentTransport', () => {
  const mockUrl = 'http://localhost:3000/agent';
  let transport: HttpAgentTransport;
  const mockFetchWithAgentTimeout = vi.mocked(fetchHelper.fetchWithAgentTimeout);

  beforeEach(() => {
    vi.clearAllMocks();
    transport = new HttpAgentTransport(mockUrl);
  });

  describe('constructor', () => {
    it('should create transport with valid URL', () => {
      expect(transport).toBeInstanceOf(HttpAgentTransport);
    });

    it('should throw error for empty URL', () => {
      expect(() => new HttpAgentTransport('')).toThrow('Agent URL must be a non-empty string');
    });

    it('should throw error for non-string URL', () => {
      expect(() => new HttpAgentTransport(null as any)).toThrow(
        'Agent URL must be a non-empty string'
      );
    });
  });

  describe('call', () => {
    const mockAgentRequest: AgentRequest = {
      agent: {
        identifier: 'test-agent',
        name: 'Test Agent',
        description: 'Test description',
        prompt: 'Test prompt',
      },
      tools: [],
      servers: [],
      messages: [
        {
          sender: { id: 'user1' },
          type: 'text',
          content: 'Hello',
        },
      ],
    };

    const mockAgentResponse: AgentResponse = {
      timestamp: '2025-08-03T10:00:00Z',
      type: 'text',
      content: 'Hello back!',
      metadata: {
        usedToken: 10,
        usedTools: 0,
      },
    };

    it('should call agent successfully', async () => {
      mockFetchWithAgentTimeout.mockResolvedValue({
        status: 200,
        data: mockAgentResponse,
      } as any);

      const result = await transport.call(mockAgentRequest);

      expect(mockFetchWithAgentTimeout).toHaveBeenCalledWith(mockUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: mockAgentRequest,
      });
      expect(result).toEqual(mockAgentResponse);
    });

    it('should throw error for HTTP error status', async () => {
      mockFetchWithAgentTimeout.mockResolvedValue({
        status: 500,
        statusText: 'Internal Server Error',
      } as any);

      await expect(transport.call(mockAgentRequest)).rejects.toThrow(
        'Agent responded with status 500: Internal Server Error'
      );
    });

    it('should throw error for invalid response format', async () => {
      const invalidResponse = {
        timestamp: '2025-08-03T10:00:00Z',
        // missing type, content, metadata
      };

      mockFetchWithAgentTimeout.mockResolvedValue({
        status: 200,
        data: invalidResponse,
      } as any);

      await expect(transport.call(mockAgentRequest)).rejects.toThrow(
        'Invalid agent response format: missing required fields (timestamp, type, content, metadata)'
      );
    });

    it('should propagate fetch errors', async () => {
      const fetchError = new Error('Network error');
      mockFetchWithAgentTimeout.mockRejectedValue(fetchError);

      await expect(transport.call(mockAgentRequest)).rejects.toThrow('Network error');
    });
  });
});
