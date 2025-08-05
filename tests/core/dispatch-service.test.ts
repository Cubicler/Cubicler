import { beforeEach, describe, it, expect, vi } from 'vitest';
import { DispatchService } from '../../src/core/dispatch-service.js';
import type { AgentsProviding } from '../../src/interface/agents-providing.js';
import type { MCPHandling } from '../../src/interface/mcp-handling.js';
import type { ServersProviding } from '../../src/interface/servers-providing.js';
import type { Agent, AgentInfo } from '../../src/model/agents.js';
import type { MCPRequest, MCPResponse } from '../../src/model/types.js';

// Mock the AgentTransportFactory
vi.mock('../../src/factory/agent-transport-factory.js', () => ({
  AgentTransportFactory: vi.fn().mockImplementation(() => ({
    createTransport: vi.fn(),
  })),
}));

describe('Dispatch Service', () => {
  let dispatchService: DispatchService;
  let mockMcpService: MCPHandling;
  let mockAgentProvider: AgentsProviding;
  let mockServersProvider: ServersProviding;
  let mockTransportFactory: any;
  let mockTransport: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create mock transport
    mockTransport = {
      dispatch: vi.fn(),
    };

    // Create mock transport factory
    const { AgentTransportFactory } = await import('../../src/factory/agent-transport-factory.js');
    mockTransportFactory = vi.mocked(AgentTransportFactory).mock.instances[0] || {
      createTransport: vi.fn().mockReturnValue(mockTransport),
    };
    vi.mocked(AgentTransportFactory).mockImplementation(() => mockTransportFactory);

    // Create mock MCP service
    mockMcpService = {
      initialize: vi.fn(),
      handleMCPRequest: vi.fn(),
    };

    // Create mock agent provider
    mockAgentProvider = {
      getAgentInfo: vi.fn(),
      getAgentUrl: vi.fn(),
      getAgentPrompt: vi.fn(),
      getAgent: vi.fn(),
      hasAgent: vi.fn(),
      getAllAgents: vi.fn(),
    };

    // Create mock servers provider
    mockServersProvider = {
      getAvailableServers: vi.fn(),
      getServerHash: vi.fn(),
    };

    // Create dispatch service with mocked dependencies
    dispatchService = new DispatchService(mockMcpService, mockAgentProvider, mockServersProvider);
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

      const mockAgent: Agent = {
        identifier: 'gpt_4o',
        name: 'GPT-4O Agent',
        transport: 'http',
        config: {
          url: 'http://localhost:3000/agent',
        },
        description: 'Advanced AI agent',
      };

      // Mock agent provider responses
      vi.mocked(mockAgentProvider.getAgentInfo).mockResolvedValue(mockAgentInfo);
      vi.mocked(mockAgentProvider.getAgent).mockResolvedValue(mockAgent);
      vi.mocked(mockAgentProvider.getAgentPrompt).mockResolvedValue(
        'You are a helpful AI assistant with access to tools.'
      );

      // Mock MCP service responses for tools and servers
      vi.mocked(mockMcpService.handleMCPRequest).mockImplementation(async (request: MCPRequest): Promise<MCPResponse> => {
        if (request.params && 'name' in request.params && request.params.name === 'cubicler_available_servers') {
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              servers: [
                {
                  identifier: 'weather_service',
                  name: 'Weather Service',
                  description: 'Weather API',
                },
              ],
            },
          };
        } else if (request.method === 'tools/list') {
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              tools: [
                {
                  name: 'cubicler_available_servers',
                  description: 'Get available servers',
                  parameters: { type: 'object', properties: {} },
                },
              ],
            },
          };
        }
        return { 
          jsonrpc: '2.0', 
          id: request.id, 
          error: { code: -1, message: 'Unknown method' } 
        };
      });

      // Mock transport response
      const mockAgentResponse = {
        timestamp: '2025-07-28T17:45:30+07:00',
        type: 'text' as const,
        content: 'I am a helpful AI assistant with access to various tools and services.',
        metadata: { usedToken: 150, usedTools: 0 },
      };

      vi.mocked(mockTransport.dispatch).mockResolvedValue(mockAgentResponse);

      const result = await dispatchService.dispatch(undefined, mockRequest);

      expect(result.sender.id).toBe('gpt_4o');
      expect(result.sender.name).toBe('GPT-4O Agent');
      expect(result.content).toBe(
        'I am a helpful AI assistant with access to various tools and services.'
      );
      expect(result.metadata?.usedToken).toBe(150);

      // Verify transport was called
      expect(mockTransport.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          agent: expect.objectContaining({
            identifier: 'gpt_4o',
            name: 'GPT-4O Agent',
            description: 'Advanced AI agent',
          }),
          messages: mockRequest.messages,
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

      const mockAgent: Agent = {
        identifier: 'claude_3_5',
        name: 'Claude 3.5 Agent',
        transport: 'http',
        config: {
          url: 'http://localhost:3001/agent',
        },
        description: 'Creative and analytical agent',
      };

      vi.mocked(mockAgentProvider.getAgentInfo).mockResolvedValue(mockAgentInfo);
      vi.mocked(mockAgentProvider.getAgent).mockResolvedValue(mockAgent);
      vi.mocked(mockAgentProvider.getAgentPrompt).mockResolvedValue(
        'You specialize in creative and analytical tasks.'
      );

      // Mock MCP service responses
      vi.mocked(mockMcpService.handleMCPRequest).mockResolvedValue({
        jsonrpc: '2.0',
        id: 1,
        result: { servers: [], tools: [] },
      });

      const mockAgentResponse = {
        timestamp: '2025-07-28T17:45:30+07:00',
        type: 'text' as const,
        content: 'I can help you analyze the data. What specific analysis do you need?',
        metadata: { usedToken: 120, usedTools: 0 },
      };

      vi.mocked(mockTransport.dispatch).mockResolvedValue(mockAgentResponse);

      const result = await dispatchService.dispatch('claude_3_5', mockRequest);

      expect(mockAgentProvider.getAgentInfo).toHaveBeenCalledWith('claude_3_5');
      expect(result.sender.id).toBe('claude_3_5');
      expect(result.content).toContain('analyze the data');
    });

    it('should handle agent transport errors', async () => {
      const mockRequest = {
        messages: [{ sender: { id: 'user_123' }, type: 'text' as const, content: 'Test' }],
      };

      const mockAgentInfo: AgentInfo = {
        identifier: 'test_agent',
        name: 'Test Agent',
        description: 'Test',
      };

      const mockAgent: Agent = {
        identifier: 'test_agent',
        name: 'Test Agent',
        transport: 'http',
        config: {
          url: 'http://localhost:3000/agent',
        },
        description: 'Test',
      };

      vi.mocked(mockAgentProvider.getAgentInfo).mockResolvedValue(mockAgentInfo);
      vi.mocked(mockAgentProvider.getAgent).mockResolvedValue(mockAgent);
      vi.mocked(mockAgentProvider.getAgentPrompt).mockResolvedValue('Test prompt');

      // Mock MCP service responses
      vi.mocked(mockMcpService.handleMCPRequest).mockResolvedValue({
        jsonrpc: '2.0',
        id: 1,
        result: { servers: [], tools: [] },
      });

      const networkError = new Error('Network error');
      vi.mocked(mockTransport.dispatch).mockRejectedValue(networkError);

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

      const mockAgent: Agent = {
        identifier: 'test_agent',
        name: 'Test Agent',
        transport: 'http',
        config: {
          url: 'http://localhost:3000/agent',
        },
        description: 'Test',
      };

      vi.mocked(mockAgentProvider.getAgentInfo).mockResolvedValue(mockAgentInfo);
      vi.mocked(mockAgentProvider.getAgent).mockResolvedValue(mockAgent);
      vi.mocked(mockAgentProvider.getAgentPrompt).mockResolvedValue('Test prompt');

      // Mock MCP service responses
      vi.mocked(mockMcpService.handleMCPRequest).mockResolvedValue({
        jsonrpc: '2.0',
        id: 1,
        result: { servers: [], tools: [] },
      });

      // Mock invalid response (missing required fields)
      const invalidResponse = {
        content: 'Response without required fields',
      } as any;

      vi.mocked(mockTransport.dispatch).mockResolvedValue(invalidResponse);

      const result = await dispatchService.dispatch(undefined, mockRequest);

      expect(result.sender.id).toBe('test_agent');
      expect(result.content).toContain(
        'Sorry, I encountered an error while processing your request: Invalid agent response format'
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
