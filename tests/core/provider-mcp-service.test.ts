import { beforeEach, describe, it, expect, vi, type MockedFunction } from 'vitest';
import { ProviderMCPService } from '../../src/core/provider-mcp-service.js';
import type { ProvidersConfigProviding } from '../../src/interface/providers-config-providing.js';
import type { ServersProviding } from '../../src/interface/servers-providing.js';
import type { ProvidersConfig } from '../../src/model/providers.js';
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
  let mockServersProvider: ServersProviding;
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
      clearCache: vi.fn(),
      getAvailableServers: vi.fn(),
      getServerHash: vi.fn(),
      updateServerToolCount: vi.fn(),
    };

    // Mock servers provider
    mockServersProvider = {
      getAvailableServers: vi.fn(),
      getServerHash: vi.fn(),
    };

    // Mock fetch helper
    mockFetch = vi.mocked(fetchHelper.fetchWithDefaultTimeout);

    // Create service instance
    providerMCPService = new ProviderMCPService(mockProviderConfig);

    // Set the servers provider
    providerMCPService.setServersProvider(mockServersProvider);
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
      expect(await providerMCPService.canHandleRequest('s1r2dj4_get_weather')).toBe(true);
      expect(await providerMCPService.canHandleRequest('shdy86m_read_file')).toBe(true);
    });

    it('should return false for REST server tool names', async () => {
      expect(await providerMCPService.canHandleRequest('userApi_getUser')).toBe(false);
    });

    it('should return false for invalid tool name formats', async () => {
      expect(await providerMCPService.canHandleRequest('invalid')).toBe(false);
      expect(await providerMCPService.canHandleRequest('too_many_parts_here')).toBe(false);
      expect(await providerMCPService.canHandleRequest('')).toBe(false);
    });

    it('should return false for unknown servers', async () => {
      expect(await providerMCPService.canHandleRequest('unknownServer_someTool')).toBe(false);
    });
  });

  // Note: isMCPServer is a private method, so we test its behavior indirectly through canHandleRequest

  describe('MCP tools handling', () => {
    it('should fetch tools from MCP server successfully via toolsList', async () => {
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

      const tools = await providerMCPService.toolsList();

      expect(tools).toHaveLength(2); // One from each server
      expect(tools[0].name).toBe('s1r2dj4_get_weather');
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

    it('should handle MCP error responses via toolsList', async () => {
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

      // Should handle errors gracefully and continue with other servers
      const tools = await providerMCPService.toolsList();
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should handle network errors via toolsList', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      // Should handle errors gracefully and return empty array or partial results
      const tools = await providerMCPService.toolsList();
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should return empty tools when no tools in response', async () => {
      mockFetch.mockResolvedValue(
        createMockAxiosResponse({
          jsonrpc: '2.0',
          id: 'tools-request',
          result: {},
        })
      );

      const tools = await providerMCPService.toolsList();
      expect(Array.isArray(tools)).toBe(true);
    });
  });

  describe('toolsList - comprehensive testing', () => {
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

      const tools = await providerMCPService.toolsList();

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('s1r2dj4_get_weather');
      expect(tools[1].name).toBe('shdy86m_read_file');
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

      const tools = await providerMCPService.toolsList();

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('shdy86m_read_file');
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
      expect(tools[0].name).toBe('s1r2dj4_test_tool');
      expect(tools[1].name).toBe('shdy86m_test_tool');
    });
  });

  describe('toolsCall - MCP tool execution', () => {
    it('should execute MCP tool successfully', async () => {
      const mockResult = { temperature: 25, condition: 'sunny' };

      mockFetch.mockResolvedValue(
        createMockAxiosResponse({
          jsonrpc: '2.0',
          id: 'execute-get_weather',
          result: mockResult,
        })
      );

      const result = await providerMCPService.toolsCall('s1r2dj4_get_weather', {
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
        providerMCPService.toolsCall('s1r2dj4_get_weather', { city: 'Jakarta' })
      ).rejects.toThrow('MCP tool execution failed: Invalid params');
    });

    it('should reject invalid tool name formats', async () => {
      await expect(providerMCPService.toolsCall('invalid', {})).rejects.toThrow(
        'Invalid function name format: invalid. Expected format: s{hash}_{snake_case_function}'
      );

      await expect(providerMCPService.toolsCall('too_many_parts_here', {})).rejects.toThrow(
        'Invalid function name format: too_many_parts_here. Expected format: s{hash}_{snake_case_function}'
      );

      await expect(providerMCPService.toolsCall('server_', {})).rejects.toThrow(
        'Invalid function name format: server_. Expected format: s{hash}_{snake_case_function}'
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

      const result = await providerMCPService.toolsCall('s1r2dj4_get_weather', {
        city: 'Jakarta',
      });

      expect(result).toEqual(mockResult);
    });
  });

  describe('edge cases', () => {
    it('should handle empty MCP servers list', async () => {
      mockProviderConfig.getProvidersConfig = vi.fn().mockResolvedValue({
        mcpServers: [],
        restServers: [],
      });

      const tools = await providerMCPService.toolsList();
      expect(tools).toEqual([]);
    });

    it('should handle missing MCP servers in config', async () => {
      mockProviderConfig.getProvidersConfig = vi.fn().mockResolvedValue({
        restServers: [],
      });

      const tools = await providerMCPService.toolsList();
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

      const tools = await providerMCPService.toolsList();

      expect(tools[0]).toEqual({
        name: 's1r2dj4_simple_tool',
        description: 'MCP tool: simple_tool',
        parameters: { type: 'object', properties: {} },
      });
    });
  });
});
