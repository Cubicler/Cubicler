import { beforeEach, describe, it, expect, vi, type MockedFunction } from 'vitest';
import type { MCPRequest } from '../../src/model/types.js';
import type { ToolDefinition, MCPFormattedTool } from '../../src/model/tools.js';
import type { MCPCompatible } from '../../src/interface/mcp-compatible.js';

// Mock providers
const createMockProvider = (
  identifier: string,
  tools: ToolDefinition[] = [],
  canHandle: string[] = []
): MCPCompatible => ({
  identifier,
  initialize: vi.fn().mockResolvedValue(undefined),
  toolsList: vi.fn().mockResolvedValue(tools),
  toolsCall: vi.fn().mockResolvedValue('mock result'),
  canHandleRequest: vi
    .fn()
    .mockImplementation((toolName: string) => Promise.resolve(canHandle.includes(toolName))),
});

describe('MCP Service', () => {
  let MCPService: any;
  let mockProvider1: MCPCompatible;
  let mockProvider2: MCPCompatible;
  let mockProvider3: MCPCompatible;

  const sampleTools1: ToolDefinition[] = [
    {
      name: 'weather_service.get_weather',
      description: 'Get weather information',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string' },
        },
        required: ['city'],
      },
    },
  ];

  const sampleTools2: ToolDefinition[] = [
    {
      name: 'calendar_service.list_events',
      description: 'List calendar events',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string' },
        },
      },
    },
  ];

  const sampleInternalTools: ToolDefinition[] = [
    {
      name: 'cubicler.available_servers',
      description: 'Get available servers',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Create mock providers
    mockProvider1 = createMockProvider('weather_service', sampleTools1, [
      'weather_service.get_weather',
    ]);
    mockProvider2 = createMockProvider('calendar_service', sampleTools2, [
      'calendar_service.list_events',
    ]);
    mockProvider3 = createMockProvider('cubicler', sampleInternalTools, [
      'cubicler.available_servers',
    ]);

    // Mock the providers that are imported in mcp-service.ts
    vi.doMock('../../src/core/provider-mcp-service.js', () => ({
      default: mockProvider1,
    }));

    vi.doMock('../../src/core/provider-rest-service.js', () => ({
      default: mockProvider2,
    }));

    vi.doMock('../../src/core/internal-tools-service.js', () => ({
      default: mockProvider3,
    }));

    // Import MCPService constructor
    const mcpServiceModule = await import('../../src/core/mcp-service.js');
    MCPService = mcpServiceModule.default.constructor;
  });

  describe('constructor', () => {
    it('should create service with providers', () => {
      const service = new MCPService([mockProvider1, mockProvider2]);
      expect(service).toBeDefined();
    });

    it('should create service with empty providers array', () => {
      const service = new MCPService([]);
      expect(service).toBeDefined();
    });

    it('should create service with default empty providers', () => {
      const service = new MCPService();
      expect(service).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should initialize all providers successfully', async () => {
      const service = new MCPService([mockProvider1, mockProvider2, mockProvider3]);

      await service.initialize();

      expect(mockProvider1.initialize).toHaveBeenCalledOnce();
      expect(mockProvider2.initialize).toHaveBeenCalledOnce();
      expect(mockProvider3.initialize).toHaveBeenCalledOnce();
    });

    it('should throw error if provider initialization fails', async () => {
      const failingProvider = createMockProvider('failing_service');
      (failingProvider.initialize as MockedFunction<any>).mockRejectedValue(
        new Error('Init failed')
      );

      const service = new MCPService([mockProvider1, failingProvider]);

      await expect(service.initialize()).rejects.toThrow();
      expect(mockProvider1.initialize).toHaveBeenCalledOnce();
      expect(failingProvider.initialize).toHaveBeenCalledOnce();
    });

    it('should handle empty providers array', async () => {
      const service = new MCPService([]);

      await expect(service.initialize()).resolves.not.toThrow();
    });
  });

  describe('handleMCPRequest', () => {
    let service: any;

    beforeEach(() => {
      service = new MCPService([mockProvider1, mockProvider2, mockProvider3]);
    });

    describe('initialize method', () => {
      it('should handle initialize request', async () => {
        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {},
        };

        const response = await service.handleMCPRequest(request);

        expect(response).toEqual({
          jsonrpc: '2.0',
          id: 1,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {
                listChanged: true,
              },
            },
            serverInfo: {
              name: 'Cubicler',
              version: '2.0',
            },
          },
        });

        // Should initialize all providers
        expect(mockProvider1.initialize).toHaveBeenCalledOnce();
        expect(mockProvider2.initialize).toHaveBeenCalledOnce();
        expect(mockProvider3.initialize).toHaveBeenCalledOnce();
      });
    });

    describe('tools/list method', () => {
      it('should return tools from all providers', async () => {
        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
        };

        const response = await service.handleMCPRequest(request);

        expect(response.jsonrpc).toBe('2.0');
        expect(response.id).toBe(2);
        expect(response.result).toBeDefined();
        expect(response.result.tools).toHaveLength(3);

        // Verify tools are properly formatted for MCP
        const tools = response.result.tools as MCPFormattedTool[];
        expect(tools[0]).toEqual({
          name: 'weather_service.get_weather',
          description: 'Get weather information',
          inputSchema: {
            type: 'object',
            properties: {
              city: { type: 'string' },
            },
            required: ['city'],
          },
        });

        expect(mockProvider1.toolsList).toHaveBeenCalledOnce();
        expect(mockProvider2.toolsList).toHaveBeenCalledOnce();
        expect(mockProvider3.toolsList).toHaveBeenCalledOnce();
      });

      it('should handle provider error gracefully', async () => {
        (mockProvider1.toolsList as MockedFunction<any>).mockRejectedValue(
          new Error('Provider error')
        );

        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
        };

        const response = await service.handleMCPRequest(request);

        expect(response.jsonrpc).toBe('2.0');
        expect(response.id).toBe(2);
        expect(response.error).toBeDefined();
        expect(response.error.code).toBe(-32603);
        expect(response.error.message).toContain('Failed to list tools');
      });

      it('should return empty tools array when no providers', async () => {
        const emptyService = new MCPService([]);
        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
        };

        const response = await emptyService.handleMCPRequest(request);

        expect(response.result.tools).toHaveLength(0);
      });
    });

    describe('tools/call method', () => {
      it('should execute tool via appropriate provider', async () => {
        (mockProvider1.toolsCall as MockedFunction<any>).mockResolvedValue({
          temperature: 25,
          condition: 'sunny',
        });

        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'weather_service.get_weather',
            arguments: { city: 'Jakarta' },
          },
        };

        const response = await service.handleMCPRequest(request);

        expect(response.jsonrpc).toBe('2.0');
        expect(response.id).toBe(3);
        expect(response.result).toBeDefined();
        expect(response.result.content).toHaveLength(1);
        expect(response.result.content[0].type).toBe('text');
        expect(response.result.content[0].text).toContain('temperature');

        expect(mockProvider1.canHandleRequest).toHaveBeenCalledWith('weather_service.get_weather');
        expect(mockProvider1.toolsCall).toHaveBeenCalledWith('weather_service.get_weather', {
          city: 'Jakarta',
        });
      });

      it('should handle string result from provider', async () => {
        (mockProvider1.toolsCall as MockedFunction<any>).mockResolvedValue('Weather is sunny');

        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'weather_service.get_weather',
            arguments: { city: 'Jakarta' },
          },
        };

        const response = await service.handleMCPRequest(request);

        expect(response.result.content[0].text).toBe('Weather is sunny');
      });

      it('should return error for missing tool name', async () => {
        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            arguments: { city: 'Jakarta' },
          },
        };

        const response = await service.handleMCPRequest(request);

        expect(response.error).toBeDefined();
        expect(response.error.code).toBe(-32602);
        expect(response.error.message).toBe('Missing required parameter: name');
      });

      it('should return error for missing params', async () => {
        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
        };

        const response = await service.handleMCPRequest(request);

        expect(response.error).toBeDefined();
        expect(response.error.code).toBe(-32602);
        expect(response.error.message).toBe('Missing required parameter: name');
      });

      it('should return error when no provider can handle tool', async () => {
        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'unknown.tool',
            arguments: {},
          },
        };

        const response = await service.handleMCPRequest(request);

        expect(response.error).toBeDefined();
        expect(response.error.code).toBe(-32603);
        expect(response.error.message).toContain('No provider found for tool: unknown.tool');
      });

      it('should handle provider execution error', async () => {
        (mockProvider1.toolsCall as MockedFunction<any>).mockRejectedValue(
          new Error('Execution failed')
        );

        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'weather_service.get_weather',
            arguments: { city: 'Jakarta' },
          },
        };

        const response = await service.handleMCPRequest(request);

        expect(response.error).toBeDefined();
        expect(response.error.code).toBe(-32603);
        expect(response.error.message).toContain('Tool execution failed: Execution failed');
      });

      it('should handle arguments parameter as empty object when missing', async () => {
        (mockProvider3.toolsCall as MockedFunction<any>).mockResolvedValue({ servers: [] });

        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'cubicler.available_servers',
          },
        };

        const response = await service.handleMCPRequest(request);

        expect(response.result).toBeDefined();
        expect(mockProvider3.toolsCall).toHaveBeenCalledWith('cubicler.available_servers', {});
      });
    });

    describe('unsupported methods', () => {
      it('should return method not found error for unsupported method', async () => {
        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: 4,
          method: 'unsupported/method',
        };

        const response = await service.handleMCPRequest(request);

        expect(response.jsonrpc).toBe('2.0');
        expect(response.id).toBe(4);
        expect(response.error).toBeDefined();
        expect(response.error.code).toBe(-32601);
        expect(response.error.message).toContain('Method not supported: unsupported/method');
        expect(response.error.message).toContain(
          'Supported methods: initialize, tools/list, tools/call'
        );
      });
    });

    describe('error handling', () => {
      it('should handle general errors in request processing', async () => {
        // Mock initialize to throw an error
        vi.spyOn(service, 'handleInitialize').mockImplementation(() => {
          throw new Error('Unexpected error');
        });

        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: 5,
          method: 'initialize',
        };

        const response = await service.handleMCPRequest(request);

        expect(response.error).toBeDefined();
        expect(response.error.code).toBe(-32603);
        expect(response.error.message).toContain('Internal error: Unexpected error');
      });
    });
  });

  describe('integration with actual providers', () => {
    it('should work with default export from mcp-service.js', async () => {
      // This tests the actual default export which includes the real providers
      const mcpServiceModule = await import('../../src/core/mcp-service.js');
      const actualService = mcpServiceModule.default;

      expect(actualService).toBeDefined();
      expect(typeof actualService.handleMCPRequest).toBe('function');
      expect(typeof actualService.initialize).toBe('function');
    });
  });
});
