import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import type { Response } from 'express';
import {
  formatDispatchSuccess,
  formatMCPSuccess,
  formatWebhookSuccess,
  formatSSESuccess,
  formatAgentsListSuccess,
  formatHealthSuccess,
  formatEndpointsSuccess,
} from '../../src/utils/response-formatting-utils.js';
import type { DispatchResponse } from '../../src/model/dispatch.js';
import type { AgentInfo } from '../../src/model/agents.js';
import type { HealthStatus, MCPResponse } from '../../src/model/types.js';

describe('Response Formatting Utils', () => {
  let mockResponse: Partial<Response>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockResponse = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('formatDispatchSuccess', () => {
    it('should format dispatch success response', () => {
      const result: DispatchResponse = {
        sender: { id: 'test_agent', name: 'Test Agent' },
        timestamp: '2025-01-01T00:00:00Z',
        type: 'text',
        content: 'Task completed successfully',
        metadata: {
          usedToken: 100,
          usedTools: 2,
        },
      };

      formatDispatchSuccess(result, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(result);
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ [Server] Dispatch - Success');
    });
  });

  describe('formatMCPSuccess', () => {
    it('should format MCP success response', () => {
      const result: MCPResponse = {
        jsonrpc: '2.0',
        id: 'req-123',
        result: {
          tools: [
            {
              name: 'test_tool',
              description: 'A test tool',
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                },
              },
            },
          ],
        },
      };

      formatMCPSuccess(result, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(result);
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ [Server] POST /mcp - Success');
    });
  });

  describe('formatWebhookSuccess', () => {
    it('should format webhook success response', () => {
      const result: DispatchResponse = {
        sender: { id: 'webhook_agent', name: 'Webhook Agent' },
        timestamp: '2025-01-01T00:00:00Z',
        type: 'text',
        content: 'Webhook processed',
        metadata: {
          usedToken: 50,
          usedTools: 1,
        },
      };

      formatWebhookSuccess(result, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(result);
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ [Server] Webhook - Success');
    });
  });

  describe('formatSSESuccess', () => {
    it('should format SSE success with result data', () => {
      const result = {
        connectionId: 'conn_123',
        status: 'connected',
      };

      formatSSESuccess(result, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(result);
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ [Server] SSE - Success');
    });

    it('should format SSE success with null result', () => {
      formatSSESuccess(null, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ [Server] SSE - Success');
    });

    it('should format SSE success with undefined result', () => {
      formatSSESuccess(undefined as any, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ [Server] SSE - Success');
    });
  });

  describe('formatAgentsListSuccess', () => {
    it('should format agents list success response', () => {
      const agents: AgentInfo[] = [
        {
          identifier: 'gpt_4o',
          name: 'GPT-4O',
          description: 'Advanced AI agent',
        },
        {
          identifier: 'claude_3_5',
          name: 'Claude 3.5',
          description: 'Creative AI agent',
        },
      ];

      formatAgentsListSuccess(agents, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        total: 2,
        agents,
      });
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ [Server] GET /agents - Success (2 agents)');
    });

    it('should format empty agents list', () => {
      const agents: AgentInfo[] = [];

      formatAgentsListSuccess(agents, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        total: 0,
        agents: [],
      });
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ [Server] GET /agents - Success (0 agents)');
    });
  });

  describe('formatHealthSuccess', () => {
    it('should format healthy status with 200 status code', () => {
      const health: HealthStatus = {
        status: 'healthy',
        timestamp: '2025-01-01T00:00:00Z',
        services: {
          agents: { status: 'healthy', count: 2, agents: ['agent1', 'agent2'] },
          providers: { status: 'healthy', count: 1, servers: ['server1'] },
          mcp: { status: 'healthy' },
        },
      };

      formatHealthSuccess(health, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(health);
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ [Server] Health check: healthy');
    });

    it('should format unhealthy status with 503 status code', () => {
      const health: HealthStatus = {
        status: 'unhealthy',
        timestamp: '2025-01-01T00:00:00Z',
        services: {
          agents: { status: 'unhealthy', error: 'Service down' },
          providers: { status: 'healthy', count: 1, servers: ['server1'] },
          mcp: { status: 'healthy' },
        },
      };

      formatHealthSuccess(health, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(health);
      expect(consoleLogSpy).toHaveBeenCalledWith('❌ [Server] Health check: unhealthy');
    });
  });

  describe('formatEndpointsSuccess', () => {
    it('should format endpoints success response', () => {
      const endpoints = [
        { method: 'GET', path: '/health', service: 'HealthService' },
        { method: 'POST', path: '/dispatch', service: 'DispatchService' },
        { method: 'GET', path: '/agents', service: 'AgentService' },
      ];

      formatEndpointsSuccess(endpoints, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        total: 3,
        endpoints,
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '✅ [Server] GET /endpoints - Success (3 endpoints)'
      );
    });

    it('should format empty endpoints list', () => {
      const endpoints: any[] = [];

      formatEndpointsSuccess(endpoints, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        total: 0,
        endpoints: [],
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '✅ [Server] GET /endpoints - Success (0 endpoints)'
      );
    });
  });
});
