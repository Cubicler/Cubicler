import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentRequest, AgentResponse } from '../../../src/model/dispatch.js';
import type { Agent, DirectTransportConfig } from '../../../src/model/agents.js';
import type { MCPHandling } from '../../../src/interface/mcp-handling.js';
import type { ServersProviding } from '../../../src/interface/servers-providing.js';
import type { RequestHandler } from '@cubicler/cubicagentkit';
import { DirectAgentTransport } from '../../../src/transport/agent/direct-agent-transport.js';
import { validateToolAccess } from '../../../src/utils/restriction-helper.js';

// Mock dependencies
vi.mock('../../../src/utils/restriction-helper.js');

const mockedValidateToolAccess = vi.mocked(validateToolAccess);

// Create a concrete implementation for testing
class TestDirectAgentTransport extends DirectAgentTransport {
  async dispatch(agentRequest: AgentRequest): Promise<AgentResponse> {
    return {
      timestamp: new Date().toISOString(),
      type: 'text',
      content: `Test response for: ${agentRequest.messages[0]?.content}`,
      metadata: { usedTools: 1 },
    };
  }
}

describe('DirectAgentTransport', () => {
  let transport: TestDirectAgentTransport;
  let mockConfig: DirectTransportConfig;
  let mockMcpService: MCPHandling;
  let mockAgent: Agent;
  let mockServersProvider: ServersProviding;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      provider: 'test',
    } as unknown as DirectTransportConfig;

    mockMcpService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      handleMCPRequest: vi.fn(),
    } as unknown as MCPHandling;

    mockAgent = {
      identifier: 'test-agent',
      name: 'Test Agent',
      transport: 'direct',
      description: 'Test agent for unit tests',
      prompt: 'You are a test agent',
    } as Agent;

    mockServersProvider = {
      getServers: vi.fn().mockResolvedValue([]),
    } as unknown as ServersProviding;

    transport = new TestDirectAgentTransport(
      mockConfig,
      mockMcpService,
      mockAgent,
      mockServersProvider
    );
  });

  describe('constructor', () => {
    it('should create instance with provided dependencies', () => {
      expect(transport).toBeInstanceOf(DirectAgentTransport);
      expect(transport).toBeInstanceOf(TestDirectAgentTransport);
    });
  });

  describe('AgentClient Implementation', () => {
    describe('initialize', () => {
      it('should initialize MCP service successfully', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        await transport.initialize();

        expect(mockMcpService.initialize).toHaveBeenCalledOnce();
        expect(consoleSpy).toHaveBeenCalledWith(
          '🔄 [DirectAgentTransport] Initializing MCP service...'
        );
        expect(consoleSpy).toHaveBeenCalledWith(
          '✅ [DirectAgentTransport] Client initialized successfully'
        );

        consoleSpy.mockRestore();
      });

      it('should handle MCP service initialization failure', async () => {
        const error = new Error('MCP initialization failed');
        mockMcpService.initialize = vi.fn().mockRejectedValue(error);

        await expect(transport.initialize()).rejects.toThrow('MCP initialization failed');
        expect(mockMcpService.initialize).toHaveBeenCalledOnce();
      });
    });

    describe('callTool', () => {
      beforeEach(() => {
        mockedValidateToolAccess.mockResolvedValue(undefined);
      });

      it('should call tool successfully with valid parameters', async () => {
        const mockResult = { result: 'tool response' };
        mockMcpService.handleMCPRequest = vi.fn().mockResolvedValue({
          jsonrpc: '2.0',
          id: expect.any(Number),
          result: mockResult,
        });

        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        const result = await transport.callTool('test-tool', { param: 'value' });

        expect(result).toEqual(mockResult);
        expect(mockedValidateToolAccess).toHaveBeenCalledWith(
          mockAgent,
          'test-tool',
          mockServersProvider
        );
        expect(mockMcpService.handleMCPRequest).toHaveBeenCalledWith({
          jsonrpc: '2.0',
          id: expect.any(Number),
          method: 'tools/call',
          params: {
            name: 'test-tool',
            arguments: { param: 'value' },
          },
        });
        expect(consoleSpy).toHaveBeenCalledWith(
          '🛠️ [DirectAgentTransport] Calling tool: test-tool with args:',
          { param: 'value' }
        );

        consoleSpy.mockRestore();
      });

      it('should handle tool access validation failure', async () => {
        const validationError = new Error('Tool access denied');
        mockedValidateToolAccess.mockRejectedValue(validationError);

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(transport.callTool('restricted-tool', {})).rejects.toThrow(
          'Tool access denied'
        );

        expect(mockedValidateToolAccess).toHaveBeenCalledWith(
          mockAgent,
          'restricted-tool',
          mockServersProvider
        );
        expect(mockMcpService.handleMCPRequest).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '❌ [DirectAgentTransport] Tool call failed for restricted-tool:',
          validationError
        );

        consoleErrorSpy.mockRestore();
      });

      it('should handle MCP error response', async () => {
        mockMcpService.handleMCPRequest = vi.fn().mockResolvedValue({
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32602,
            message: 'Invalid params',
          },
        });

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(transport.callTool('invalid-tool', {})).rejects.toThrow(
          'MCP Error: Invalid params'
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '❌ [DirectAgentTransport] Tool call failed for invalid-tool:',
          expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
      });

      it('should handle MCP service request failure', async () => {
        const mcpError = new Error('MCP service failure');
        mockMcpService.handleMCPRequest = vi.fn().mockRejectedValue(mcpError);

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(transport.callTool('failing-tool', {})).rejects.toThrow('MCP service failure');

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '❌ [DirectAgentTransport] Tool call failed for failing-tool:',
          mcpError
        );

        consoleErrorSpy.mockRestore();
      });

      it('should handle complex tool parameters', async () => {
        const complexParams = {
          nested: { object: 'value' },
          array: [1, 2, 3],
          boolean: true,
          number: 42,
        };

        mockMcpService.handleMCPRequest = vi.fn().mockResolvedValue({
          jsonrpc: '2.0',
          id: 1,
          result: { processed: true },
        });

        const result = await transport.callTool('complex-tool', complexParams);

        expect(result).toEqual({ processed: true });
        expect(mockMcpService.handleMCPRequest).toHaveBeenCalledWith({
          jsonrpc: '2.0',
          id: expect.any(Number),
          method: 'tools/call',
          params: {
            name: 'complex-tool',
            arguments: complexParams,
          },
        });
      });
    });
  });

  describe('AgentServer Implementation', () => {
    describe('start', () => {
      it('should start server successfully (no-op)', async () => {
        const mockHandler: RequestHandler = vi.fn();
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        await transport.start(mockHandler);

        expect(consoleSpy).toHaveBeenCalledWith(
          '✅ [DirectAgentTransport] Server started (no-op for direct transport)'
        );

        consoleSpy.mockRestore();
      });
    });

    describe('stop', () => {
      it('should stop server successfully (no-op)', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        await transport.stop();

        expect(consoleSpy).toHaveBeenCalledWith(
          '✅ [DirectAgentTransport] Server stopped (no-op for direct transport)'
        );

        consoleSpy.mockRestore();
      });
    });
  });

  describe('Abstract Methods', () => {
    describe('dispatch', () => {
      it('should be implemented by concrete subclass', async () => {
        const agentRequest: AgentRequest = {
          agent: {
            identifier: mockAgent.identifier,
            name: mockAgent.name,
            description: mockAgent.description,
            prompt: mockAgent.prompt || 'You are a test agent',
          },
          tools: [],
          servers: [],
          messages: [
            {
              sender: { id: 'user', name: 'Test User' },
              timestamp: new Date().toISOString(),
              type: 'text',
              content: 'Hello test agent',
            },
          ],
        };

        const response = await transport.dispatch(agentRequest);

        expect(response).toEqual({
          timestamp: expect.any(String),
          type: 'text',
          content: 'Test response for: Hello test agent',
          metadata: { usedTools: 1 },
        });
      });
    });
  });

  describe('Integration', () => {
    it('should work with full initialization and tool call flow', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Initialize
      await transport.initialize();

      // Call tool
      mockMcpService.handleMCPRequest = vi.fn().mockResolvedValue({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      });

      const result = await transport.callTool('integration-tool', { test: 'data' });

      expect(result).toEqual({ success: true });
      expect(mockMcpService.initialize).toHaveBeenCalledOnce();
      expect(mockedValidateToolAccess).toHaveBeenCalledWith(
        mockAgent,
        'integration-tool',
        mockServersProvider
      );

      consoleSpy.mockRestore();
    });
  });
});
