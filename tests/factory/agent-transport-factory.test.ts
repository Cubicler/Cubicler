import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentTransportFactory } from '../../src/factory/agent-transport-factory.js';
import { HttpAgentTransport } from '../../src/transport/agent/http-agent-transport.js';
import { SseAgentTransport } from '../../src/transport/agent/sse-agent-transport.js';
import { StdioAgentTransport } from '../../src/transport/agent/stdio-agent-transport.js';
import { DirectOpenAIAgentTransport } from '../../src/transport/agent/direct-openai-agent-transport.js';
import type { Agent, DirectAgent } from '../../src/model/agents.js';
import type { MCPHandling } from '../../src/interface/mcp-handling.js';
import type { ServersProviding } from '../../src/interface/servers-providing.js';

describe('AgentTransportFactory', () => {
  let factory: AgentTransportFactory;
  let mockMcpService: MCPHandling;
  let mockServersProvider: ServersProviding;

  beforeEach(() => {
    // Create mock MCP service
    mockMcpService = {
      initialize: vi.fn(),
      handleMCPRequest: vi.fn(),
    };

    // Create mock servers provider
    mockServersProvider = {
      getAvailableServers: vi.fn(),
      getServerHash: vi.fn(),
    };

    factory = new AgentTransportFactory(mockMcpService, mockServersProvider);
  });

  describe('createTransport', () => {
    it('should create HttpAgentTransport for http transport', () => {
      const agent: Agent = {
        identifier: 'test-agent',
        name: 'Test Agent',
        transport: 'http',
        config: {
          url: 'http://localhost:3000/agent',
        },
        description: 'Test agent',
      };

      const transport = factory.createTransport(agent);

      expect(transport).toBeInstanceOf(HttpAgentTransport);
    });

    it('should create SseAgentTransport for sse transport', () => {
      const agent: Agent = {
        identifier: 'test-agent',
        name: 'Test Agent',
        transport: 'sse',
        config: {
          url: 'https://localhost:3000/agent/sse',
        },
        description: 'Test agent',
      };

      const transport = factory.createTransport(agent);

      expect(transport).toBeInstanceOf(SseAgentTransport);
    });

    it('should create StdioAgentTransport for stdio transport', () => {
      const agent: Agent = {
        identifier: 'test-agent',
        name: 'Test Agent',
        transport: 'stdio',
        config: {
          url: 'python3 /path/to/agent.py',
        },
        description: 'Test agent',
      };

      const transport = factory.createTransport(agent);

      expect(transport).toBeInstanceOf(StdioAgentTransport);
    });

    it('should create DirectOpenAIAgentTransport for direct transport with OpenAI provider', () => {
      const agent: DirectAgent = {
        identifier: 'test-agent',
        name: 'Test Agent',
        transport: 'direct',
        config: {
          provider: 'openai',
          apiKey: '${OPENAI_API_KEY}',
          model: 'gpt-4o',
        },
        description: 'Test agent',
      };

      const transport = factory.createTransport(agent);

      expect(transport).toBeInstanceOf(DirectOpenAIAgentTransport);
    });

    it('should throw error for direct transport with unsupported provider', () => {
      const agent: DirectAgent = {
        identifier: 'test-agent',
        name: 'Test Agent',
        transport: 'direct',
        config: {
          provider: 'unsupported' as any,
          apiKey: 'test-key',
        },
        description: 'Test agent',
      };

      expect(() => factory.createTransport(agent)).toThrow(
        'Unsupported direct transport provider: unsupported. Supported providers: openai'
      );
    });

    it('should throw error for unsupported transport', () => {
      const agent = {
        identifier: 'test-agent',
        name: 'Test Agent',
        transport: 'websocket',
        url: 'ws://localhost:3000',
        description: 'Test agent',
      } as any;

      expect(() => factory.createTransport(agent)).toThrow('Unsupported transport type: websocket');
    });
  });
});
