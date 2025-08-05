import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpAgentTransport } from '../../src/transport/http-agent-transport.js';
import type { AgentRequest, AgentResponse } from '../../src/model/dispatch.js';
import type { HttpTransportConfig } from '../../src/model/agents.js';
import * as fetchHelper from '../../src/utils/fetch-helper.js';
import * as jwtHelper from '../../src/utils/jwt-helper.js';

// Mock the fetch helper and jwt helper
vi.mock('../../src/utils/fetch-helper.js');
vi.mock('../../src/utils/jwt-helper.js');

describe('HttpAgentTransport', () => {
  const mockConfig: HttpTransportConfig = {
    url: 'http://localhost:3000/agent'
  };
  let transport: HttpAgentTransport;
  const mockFetchWithAgentTimeout = vi.mocked(fetchHelper.fetchWithAgentTimeout);
  const mockJwtHelper = vi.mocked(jwtHelper.default);

  beforeEach(() => {
    vi.clearAllMocks();
    transport = new HttpAgentTransport(mockConfig);
  });

  describe('constructor', () => {
    it('should create transport with valid URL', () => {
      expect(transport).toBeInstanceOf(HttpAgentTransport);
    });

    it('should throw error for empty URL', () => {
      expect(() => new HttpAgentTransport({ url: '' })).toThrow('Agent URL must be a non-empty string');
    });

    it('should throw error for invalid config', () => {
      expect(() => new HttpAgentTransport(null as any)).toThrow(
        'Agent URL must be a non-empty string'
      );
    });
  });

  describe('dispatch', () => {
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

      const result = await transport.dispatch(mockAgentRequest);

      expect(mockFetchWithAgentTimeout).toHaveBeenCalledWith(mockConfig.url, {
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

      await expect(transport.dispatch(mockAgentRequest)).rejects.toThrow(
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

      await expect(transport.dispatch(mockAgentRequest)).rejects.toThrow(
        'Invalid agent response format: missing required fields (timestamp, type, content, metadata)'
      );
    });

    it('should propagate fetch errors', async () => {
      const fetchError = new Error('Network error');
      mockFetchWithAgentTimeout.mockRejectedValue(fetchError);

      await expect(transport.dispatch(mockAgentRequest)).rejects.toThrow('Network error');
    });

    it('should include JWT token in Authorization header when configured', async () => {
      const jwtConfig: HttpTransportConfig = {
        url: 'http://localhost:3000/agent',
        auth: {
          type: 'jwt',
          config: {
            token: 'test-jwt-token',
          },
        },
      };

      const jwtTransport = new HttpAgentTransport(jwtConfig);
      mockJwtHelper.getToken.mockResolvedValue('test-jwt-token');

      mockFetchWithAgentTimeout.mockResolvedValue({
        status: 200,
        data: mockAgentResponse,
      } as any);

      await jwtTransport.dispatch(mockAgentRequest);

      expect(mockJwtHelper.getToken).toHaveBeenCalledWith({
        token: 'test-jwt-token',
      });

      expect(mockFetchWithAgentTimeout).toHaveBeenCalledWith(jwtConfig.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-jwt-token',
        },
        data: mockAgentRequest,
      });
    });

    it('should handle JWT token fetch errors', async () => {
      const jwtConfig: HttpTransportConfig = {
        url: 'http://localhost:3000/agent',
        auth: {
          type: 'jwt',
          config: {
            tokenUrl: 'https://auth.example.com/token',
            clientId: 'test-client',
            clientSecret: 'test-secret',
          },
        },
      };

      const jwtTransport = new HttpAgentTransport(jwtConfig);
      const jwtError = new Error('Token fetch failed');
      mockJwtHelper.getToken.mockRejectedValue(jwtError);

      await expect(jwtTransport.dispatch(mockAgentRequest)).rejects.toThrow('Token fetch failed');
    });

    it('should not include Authorization header when no auth configured', async () => {
      mockFetchWithAgentTimeout.mockResolvedValue({
        status: 200,
        data: mockAgentResponse,
      } as any);

      await transport.dispatch(mockAgentRequest);

      expect(mockJwtHelper.getToken).not.toHaveBeenCalled();
      
      expect(mockFetchWithAgentTimeout).toHaveBeenCalledWith(mockConfig.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: mockAgentRequest,
      });
    });
  });
});
