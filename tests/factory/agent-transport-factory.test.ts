import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentTransportFactory } from '../../src/factory/agent-transport-factory.js';
import { HttpAgentTransport } from '../../src/transport/agent/http-agent-transport.js';
import { SseAgentTransport } from '../../src/transport/agent/sse-agent-transport.js';
import { DirectOpenAIAgentTransport } from '../../src/transport/agent/direct-openai-agent-transport.js';
import { StdioAgentPools } from '../../src/transport/agent/stdio-agent-pools.js';
import type { AgentConfig, DirectOpenAIAgentConfig } from '../../src/model/agents.js';
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
      const agent: AgentConfig = {
        name: 'Test Agent',
        description: 'Test agent',
        transport: 'http',
        url: 'http://localhost:3000/agent',
      };

      const transport = factory.createTransport('test-agent', agent);
      expect(transport).toBeInstanceOf(HttpAgentTransport);
    });

    it('should create SseAgentTransport for sse transport', () => {
      const agent: AgentConfig = {
        name: 'Test Agent',
        description: 'Test agent',
        transport: 'sse',
        url: 'http://localhost:3001/agent',
      } as any; // Cast as SseAgentConfig
      const transport = factory.createTransport('test-agent', agent);
      expect(transport).toBeInstanceOf(SseAgentTransport);
    });

    it('should create StdioAgentPools for stdio transport', () => {
      const agent: AgentConfig = {
        name: 'Test Agent',
        description: 'Test agent',
        transport: 'stdio',
        command: 'python3 /path/to/agent.py',
      } as any; // Cast as StdioAgentConfig
      const transport = factory.createTransport('test-agent', agent);
      expect(transport).toBeInstanceOf(StdioAgentPools);
    });

    it('should create DirectOpenAIAgentTransport for direct transport with OpenAI provider', () => {
      const agent: DirectOpenAIAgentConfig = {
        name: 'Test Agent',
        description: 'Test agent',
        transport: 'direct',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o',
      };
      const transport = factory.createTransport('test-agent', agent);
      expect(transport).toBeInstanceOf(DirectOpenAIAgentTransport);
    });

    it('should throw error for direct transport with unsupported provider', () => {
      const agent: any = {
        name: 'Test Agent',
        description: 'Test agent',
        transport: 'direct',
        provider: 'unsupported',
        apiKey: 'test-key',
      };
      expect(() => factory.createTransport('test-agent', agent)).toThrow(
        'Unsupported direct transport provider: unsupported. Supported providers: openai'
      );
    });

    it('should throw error for unsupported transport', () => {
      const agent: any = {
        name: 'Test Agent',
        description: 'Test agent',
        transport: 'websocket',
        url: 'ws://localhost:3000',
      };
      expect(() => factory.createTransport('test-agent', agent)).toThrow(
        'Unsupported transport type: websocket'
      );
    });
  });
});
