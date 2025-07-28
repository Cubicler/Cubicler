import { beforeEach, describe, it, expect, vi, type MockedFunction } from 'vitest';
import { ProviderMCPService } from '../../src/core/provider-mcp-service.js';
import type { ProvidersConfigProviding } from '../../src/interface/provider-config-providing.js';
import type { ProvidersConfig } from '../../src/model/providers.js';
import type { MCPRequest, MCPResponse } from '../../src/model/types.js';
import type { AxiosResponse } from 'axios';
import * as fetchHelper from '../../src/utils/fetch-helper.js';

// Mock fetch helper
vi.mock('../../src/utils/fetch-helper.js', () => ({
  fetchWithDefaultTimeout: vi.fn(),
}));

// Helper to create mock AxiosResponse
const createMockAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {} as any,
});

describe('ProviderMCPService', () => {
  let mockProviderConfig: ProvidersConfigProviding;
  let providerMCPService: ProviderMCPService;
  let mockFetch: MockedFunction<typeof fetchHelper.fetchWithDefaultTimeout>;

  const mockProvidersConfig: ProvidersConfig = {
    mcpServers: [
      {
        identifier: 'weather_service',
        name: 'Weather Service',
        description: 'Provides weather information via MCP',
        transport: 'http',
        url: 'http://localhost:4000/mcp',
        headers: {
          Authorization: 'Bearer test-token',
        },
      },
      {
        identifier: 'file_service',
        name: 'File Service',
        description: 'File management via MCP',
        transport: 'http',
        url: 'http://localhost:4001/mcp',
      },
    ],
    restServers: [
      {
        identifier: 'user_api',
        name: 'User API',
        description: 'Legacy REST API for user management',
        url: 'http://localhost:5000/api',
        defaultHeaders: {
          Authorization: 'Bearer api-token',
        },
        endPoints: [
          {
            name: 'get_user',
            description: 'Get user information by ID',
            path: '/users/{userId}',
            method: 'GET',
            parameters: {
              type: 'object',
              properties: {
                userId: {
                  type: 'string',
                  description: 'User ID to fetch',
                },
              },
              required: ['userId'],
            },
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock provider config
    mockProviderConfig = {
      getProvidersConfig: vi.fn().mockResolvedValue(mockProvidersConfig),
    };

    // Mock fetch helper
    mockFetch = vi.mocked(fetchHelper.fetchWithDefaultTimeout);

    // Create service instance
    providerMCPService = new ProviderMCPService(mockProviderConfig);
  });

  describe('initialization', () => {
    it('should have correct identifier', () => {
      expect(providerMCPService.identifier).toBe('provider-mcp');
    });

    it('should initialize successfully', async () => {
      // Mock successful initialization responses
      mockFetch.mockResolvedValue(
        createMockAxiosResponse({
          jsonrpc: '2.0',
          id: 'initialize',
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
          },
        })
      );

      await expect(providerMCPService.initialize()).resolves.toBeUndefined();

      // Should call initialize for each MCP server
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        data: {
          jsonrpc: '2.0',
          id: 'initialize',
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            clientInfo: { name: 'Cubicler', version: '2.0' },
          },
        },
      });
    });

    it('should handle initialization failures gracefully', async () => {
      // Mock failed initialization
      mockFetch.mockRejectedValue(new Error('Connection failed'));

      // Should not throw, but log warnings
      await expect(providerMCPService.initialize()).resolves.toBeUndefined();
    });
  });

  describe('canHandleRequest', () => {
    it('should return true for valid MCP server tool names', async () => {
      expect(await providerMCPService.canHandleRequest('weather_service.get_weather')).toBe(true);
      expect(await providerMCPService.canHandleRequest('file_service.read_file')).toBe(true);
    });

    it('should return false for REST server tool names', async () => {
      expect(await providerMCPService.canHandleRequest('user_api.get_user')).toBe(false);
    });

    it('should return false for invalid tool name formats', async () => {
      expect(await providerMCPService.canHandleRequest('invalid')).toBe(false);
      expect(await providerMCPService.canHandleRequest('too.many.parts')).toBe(false);
      expect(await providerMCPService.canHandleRequest('')).toBe(false);
    });

    it('should return false for unknown servers', async () => {
      expect(await providerMCPService.canHandleRequest('unknown_server.some_tool')).toBe(false);
    });
  });

  describe('isMCPServer', () => {
    it('should return true for MCP servers', async () => {
      expect(await providerMCPService.isMCPServer('weather_service')).toBe(true);
      expect(await providerMCPService.isMCPServer('file_service')).toBe(true);
    });

    it('should return false for REST servers', async () => {
      expect(await providerMCPService.isMCPServer('user_api')).toBe(false);
    });

    it('should return false for unknown servers', async () => {
      expect(await providerMCPService.isMCPServer('unknown_server')).toBe(false);
    });
  });

  describe('getMCPTools', () => {
    it('should fetch tools from MCP server successfully', async () => {
      const mockTools = [
        {
          name: 'get_weather',
          description: 'Get current weather for a location',
          inputSchema: {
            type: 'object',
            properties: {
              city: { type: 'string' },
              country: { type: 'string' },
            },
            required: ['city'],
          },
        },
      ];

      mockFetch.mockResolvedValue(
        createMockAxiosResponse({
          jsonrpc: '2.0',
          id: 'tools-request',
          result: { tools: mockTools },
        })
      );

      const tools = await providerMCPService.getMCPTools('weather_service');

      expect(tools).toEqual(mockTools);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        data: {
          jsonrpc: '2.0',
          id: 'tools-request',
          method: 'tools/list',
          params: {},
        },
      });
    });

    it('should handle MCP error responses', async () => {
      mockFetch.mockResolvedValue(
        createMockAxiosResponse({
          jsonrpc: '2.0',
          id: 'tools-request',
          error: {
            code: -32601,
            message: 'Method not found',
          },
        })
      );

      await expect(providerMCPService.getMCPTools('weather_service')).rejects.toThrow(
        'MCP tools request failed: Method not found'
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(providerMCPService.getMCPTools('weather_service')).rejects.toThrow(
        'Network error'
      );
    });

    it('should return empty array when no tools in response', async () => {
      mockFetch.mockResolvedValue(
        createMockAxiosResponse({
          jsonrpc: '2.0',
          id: 'tools-request',
          result: {},
        })
      );

      const tools = await providerMCPService.getMCPTools('weather_service');
      expect(tools).toEqual([]);
    });
  });

  describe('getAllMCPTools', () => {
    it('should fetch tools from all MCP servers', async () => {
      // Mock tools for weather service
      mockFetch.mockResolvedValueOnce(
        createMockAxiosResponse({
          jsonrpc: '2.0',
          id: 'tools-request',
          result: {
            tools: [
              {
                name: 'get_weather',
                description: 'Get weather',
                inputSchema: { type: 'object', properties: {} },
              },
            ],
          },
        })
      );

      // Mock tools for file service
      mockFetch.mockResolvedValueOnce(
        createMockAxiosResponse({
          jsonrpc: '2.0',
          id: 'tools-request',
          result: {
            tools: [
              {
                name: 'read_file',
                description: 'Read file',
                inputSchema: { type: 'object', properties: {} },
              },
            ],
          },
        })
      );

      const tools = await providerMCPService.getAllMCPTools();

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('weather_service.get_weather');
      expect(tools[1].name).toBe('file_service.read_file');
    });

    it('should continue with other servers if one fails', async () => {
      // First server fails
      mockFetch.mockRejectedValueOnce(new Error('Server down'));

      // Second server succeeds
      mockFetch.mockResolvedValueOnce(
        createMockAxiosResponse({
          jsonrpc: '2.0',
          id: 'tools-request',
          result: {
            tools: [
              {
                name: 'read_file',
                description: 'Read file',
                inputSchema: { type: 'object', properties: {} },
              },
            ],
          },
        })
      );

      const tools = await providerMCPService.getAllMCPTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('file_service.read_file');
    });
  });

  describe('toolsList', () => {
    it('should return all MCP tools via toolsList interface', async () => {
      mockFetch.mockResolvedValue(
        createMockAxiosResponse({
          jsonrpc: '2.0',
          id: 'tools-request',
          result: {
            tools: [
              {
                name: 'test_tool',
                description: 'Test tool',
                inputSchema: { type: 'object', properties: {} },
              },
            ],
          },
        })
      );

      const tools = await providerMCPService.toolsList();

      expect(tools).toHaveLength(2); // One tool from each server
      expect(tools[0].name).toBe('weather_service.test_tool');
      expect(tools[1].name).toBe('file_service.test_tool');
    });
  });

  describe('executeMCPTool', () => {
    it('should execute MCP tool successfully', async () => {
      const mockResult = { temperature: 25, condition: 'sunny' };

      mockFetch.mockResolvedValue(
        createMockAxiosResponse({
          jsonrpc: '2.0',
          id: 'execute-get_weather',
          result: mockResult,
        })
      );

      const result = await providerMCPService.executeMCPTool('weather_service', 'get_weather', {
        city: 'Jakarta',
      });

      expect(result).toEqual(mockResult);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        data: {
          jsonrpc: '2.0',
          id: 'execute-get_weather',
          method: 'tools/call',
          params: {
            name: 'get_weather',
            arguments: { city: 'Jakarta' },
          },
        },
      });
    });

    it('should handle MCP execution errors', async () => {
      mockFetch.mockResolvedValue(
        createMockAxiosResponse({
          jsonrpc: '2.0',
          id: 'execute-get_weather',
          error: {
            code: -32602,
            message: 'Invalid params',
          },
        })
      );

      await expect(
        providerMCPService.executeMCPTool('weather_service', 'get_weather', { city: 'Jakarta' })
      ).rejects.toThrow('MCP tool execution failed: Invalid params');
    });
  });

  describe('executeToolByName', () => {
    it('should parse tool name and execute successfully', async () => {
      const mockResult = { data: 'success' };

      mockFetch.mockResolvedValue(
        createMockAxiosResponse({
          jsonrpc: '2.0',
          id: 'execute-get_weather',
          result: mockResult,
        })
      );

      const result = await providerMCPService.executeToolByName('weather_service.get_weather', {
        city: 'Jakarta',
      });

      expect(result).toEqual(mockResult);
    });

    it('should reject invalid tool name formats', async () => {
      await expect(providerMCPService.executeToolByName('invalid', {})).rejects.toThrow(
        'Invalid function name format: invalid. Expected format: server.function'
      );

      await expect(providerMCPService.executeToolByName('too.many.parts', {})).rejects.toThrow(
        'Invalid function name format: too.many.parts. Expected format: server.function'
      );

      await expect(providerMCPService.executeToolByName('server.', {})).rejects.toThrow(
        'Invalid function name format: server.. Expected format: server.function'
      );
    });
  });

  describe('toolsCall', () => {
    it('should execute tool via toolsCall interface', async () => {
      const mockResult = { success: true };

      mockFetch.mockResolvedValue(
        createMockAxiosResponse({
          jsonrpc: '2.0',
          id: 'execute-get_weather',
          result: mockResult,
        })
      );

      const result = await providerMCPService.toolsCall('weather_service.get_weather', {
        city: 'Jakarta',
      });

      expect(result).toEqual(mockResult);
    });
  });

  describe('sendMCPRequest', () => {
    it('should send MCP request with proper headers', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 'test',
        method: 'test/method',
        params: {},
      };

      const mockResponse: MCPResponse = {
        jsonrpc: '2.0',
        id: 'test',
        result: { success: true },
      };

      mockFetch.mockResolvedValue(createMockAxiosResponse(mockResponse));

      const response = await providerMCPService.sendMCPRequest('weather_service', request);

      expect(response).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        data: request,
      });
    });

    it('should handle unknown servers', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 'test',
        method: 'test/method',
        params: {},
      };

      await expect(providerMCPService.sendMCPRequest('unknown_server', request)).rejects.toThrow(
        'MCP server not found: unknown_server'
      );
    });

    it('should handle unsupported transport types', async () => {
      // Mock config with unsupported transport
      const configWithStdio = {
        ...mockProvidersConfig,
        mcpServers: [
          {
            identifier: 'stdio_server',
            name: 'STDIO Server',
            description: 'Server with stdio transport',
            transport: 'stdio' as const,
            url: 'stdio://test',
          },
        ],
      };

      mockProviderConfig.getProvidersConfig = vi.fn().mockResolvedValue(configWithStdio);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 'test',
        method: 'test/method',
        params: {},
      };

      await expect(providerMCPService.sendMCPRequest('stdio_server', request)).rejects.toThrow(
        'Transport stdio not yet supported. Currently only HTTP transport is supported.'
      );
    });

    it('should return error response on network failure', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 'test',
        method: 'test/method',
        params: {},
      };

      mockFetch.mockRejectedValue(new Error('Network failure'));

      const response = await providerMCPService.sendMCPRequest('weather_service', request);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 'test',
        error: {
          code: -32603,
          message: 'MCP request failed: Network failure',
        },
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty MCP servers list', async () => {
      mockProviderConfig.getProvidersConfig = vi.fn().mockResolvedValue({
        mcpServers: [],
        restServers: [],
      });

      const tools = await providerMCPService.getAllMCPTools();
      expect(tools).toEqual([]);
    });

    it('should handle missing MCP servers in config', async () => {
      mockProviderConfig.getProvidersConfig = vi.fn().mockResolvedValue({
        restServers: [],
      });

      const tools = await providerMCPService.getAllMCPTools();
      expect(tools).toEqual([]);
    });

    it('should use default empty schema when tool has no inputSchema', async () => {
      mockFetch.mockResolvedValue(
        createMockAxiosResponse({
          jsonrpc: '2.0',
          id: 'tools-request',
          result: {
            tools: [
              {
                name: 'simple_tool',
                // No description or inputSchema
              },
            ],
          },
        })
      );

      const tools = await providerMCPService.getAllMCPTools();

      expect(tools[0]).toEqual({
        name: 'weather_service.simple_tool',
        description: 'MCP tool: simple_tool',
        parameters: { type: 'object', properties: {} },
      });
    });
  });
});
