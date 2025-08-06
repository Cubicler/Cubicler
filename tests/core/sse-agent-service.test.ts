import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SseAgentService } from '../../src/core/sse-agent-service.js';
import { SseAgentTransport } from '../../src/transport/agent/sse-agent-transport.js';
import type { AgentResponse } from '../../src/model/dispatch.js';
import { Response } from 'express';

// Mock SseAgentTransport
vi.mock('../../src/transport/agent/sse-agent-transport.js', () => ({
  SseAgentTransport: vi.fn().mockImplementation(() => ({
    registerAgentConnection: vi.fn(),
    handleAgentResponse: vi.fn(),
    isAgentConnected: vi.fn().mockReturnValue(true),
    disconnect: vi.fn(),
  })),
}));

describe('SseAgentService', () => {
  let sseAgentService: SseAgentService;
  let mockTransport: SseAgentTransport & {
    registerAgentConnection: ReturnType<typeof vi.fn>;
    handleAgentResponse: ReturnType<typeof vi.fn>;
    isAgentConnected: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };
  let mockResponse: Response;

  beforeEach(() => {
    vi.clearAllMocks();
    sseAgentService = new SseAgentService();
    mockTransport = new SseAgentTransport({} as any, 'test-agent') as SseAgentTransport & {
      registerAgentConnection: ReturnType<typeof vi.fn>;
      handleAgentResponse: ReturnType<typeof vi.fn>;
      isAgentConnected: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
    };
    mockResponse = {} as Response;
  });

  describe('registerAgent', () => {
    it('should register an agent transport', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      sseAgentService.registerAgent('test-agent', mockTransport);

      expect(consoleSpy).toHaveBeenCalledWith(
        '🔄 [SseAgentService] Registered SSE transport for agent test-agent'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('handleAgentConnection', () => {
    it('should handle agent connection when transport is registered', () => {
      sseAgentService.registerAgent('test-agent', mockTransport);

      const result = sseAgentService.handleAgentConnection('test-agent', mockResponse);

      expect(result).toBe(true);
      expect(mockTransport.registerAgentConnection).toHaveBeenCalledWith(mockResponse);
    });

    it('should return false when transport is not registered', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = sseAgentService.handleAgentConnection('unknown-agent', mockResponse);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        '⚠️ [SseAgentService] No transport registered for agent unknown-agent'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('handleAgentResponse', () => {
    it('should handle agent response when transport is registered', () => {
      const mockResponse: AgentResponse = {
        timestamp: '2024-01-01T00:00:00Z',
        type: 'text',
        content: 'Test response',
        metadata: { usedToken: 100, usedTools: 1 },
      };

      sseAgentService.registerAgent('test-agent', mockTransport);

      const result = sseAgentService.handleAgentResponse('test-agent', 'request-123', mockResponse);

      expect(result).toBe(true);
      expect(mockTransport.handleAgentResponse).toHaveBeenCalledWith('request-123', mockResponse);
    });

    it('should return false when transport is not registered', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mockResponse: AgentResponse = {
        timestamp: '2024-01-01T00:00:00Z',
        type: 'text',
        content: 'Test response',
        metadata: { usedToken: 100, usedTools: 1 },
      };

      const result = sseAgentService.handleAgentResponse(
        'unknown-agent',
        'request-123',
        mockResponse
      );

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        '⚠️ [SseAgentService] No transport registered for agent unknown-agent'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('isAgentConnected', () => {
    it('should return true when agent is connected', () => {
      sseAgentService.registerAgent('test-agent', mockTransport);

      const result = sseAgentService.isAgentConnected('test-agent');

      expect(result).toBe(true);
      expect(mockTransport.isAgentConnected).toHaveBeenCalled();
    });

    it('should return false when transport is not registered', () => {
      const result = sseAgentService.isAgentConnected('unknown-agent');

      expect(result).toBe(false);
    });

    it('should return false when transport is registered but not connected', () => {
      mockTransport.isAgentConnected.mockReturnValue(false);
      sseAgentService.registerAgent('test-agent', mockTransport);

      const result = sseAgentService.isAgentConnected('test-agent');

      expect(result).toBe(false);
    });
  });

  describe('disconnectAgent', () => {
    it('should disconnect agent when transport is registered', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      sseAgentService.registerAgent('test-agent', mockTransport);
      sseAgentService.disconnectAgent('test-agent');

      expect(mockTransport.disconnect).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('🔄 [SseAgentService] Disconnected agent test-agent');

      consoleSpy.mockRestore();
    });

    it('should handle disconnect when transport is not registered', () => {
      expect(() => sseAgentService.disconnectAgent('unknown-agent')).not.toThrow();
    });
  });

  describe('getConnectedAgentIds', () => {
    it('should return connected agent IDs', () => {
      sseAgentService.registerAgent('agent1', mockTransport);

      const mockTransport2 = new SseAgentTransport({} as any, 'agent2') as SseAgentTransport & {
        registerAgentConnection: ReturnType<typeof vi.fn>;
        handleAgentResponse: ReturnType<typeof vi.fn>;
        isAgentConnected: ReturnType<typeof vi.fn>;
        disconnect: ReturnType<typeof vi.fn>;
      };
      mockTransport2.isAgentConnected.mockReturnValue(false);
      sseAgentService.registerAgent('agent2', mockTransport2);

      const result = sseAgentService.getConnectedAgentIds();

      expect(result).toEqual(['agent1']);
    });

    it('should return empty array when no agents are connected', () => {
      const result = sseAgentService.getConnectedAgentIds();

      expect(result).toEqual([]);
    });
  });

  describe('disconnectAllAgents', () => {
    it('should disconnect all agents', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      sseAgentService.registerAgent('agent1', mockTransport);

      const mockTransport2 = new SseAgentTransport({} as any, 'agent2') as SseAgentTransport & {
        registerAgentConnection: ReturnType<typeof vi.fn>;
        handleAgentResponse: ReturnType<typeof vi.fn>;
        isAgentConnected: ReturnType<typeof vi.fn>;
        disconnect: ReturnType<typeof vi.fn>;
      };
      sseAgentService.registerAgent('agent2', mockTransport2);

      sseAgentService.disconnectAllAgents();

      expect(mockTransport.disconnect).toHaveBeenCalled();
      expect(mockTransport2.disconnect).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('🔄 [SseAgentService] Disconnected agent agent1');
      expect(consoleSpy).toHaveBeenCalledWith('🔄 [SseAgentService] Disconnected agent agent2');
      expect(consoleSpy).toHaveBeenCalledWith('🔄 [SseAgentService] All agents disconnected');

      consoleSpy.mockRestore();
    });
  });
});
