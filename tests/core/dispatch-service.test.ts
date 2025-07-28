import { beforeEach, describe, it, expect, vi } from 'vitest';
import { DispatchService } from '../../src/core/dispatch-service.js';

// Mock axios at the top level - using vi.fn() directly
vi.mock('axios', () => ({
  default: vi.fn(),
  isAxiosError: vi.fn(),
}));

describe('Dispatch Service', () => {
  let mockAgentService: any;
  let mockInternalToolsService: any;
  let mockProviderService: any;
  let dispatchService: DispatchService;
  let mockAxios: any;
  let mockIsAxiosError: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get the mocked axios functions
    const axios = await import('axios');
    mockAxios = axios.default;
    mockIsAxiosError = axios.isAxiosError;

    // Mock agent service
    mockAgentService = {
      getAgentInfo: vi.fn(),
      getAgentUrl: vi.fn(),
      getAgentPrompt: vi.fn(),
    };

    // Mock internal tools service
    mockInternalToolsService = {
      toolsList: vi.fn(),
    };

    // Mock provider service
    mockProviderService = {
      getAvailableServers: vi.fn(),
    };

    // Create dispatch service with mocked dependencies
    dispatchService = new DispatchService(
      mockInternalToolsService,
      mockAgentService,
      mockProviderService
    );
  });

  describe('dispatch', () => {
    it('should dispatch message to default agent', async () => {
      const mockRequest = {
        messages: [
          {
            sender: { id: 'user_123', name: 'John Doe' },
            type: 'text' as const,
            content: 'Hello, what can you do?',
          },
        ],
      };

      mockAgentService.getAgentInfo.mockResolvedValue({
        identifier: 'gpt_4o',
        name: 'GPT-4O Agent',
        description: 'Advanced AI agent',
      });

      mockAgentService.getAgentUrl.mockResolvedValue('http://localhost:3000/agent');
      mockAgentService.getAgentPrompt.mockResolvedValue(
        'You are a helpful AI assistant with access to tools.'
      );

      mockInternalToolsService.toolsList.mockResolvedValue([
        {
          name: 'cubicler.available_servers',
          description: 'Get available servers',
          parameters: { type: 'object', properties: {} },
        },
      ]);

      mockProviderService.getAvailableServers.mockResolvedValue({
        total: 1,
        servers: [
          {
            identifier: 'weather_service',
            name: 'Weather Service',
            description: 'Weather API',
            toolsCount: 2,
          },
        ],
      });

      mockAxios.mockResolvedValue({
        data: {
          timestamp: '2025-07-28T17:45:30+07:00',
          type: 'text',
          content: 'I am a helpful AI assistant with access to various tools and services.',
          metadata: { usedToken: 150, usedTools: 0 },
        },
      });

      const result = await dispatchService.dispatch(undefined, mockRequest);

      expect(result.sender.id).toBe('gpt_4o');
      expect(result.sender.name).toBe('GPT-4O Agent');
      expect(result.content).toBe(
        'I am a helpful AI assistant with access to various tools and services.'
      );
      expect(result.metadata?.usedToken).toBe(150);
    });

    it('should dispatch message to specific agent', async () => {
      const mockRequest = {
        messages: [
          {
            sender: { id: 'user_123' },
            type: 'text' as const,
            content: 'Analyze this data',
          },
        ],
      };

      mockAgentService.getAgentInfo.mockResolvedValue({
        identifier: 'claude_3_5',
        name: 'Claude 3.5 Agent',
        description: 'Creative and analytical agent',
      });

      mockAgentService.getAgentUrl.mockResolvedValue('http://localhost:3001/agent');
      mockAgentService.getAgentPrompt.mockResolvedValue(
        'You specialize in creative and analytical tasks.'
      );

      mockInternalToolsService.toolsList.mockResolvedValue([]);
      mockProviderService.getAvailableServers.mockResolvedValue({ total: 0, servers: [] });

      mockAxios.mockResolvedValue({
        data: {
          timestamp: '2025-07-28T17:45:30+07:00',
          type: 'text',
          content: 'I can help you analyze the data. What specific analysis do you need?',
          metadata: { usedToken: 120, usedTools: 0 },
        },
      });

      const result = await dispatchService.dispatch('claude_3_5', mockRequest);

      expect(mockAgentService.getAgentInfo).toHaveBeenCalledWith('claude_3_5');
      expect(result.sender.id).toBe('claude_3_5');
      expect(result.content).toContain('analyze the data');
    });

    it('should handle agent communication errors', async () => {
      const mockRequest = {
        messages: [{ sender: { id: 'user_123' }, type: 'text' as const, content: 'Test' }],
      };

      mockAgentService.getAgentInfo.mockResolvedValue({
        identifier: 'test_agent',
        name: 'Test Agent',
        description: 'Test',
      });
      mockAgentService.getAgentUrl.mockResolvedValue('http://localhost:3000/agent');
      mockAgentService.getAgentPrompt.mockResolvedValue('Test prompt');
      mockInternalToolsService.toolsList.mockResolvedValue([]);
      mockProviderService.getAvailableServers.mockResolvedValue({ total: 0, servers: [] });

      const networkError = new Error('Network error');
      mockAxios.mockRejectedValue(networkError);
      // Mock isAxiosError to return false so the error falls through to the generic error handling
      mockIsAxiosError.mockReturnValue(false);

      const result = await dispatchService.dispatch(undefined, mockRequest);

      expect(result.sender.id).toBe('test_agent');
      expect(result.content).toContain(
        'Sorry, I encountered an error while processing your request: Network error'
      );
    });
  });
});
