import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentRequest, AgentResponse } from '../../../src/model/dispatch.js';
import type { Agent, DirectOpenAIConfig } from '../../../src/model/agents.js';
import type { MCPHandling } from '../../../src/interface/mcp-handling.js';
import type { ServersProviding } from '../../../src/interface/servers-providing.js';
import { DirectOpenAIAgentTransport } from '../../../src/transport/agent/direct-openai-agent-transport.js';
import { OpenAIService } from '@cubicler/cubicagent-openai';
import { CubicAgent } from '@cubicler/cubicagentkit';
import { expandEnvVariable } from '../../../src/utils/env-helper.js';

// Mock dependencies
vi.mock('@cubicler/cubicagent-openai');
vi.mock('@cubicler/cubicagentkit');
vi.mock('../../../src/utils/env-helper.js');

const mockedOpenAIService = vi.mocked(OpenAIService);
const mockedCubicAgent = vi.mocked(CubicAgent);
const mockedExpandEnvVariable = vi.mocked(expandEnvVariable);

describe('DirectOpenAIAgentTransport', () => {
  let transport: DirectOpenAIAgentTransport;
  let mockConfig: DirectOpenAIConfig;
  let mockMcpService: MCPHandling;
  let mockAgent: Agent;
  let mockServersProvider: ServersProviding;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      provider: 'openai',
      apiKey: 'test-api-key',
      model: 'gpt-4o',
      temperature: 0.7,
      sessionMaxTokens: 4000,
      organization: 'test-org',
      project: 'test-project',
      baseURL: 'https://api.openai.com/v1',
      timeout: 30000,
      maxRetries: 3,
    };

    mockMcpService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      handleMCPRequest: vi.fn(),
    } as unknown as MCPHandling;

    mockAgent = {
      identifier: 'openai-agent',
      name: 'OpenAI Agent',
      transport: 'direct',
      description: 'OpenAI agent for testing',
      prompt: 'You are an OpenAI assistant',
    } as Agent;

    mockServersProvider = {
      getServers: vi.fn().mockResolvedValue([]),
    } as unknown as ServersProviding;

    mockedExpandEnvVariable.mockImplementation((value: string) => value);
  });

  describe('constructor', () => {
    it('should create instance with valid OpenAI config', () => {
      transport = new DirectOpenAIAgentTransport(
        mockConfig,
        mockMcpService,
        mockAgent,
        mockServersProvider
      );

      expect(transport).toBeInstanceOf(DirectOpenAIAgentTransport);
    });

    it('should throw error for invalid provider', () => {
      const invalidConfig = { ...mockConfig, provider: 'invalid' as any };

      expect(() => {
        new DirectOpenAIAgentTransport(
          invalidConfig,
          mockMcpService,
          mockAgent,
          mockServersProvider
        );
      }).toThrow('DirectOpenAIAgentTransport requires provider to be "openai"');
    });

    it('should throw error for missing apiKey', () => {
      const invalidConfig = { ...mockConfig, apiKey: '' };

      expect(() => {
        new DirectOpenAIAgentTransport(
          invalidConfig,
          mockMcpService,
          mockAgent,
          mockServersProvider
        );
      }).toThrow('OpenAI direct transport requires a valid apiKey');
    });

    it('should throw error for invalid apiKey type', () => {
      const invalidConfig = { ...mockConfig, apiKey: 123 as any };

      expect(() => {
        new DirectOpenAIAgentTransport(
          invalidConfig,
          mockMcpService,
          mockAgent,
          mockServersProvider
        );
      }).toThrow('OpenAI direct transport requires a valid apiKey');
    });

    it('should throw error for invalid temperature range', () => {
      const invalidConfig = { ...mockConfig, temperature: 3.0 };

      expect(() => {
        new DirectOpenAIAgentTransport(
          invalidConfig,
          mockMcpService,
          mockAgent,
          mockServersProvider
        );
      }).toThrow('OpenAI temperature must be between 0 and 2');
    });

    it('should throw error for negative temperature', () => {
      const invalidConfig = { ...mockConfig, temperature: -0.1 };

      expect(() => {
        new DirectOpenAIAgentTransport(
          invalidConfig,
          mockMcpService,
          mockAgent,
          mockServersProvider
        );
      }).toThrow('OpenAI temperature must be between 0 and 2');
    });

    it('should throw error for invalid sessionMaxTokens', () => {
      const invalidConfig = { ...mockConfig, sessionMaxTokens: 0 };

      expect(() => {
        new DirectOpenAIAgentTransport(
          invalidConfig,
          mockMcpService,
          mockAgent,
          mockServersProvider
        );
      }).toThrow('OpenAI sessionMaxTokens must be greater than 0');
    });

    it('should accept valid config with defaults', () => {
      const minimalConfig: DirectOpenAIConfig = {
        provider: 'openai',
        apiKey: 'test-key',
      };

      expect(() => {
        new DirectOpenAIAgentTransport(
          minimalConfig,
          mockMcpService,
          mockAgent,
          mockServersProvider
        );
      }).not.toThrow();
    });

    it('should accept valid temperature at boundaries', () => {
      const config1 = { ...mockConfig, temperature: 0 };
      const config2 = { ...mockConfig, temperature: 2 };

      expect(() => {
        new DirectOpenAIAgentTransport(config1, mockMcpService, mockAgent, mockServersProvider);
      }).not.toThrow();

      expect(() => {
        new DirectOpenAIAgentTransport(config2, mockMcpService, mockAgent, mockServersProvider);
      }).not.toThrow();
    });

    it('should accept undefined temperature', () => {
      const configWithoutTemp = { ...mockConfig };
      delete configWithoutTemp.temperature;

      expect(() => {
        new DirectOpenAIAgentTransport(
          configWithoutTemp,
          mockMcpService,
          mockAgent,
          mockServersProvider
        );
      }).not.toThrow();
    });
  });

  describe('dispatch', () => {
    beforeEach(() => {
      transport = new DirectOpenAIAgentTransport(
        mockConfig,
        mockMcpService,
        mockAgent,
        mockServersProvider
      );
    });

    it('should dispatch request successfully', async () => {
      const mockResponse: AgentResponse = {
        timestamp: new Date().toISOString(),
        type: 'text',
        content: 'OpenAI response',
        metadata: { usedToken: 150 },
      };

      const mockOpenAIServiceInstance = {
        dispatch: vi.fn().mockResolvedValue(mockResponse),
      };
      mockedOpenAIService.mockImplementation(() => mockOpenAIServiceInstance as any);

      const agentRequest: AgentRequest = {
        agent: {
          identifier: mockAgent.identifier,
          name: mockAgent.name,
          description: mockAgent.description,
          prompt: mockAgent.prompt || 'Test prompt',
        },
        tools: [],
        servers: [],
        messages: [
          {
            sender: { id: 'user', name: 'Test User' },
            timestamp: new Date().toISOString(),
            type: 'text',
            content: 'Hello OpenAI',
          },
        ],
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await transport.dispatch(agentRequest);

      expect(result).toBe(mockResponse);
      expect(mockedCubicAgent).toHaveBeenCalledWith(transport, transport);
      expect(mockedOpenAIService).toHaveBeenCalledWith(
        expect.any(Object), // CubicAgent instance
        {
          apiKey: 'test-api-key',
          model: 'gpt-4o',
          temperature: 0.7,
          sessionMaxTokens: 4000,
          organization: 'test-org',
          project: 'test-project',
          baseURL: 'https://api.openai.com/v1',
          timeout: 30000,
          maxRetries: 3,
        },
        {
          timeout: 90000,
          mcpMaxRetries: 3,
          mcpCallTimeout: 30000,
          sessionMaxIteration: 10,
          endpoint: '/mcp',
          agentPort: 3000,
        }
      );
      expect(mockOpenAIServiceInstance.dispatch).toHaveBeenCalledWith(agentRequest);
      expect(consoleSpy).toHaveBeenCalledWith(
        '🤖 [DirectOpenAIAgentTransport] Creating OpenAI agent for dispatch'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        '✅ [DirectOpenAIAgentTransport] OpenAI dispatch completed'
      );

      consoleSpy.mockRestore();
    });

    it('should use default config values when not provided', async () => {
      const minimalConfig: DirectOpenAIConfig = {
        provider: 'openai',
        apiKey: 'test-key',
      };

      transport = new DirectOpenAIAgentTransport(
        minimalConfig,
        mockMcpService,
        mockAgent,
        mockServersProvider
      );

      const mockOpenAIServiceInstance = {
        dispatch: vi.fn().mockResolvedValue({
          timestamp: new Date().toISOString(),
          type: 'text',
          content: 'Response',
        }),
      };
      mockedOpenAIService.mockImplementation(() => mockOpenAIServiceInstance as any);

      const agentRequest: AgentRequest = {
        agent: {
          identifier: mockAgent.identifier,
          name: mockAgent.name,
          description: mockAgent.description,
          prompt: mockAgent.prompt || 'Test prompt',
        },
        tools: [],
        servers: [],
        messages: [],
      };

      await transport.dispatch(agentRequest);

      expect(mockedOpenAIService).toHaveBeenCalledWith(
        expect.any(Object),
        {
          apiKey: 'test-key',
          model: 'gpt-4o', // default
          temperature: 0.7, // default
          sessionMaxTokens: 4000, // default
          organization: undefined,
          project: undefined,
          baseURL: undefined,
          timeout: 30000, // default
          maxRetries: 3, // default
        },
        expect.any(Object)
      );
    });

    it('should expand environment variables in apiKey', async () => {
      mockedExpandEnvVariable.mockReturnValue('expanded-api-key');

      const configWithEnvVar: DirectOpenAIConfig = {
        provider: 'openai',
        apiKey: '${OPENAI_API_KEY}',
      };

      transport = new DirectOpenAIAgentTransport(
        configWithEnvVar,
        mockMcpService,
        mockAgent,
        mockServersProvider
      );

      const mockOpenAIServiceInstance = {
        dispatch: vi.fn().mockResolvedValue({
          timestamp: new Date().toISOString(),
          type: 'text',
          content: 'Response',
        }),
      };
      mockedOpenAIService.mockImplementation(() => mockOpenAIServiceInstance as any);

      const agentRequest: AgentRequest = {
        agent: {
          identifier: mockAgent.identifier,
          name: mockAgent.name,
          description: mockAgent.description,
          prompt: mockAgent.prompt || 'Test prompt',
        },
        tools: [],
        servers: [],
        messages: [],
      };

      await transport.dispatch(agentRequest);

      expect(mockedExpandEnvVariable).toHaveBeenCalledWith('${OPENAI_API_KEY}');
      expect(mockedOpenAIService).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          apiKey: 'expanded-api-key',
        }),
        expect.any(Object)
      );
    });

    it('should handle OpenAI service dispatch failure', async () => {
      const error = new Error('OpenAI API error');
      const mockOpenAIServiceInstance = {
        dispatch: vi.fn().mockRejectedValue(error),
      };
      mockedOpenAIService.mockImplementation(() => mockOpenAIServiceInstance as any);

      const agentRequest: AgentRequest = {
        agent: {
          identifier: mockAgent.identifier,
          name: mockAgent.name,
          description: mockAgent.description,
          prompt: mockAgent.prompt || 'Test prompt',
        },
        tools: [],
        servers: [],
        messages: [],
      };

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(transport.dispatch(agentRequest)).rejects.toThrow('OpenAI API error');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ [DirectOpenAIAgentTransport] OpenAI dispatch failed:',
        error
      );

      consoleErrorSpy.mockRestore();
    });

    it('should create fresh CubicAgent instance for each dispatch', async () => {
      const mockOpenAIServiceInstance = {
        dispatch: vi.fn().mockResolvedValue({
          timestamp: new Date().toISOString(),
          type: 'text',
          content: 'Response',
        }),
      };
      mockedOpenAIService.mockImplementation(() => mockOpenAIServiceInstance as any);

      const agentRequest: AgentRequest = {
        agent: {
          identifier: mockAgent.identifier,
          name: mockAgent.name,
          description: mockAgent.description,
          prompt: mockAgent.prompt || 'Test prompt',
        },
        tools: [],
        servers: [],
        messages: [],
      };

      // Call dispatch twice
      await transport.dispatch(agentRequest);
      await transport.dispatch(agentRequest);

      // Should create two separate CubicAgent instances
      expect(mockedCubicAgent).toHaveBeenCalledTimes(2);
      expect(mockedOpenAIService).toHaveBeenCalledTimes(2);
    });

    it('should transform image and url messages to text for CubicAgentKit compatibility', async () => {
      const mockResponse: AgentResponse = {
        timestamp: new Date().toISOString(),
        type: 'text',
        content: 'OpenAI response',
        metadata: { usedToken: 150 },
      };

      const mockOpenAIServiceInstance = {
        dispatch: vi.fn().mockResolvedValue(mockResponse),
      };
      mockedOpenAIService.mockImplementation(() => mockOpenAIServiceInstance as any);

      const agentRequest: AgentRequest = {
        agent: {
          identifier: mockAgent.identifier,
          name: mockAgent.name,
          description: mockAgent.description,
          prompt: mockAgent.prompt || 'Test prompt',
        },
        tools: [],
        servers: [],
        messages: [
          {
            sender: { id: 'user', name: 'Test User' },
            timestamp: new Date().toISOString(),
            type: 'text',
            content: 'Hello text message',
          },
          {
            sender: { id: 'user', name: 'Test User' },
            timestamp: new Date().toISOString(),
            type: 'image',
            content: 'base64imagedatahere',
            metadata: { fileName: 'test.jpg', format: 'base64' },
          },
          {
            sender: { id: 'user', name: 'Test User' },
            timestamp: new Date().toISOString(),
            type: 'url',
            content: 'https://example.com/image.jpg',
          },
          {
            sender: { id: 'user', name: 'Test User' },
            timestamp: new Date().toISOString(),
            type: 'null',
            content: null,
          },
        ],
      };

      await transport.dispatch(agentRequest);

      // Verify that the OpenAI service received the transformed request
      expect(mockOpenAIServiceInstance.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            expect.objectContaining({
              type: 'text',
              content: 'Hello text message',
            }),
            expect.objectContaining({
              type: 'text',
              content: '[Image content]: base64imagedatahere (test.jpg)',
            }),
            expect.objectContaining({
              type: 'text',
              content: '[URL reference]: https://example.com/image.jpg',
            }),
            expect.objectContaining({
              type: 'null',
              content: null,
            }),
          ],
        })
      );
    });
  });

  describe('config validation edge cases', () => {
    it('should handle null apiKey', () => {
      const invalidConfig = { ...mockConfig, apiKey: null as any };

      expect(() => {
        new DirectOpenAIAgentTransport(
          invalidConfig,
          mockMcpService,
          mockAgent,
          mockServersProvider
        );
      }).toThrow('OpenAI direct transport requires a valid apiKey');
    });

    it('should handle negative sessionMaxTokens', () => {
      const invalidConfig = { ...mockConfig, sessionMaxTokens: -100 };

      expect(() => {
        new DirectOpenAIAgentTransport(
          invalidConfig,
          mockMcpService,
          mockAgent,
          mockServersProvider
        );
      }).toThrow('OpenAI sessionMaxTokens must be greater than 0');
    });

    it('should accept valid sessionMaxTokens', () => {
      const validConfig = { ...mockConfig, sessionMaxTokens: 8000 };

      expect(() => {
        new DirectOpenAIAgentTransport(validConfig, mockMcpService, mockAgent, mockServersProvider);
      }).not.toThrow();
    });

    it('should pass summarizerModel to OpenAI service when provided', async () => {
      const configWithSummarizer: DirectOpenAIConfig = {
        ...mockConfig,
        summarizerModel: 'gpt-4o-mini',
      };

      transport = new DirectOpenAIAgentTransport(
        configWithSummarizer,
        mockMcpService,
        mockAgent,
        mockServersProvider
      );

      const mockOpenAIServiceInstance = {
        dispatch: vi.fn().mockResolvedValue({
          timestamp: new Date().toISOString(),
          type: 'text',
          content: 'Response with summarizer',
        }),
      };
      mockedOpenAIService.mockImplementation(() => mockOpenAIServiceInstance as any);

      const agentRequest: AgentRequest = {
        agent: {
          identifier: mockAgent.identifier,
          name: mockAgent.name,
          description: mockAgent.description,
          prompt: mockAgent.prompt || 'Test prompt',
        },
        tools: [],
        servers: [],
        messages: [],
      };

      await transport.dispatch(agentRequest);

      // Verify OpenAI service was called with summarizerModel
      expect(mockedOpenAIService).toHaveBeenCalledWith(
        expect.any(Object), // CubicAgent instance
        expect.objectContaining({
          summarizerModel: 'gpt-4o-mini',
        }),
        expect.any(Object) // DispatchConfig
      );
    });
  });
});
