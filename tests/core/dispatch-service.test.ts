import { beforeEach, describe, it, expect, vi } from 'vitest';
import { DispatchService } from '../../src/core/dispatch-service.js';
import type { AgentsProviding } from '../../src/interface/agents-providing.js';
import type { ToolsListProviding } from '../../src/interface/tools-list-providing.js';
import type { ServersProviding } from '../../src/interface/servers-providing.js';
import type { AgentInfo } from '../../src/model/agents.js';
import type { ToolDefinition, AvailableServersResponse } from '../../src/model/tools.js';
import type { AxiosResponse } from 'axios';

// Mock the fetch helper
vi.mock('../../src/utils/fetch-helper.js', () => ({
  fetchWithAgentTimeout: vi.fn(),
}));

describe('Dispatch Service', () => {
  let dispatchService: DispatchService;
  let mockToolsProvider: ToolsListProviding;
  let mockAgentProvider: AgentsProviding;
  let mockServerProvider: ServersProviding;
  let mockFetchWithAgentTimeout: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get the mocked fetch function
    const fetchHelper = await import('../../src/utils/fetch-helper.js');
    mockFetchWithAgentTimeout = fetchHelper.fetchWithAgentTimeout;

    // Create mock providers
    mockToolsProvider = {
      identifier: 'internal-tools',
      toolsList: vi.fn(),
    };

    mockAgentProvider = {
      getAgentInfo: vi.fn(),
      getAgentUrl: vi.fn(),
      getAgentPrompt: vi.fn(),
      hasAgent: vi.fn(),
      getAllAgents: vi.fn(),
    };

    mockServerProvider = {
      getAvailableServers: vi.fn(),
      getServerHash: vi.fn(),
    };

    // Create dispatch service with mocked dependencies
    dispatchService = new DispatchService(mockToolsProvider, mockAgentProvider, mockServerProvider);
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

      const mockAgentInfo: AgentInfo = {
        identifier: 'gpt_4o',
        name: 'GPT-4O Agent',
        description: 'Advanced AI agent',
      };

      const mockTools: ToolDefinition[] = [
        {
          name: 'cubicler.available_servers',
          description: 'Get available servers',
          parameters: { type: 'object', properties: {} },
        },
      ];

      const mockServersResponse: AvailableServersResponse = {
        total: 1,
        servers: [
          {
            identifier: 'weather_service',
            name: 'Weather Service',
            description: 'Weather API',
            toolsCount: 2,
          },
        ],
      };

      vi.mocked(mockAgentProvider.getAgentInfo).mockResolvedValue(mockAgentInfo);
      vi.mocked(mockAgentProvider.getAgentUrl).mockResolvedValue('http://localhost:3000/agent');
      vi.mocked(mockAgentProvider.getAgentPrompt).mockResolvedValue(
        'You are a helpful AI assistant with access to tools.'
      );
      vi.mocked(mockToolsProvider.toolsList).mockResolvedValue(mockTools);
      vi.mocked(mockServerProvider.getAvailableServers).mockResolvedValue(mockServersResponse);

      const mockAxiosResponse: AxiosResponse = {
        status: 200,
        statusText: 'OK',
        data: {
          timestamp: '2025-07-28T17:45:30+07:00',
          type: 'text',
          content: 'I am a helpful AI assistant with access to various tools and services.',
          metadata: { usedToken: 150, usedTools: 0 },
        },
        headers: {},
        config: {} as any,
      };

      vi.mocked(mockFetchWithAgentTimeout).mockResolvedValue(mockAxiosResponse);

      const result = await dispatchService.dispatch(undefined, mockRequest);

      expect(result.sender.id).toBe('gpt_4o');
      expect(result.sender.name).toBe('GPT-4O Agent');
      expect(result.content).toBe(
        'I am a helpful AI assistant with access to various tools and services.'
      );
      expect(result.metadata?.usedToken).toBe(150);

      // Verify the agent was called with correct payload
      expect(mockFetchWithAgentTimeout).toHaveBeenCalledWith(
        'http://localhost:3000/agent',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          data: expect.objectContaining({
            agent: expect.objectContaining({
              identifier: 'gpt_4o',
              name: 'GPT-4O Agent',
              description: 'Advanced AI agent',
            }),
            tools: mockTools,
            servers: [
              {
                identifier: 'weather_service',
                name: 'Weather Service',
                description: 'Weather API',
              },
            ],
            messages: mockRequest.messages,
          }),
        })
      );
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

      const mockAgentInfo: AgentInfo = {
        identifier: 'claude_3_5',
        name: 'Claude 3.5 Agent',
        description: 'Creative and analytical agent',
      };

      vi.mocked(mockAgentProvider.getAgentInfo).mockResolvedValue(mockAgentInfo);
      vi.mocked(mockAgentProvider.getAgentUrl).mockResolvedValue('http://localhost:3001/agent');
      vi.mocked(mockAgentProvider.getAgentPrompt).mockResolvedValue(
        'You specialize in creative and analytical tasks.'
      );
      vi.mocked(mockToolsProvider.toolsList).mockResolvedValue([]);
      vi.mocked(mockServerProvider.getAvailableServers).mockResolvedValue({
        total: 0,
        servers: [],
      });

      const mockAxiosResponse: AxiosResponse = {
        status: 200,
        statusText: 'OK',
        data: {
          timestamp: '2025-07-28T17:45:30+07:00',
          type: 'text',
          content: 'I can help you analyze the data. What specific analysis do you need?',
          metadata: { usedToken: 120, usedTools: 0 },
        },
        headers: {},
        config: {} as any,
      };

      vi.mocked(mockFetchWithAgentTimeout).mockResolvedValue(mockAxiosResponse);

      const result = await dispatchService.dispatch('claude_3_5', mockRequest);

      expect(mockAgentProvider.getAgentInfo).toHaveBeenCalledWith('claude_3_5');
      expect(result.sender.id).toBe('claude_3_5');
      expect(result.content).toContain('analyze the data');
    });

    it('should handle agent communication errors', async () => {
      const mockRequest = {
        messages: [{ sender: { id: 'user_123' }, type: 'text' as const, content: 'Test' }],
      };

      const mockAgentInfo: AgentInfo = {
        identifier: 'test_agent',
        name: 'Test Agent',
        description: 'Test',
      };

      vi.mocked(mockAgentProvider.getAgentInfo).mockResolvedValue(mockAgentInfo);
      vi.mocked(mockAgentProvider.getAgentUrl).mockResolvedValue('http://localhost:3000/agent');
      vi.mocked(mockAgentProvider.getAgentPrompt).mockResolvedValue('Test prompt');
      vi.mocked(mockToolsProvider.toolsList).mockResolvedValue([]);
      vi.mocked(mockServerProvider.getAvailableServers).mockResolvedValue({
        total: 0,
        servers: [],
      });

      const networkError = new Error('Network error');
      vi.mocked(mockFetchWithAgentTimeout).mockRejectedValue(networkError);

      const result = await dispatchService.dispatch(undefined, mockRequest);

      expect(result.sender.id).toBe('test_agent');
      expect(result.content).toContain(
        'Sorry, I encountered an error while processing your request: Network error'
      );
      expect(result.metadata.usedToken).toBe(0);
      expect(result.metadata.usedTools).toBe(0);
    });

    it('should handle invalid response format from agent', async () => {
      const mockRequest = {
        messages: [{ sender: { id: 'user_123' }, type: 'text' as const, content: 'Test' }],
      };

      const mockAgentInfo: AgentInfo = {
        identifier: 'test_agent',
        name: 'Test Agent',
        description: 'Test',
      };

      vi.mocked(mockAgentProvider.getAgentInfo).mockResolvedValue(mockAgentInfo);
      vi.mocked(mockAgentProvider.getAgentUrl).mockResolvedValue('http://localhost:3000/agent');
      vi.mocked(mockAgentProvider.getAgentPrompt).mockResolvedValue('Test prompt');
      vi.mocked(mockToolsProvider.toolsList).mockResolvedValue([]);
      vi.mocked(mockServerProvider.getAvailableServers).mockResolvedValue({
        total: 0,
        servers: [],
      });

      // Mock invalid response (missing required fields)
      const mockAxiosResponse: AxiosResponse = {
        status: 200,
        statusText: 'OK',
        data: {
          content: 'Response without required fields',
        },
        headers: {},
        config: {} as any,
      };

      vi.mocked(mockFetchWithAgentTimeout).mockResolvedValue(mockAxiosResponse);

      const result = await dispatchService.dispatch(undefined, mockRequest);

      expect(result.sender.id).toBe('test_agent');
      expect(result.content).toContain(
        'Sorry, I encountered an error while processing your request: Invalid agent response format'
      );
    });

    it('should handle agent HTTP error responses', async () => {
      const mockRequest = {
        messages: [{ sender: { id: 'user_123' }, type: 'text' as const, content: 'Test' }],
      };

      const mockAgentInfo: AgentInfo = {
        identifier: 'test_agent',
        name: 'Test Agent',
        description: 'Test',
      };

      vi.mocked(mockAgentProvider.getAgentInfo).mockResolvedValue(mockAgentInfo);
      vi.mocked(mockAgentProvider.getAgentUrl).mockResolvedValue('http://localhost:3000/agent');
      vi.mocked(mockAgentProvider.getAgentPrompt).mockResolvedValue('Test prompt');
      vi.mocked(mockToolsProvider.toolsList).mockResolvedValue([]);
      vi.mocked(mockServerProvider.getAvailableServers).mockResolvedValue({
        total: 0,
        servers: [],
      });

      // Mock HTTP error response
      const mockAxiosResponse: AxiosResponse = {
        status: 500,
        statusText: 'Internal Server Error',
        data: {},
        headers: {},
        config: {} as any,
      };

      vi.mocked(mockFetchWithAgentTimeout).mockResolvedValue(mockAxiosResponse);

      const result = await dispatchService.dispatch(undefined, mockRequest);

      expect(result.sender.id).toBe('test_agent');
      expect(result.content).toContain(
        'Sorry, I encountered an error while processing your request: Agent responded with status 500'
      );
    });

    it('should validate messages array', async () => {
      const invalidRequest = { messages: [] };

      await expect(dispatchService.dispatch(undefined, invalidRequest)).rejects.toThrow(
        'Messages array is required and must not be empty'
      );
    });
  });
});
