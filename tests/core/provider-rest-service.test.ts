import { beforeEach, describe, it, expect, vi, type MockedFunction } from 'vitest';
import { ProviderRESTService } from '../../src/core/provider-rest-service.js';
import type { ProvidersConfigProviding } from '../../src/interface/providers-config-providing.js';
import type { ServersProviding } from '../../src/interface/servers-providing.js';
import type { ProvidersConfig, RESTServer } from '../../src/model/providers.js';
import type { AxiosResponse } from 'axios';
import * as fetchHelper from '../../src/utils/fetch-helper.js';

// Mock fetch helper
vi.mock('../../src/utils/fetch-helper.js', () => ({
  fetchWithDefaultTimeout: vi.fn(),
}));

// Helper to create mock AxiosResponse
const createMockAxiosResponse = <T>(data: T, status = 200): AxiosResponse<T> => ({
  data,
  status,
  statusText: status === 200 ? 'OK' : 'Error',
  headers: {},
  config: {} as any,
});

describe('ProviderRESTService', () => {
  let mockProviderConfig: ProvidersConfigProviding;
  let mockServersProvider: ServersProviding;
  let providerRESTService: ProviderRESTService;
  let mockFetch: MockedFunction<typeof fetchHelper.fetchWithDefaultTimeout>;

  const mockRestServer: RESTServer = {
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
            include_profile: { type: 'boolean' },
          },
        },
      },
      {
        name: 'create_user',
        description: 'Create a new user',
        path: '/users',
        method: 'POST',
        payload: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
          },
          required: ['name', 'email'],
        },
      },
      {
        name: 'update_user',
        description: 'Update user with path and query parameters',
        path: '/users/{userId}/profile',
        method: 'PUT',
        headers: {
          'X-Custom-Header': 'custom-value',
        },
        parameters: {
          type: 'object',
          properties: {
            notify: { type: 'boolean' },
          },
        },
        payload: {
          type: 'object',
          properties: {
            bio: { type: 'string' },
          },
        },
      },
    ],
  };

  const mockProvidersConfig: ProvidersConfig = {
    mcpServers: [],
    restServers: [mockRestServer],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockProviderConfig = {
      getProvidersConfig: vi.fn().mockResolvedValue(mockProvidersConfig),
      clearCache: vi.fn(),
      getAvailableServers: vi.fn(),
      getServerHash: vi.fn(),
      updateServerToolCount: vi.fn(),
    };

    // Mock servers provider (assuming REST servers come after MCP servers)
    mockServersProvider = {
      getAvailableServers: vi.fn(),
      getServerHash: vi.fn(),
    };

    providerRESTService = new ProviderRESTService(mockProviderConfig);

    // Set the servers provider
    providerRESTService.setServersProvider(mockServersProvider);

    mockFetch = vi.mocked(fetchHelper.fetchWithDefaultTimeout);
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await providerRESTService.initialize();

      expect(consoleSpy).toHaveBeenCalledWith(
        '🔄 [ProviderRESTService] Initializing REST provider service...'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        '✅ [ProviderRESTService] REST provider service initialized'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('toolsList', () => {
    it('should return tools from all REST servers', async () => {
      const tools = await providerRESTService.toolsList();

      expect(tools).toHaveLength(3);
      expect(tools[0]).toEqual({
        name: 'ssft7he_get_user',
        description: 'Get user information by ID',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            query: {
              type: 'object',
              properties: {
                include_profile: { type: 'boolean' },
              },
              required: [],
            },
          },
          required: ['userId'],
        },
      });

      expect(tools[1]).toEqual({
        name: 'ssft7he_create_user',
        description: 'Create a new user',
        parameters: {
          type: 'object',
          properties: {
            payload: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                email: { type: 'string' },
              },
              required: ['name', 'email'],
            },
          },
          required: [],
        },
      });

      expect(tools[2]).toEqual({
        name: 'ssft7he_update_user',
        description: 'Update user with path and query parameters',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            query: {
              type: 'object',
              properties: {
                notify: { type: 'boolean' },
              },
              required: [],
            },
            payload: {
              type: 'object',
              properties: {
                bio: { type: 'string' },
              },
              required: [],
            },
          },
          required: ['userId'],
        },
      });
    });

    it('should handle empty REST servers', async () => {
      mockProviderConfig.getProvidersConfig = vi.fn().mockResolvedValue({ restServers: [] });

      const tools = await providerRESTService.toolsList();

      expect(tools).toEqual([]);
    });

    it('should continue with other servers if one fails', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const failingConfig = {
        restServers: [
          { ...mockRestServer, identifier: 'failing_server', endPoints: undefined as any },
          mockRestServer,
        ],
      };
      mockProviderConfig.getProvidersConfig = vi.fn().mockResolvedValue(failingConfig);

      const tools = await providerRESTService.toolsList();

      expect(tools).toHaveLength(3); // Only tools from working server
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get tools from REST server failing_server'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('toolsCall', () => {
    it('should execute GET request with path parameters and query parameters', async () => {
      const mockResponse = { id: '123', name: 'John Doe', email: 'john@example.com' };
      mockFetch.mockResolvedValue(createMockAxiosResponse(mockResponse));

      const result = await providerRESTService.toolsCall('ssft7he_get_user', {
        userId: '123',
        query: { include_profile: true },
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/users/123?include_profile=true',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer api-token',
          },
        }
      );
    });

    it('should execute POST request with payload', async () => {
      const mockResponse = { id: '456', name: 'Jane Doe', email: 'jane@example.com' };
      mockFetch.mockResolvedValue(createMockAxiosResponse(mockResponse));

      const result = await providerRESTService.toolsCall('ssft7he_create_user', {
        payload: { name: 'Jane Doe', email: 'jane@example.com' },
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:5000/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer api-token',
        },
        data: { name: 'Jane Doe', email: 'jane@example.com' },
      });
    });

    it('should execute PUT request with path parameters, query parameters, and payload', async () => {
      const mockResponse = { success: true };
      mockFetch.mockResolvedValue(createMockAxiosResponse(mockResponse));

      const result = await providerRESTService.toolsCall('ssft7he_update_user', {
        userId: '789',
        query: { notify: false },
        payload: { bio: 'Updated bio' },
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/users/789/profile?notify=false',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer api-token',
            'X-Custom-Header': 'custom-value',
          },
          data: { bio: 'Updated bio' },
        }
      );
    });

    it('should handle request without query parameters', async () => {
      const mockResponse = { id: '123', name: 'John Doe' };
      mockFetch.mockResolvedValue(createMockAxiosResponse(mockResponse));

      await providerRESTService.toolsCall('ssft7he_get_user', {
        userId: '123',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/users/123',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should throw error for invalid tool name format', async () => {
      await expect(providerRESTService.toolsCall('invalidToolName', {})).rejects.toThrow(
        'Invalid function name format: invalidToolName. Expected format: s{hash}_{snake_case_function}'
      );
    });

    it('should throw error for empty server identifier', async () => {
      await expect(providerRESTService.toolsCall('_functionName', {})).rejects.toThrow(
        'Invalid function name format: _functionName. Expected format: s{hash}_{snake_case_function}'
      );
    });

    it('should throw error for non-existent server', async () => {
      await expect(providerRESTService.toolsCall('s999999_function', {})).rejects.toThrow(
        'REST server not found for hash: 999999'
      );
    });

    it('should throw error for non-existent endpoint', async () => {
      await expect(
        providerRESTService.toolsCall('ssft7he_non_existent_function', {})
      ).rejects.toThrow('REST endpoint not found: non_existent_function in server user_api');
    });

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValue(createMockAxiosResponse({}, 404));

      await expect(
        providerRESTService.toolsCall('ssft7he_get_user', { userId: '123' })
      ).rejects.toThrow('REST call failed with status 404: Error');
    });

    it('should handle fetch rejection', async () => {
      const networkError = new Error('Network error');
      mockFetch.mockRejectedValue(networkError);

      await expect(
        providerRESTService.toolsCall('ssft7he_get_user', { userId: '123' })
      ).rejects.toThrow('REST execution failed: Network error');
    });

    it('should log REST call execution', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockFetch.mockResolvedValue(createMockAxiosResponse({}));

      await providerRESTService.toolsCall('ssft7he_get_user', { userId: '123' });

      expect(consoleSpy).toHaveBeenCalledWith(
        '🌐 [RESTService] Executing REST tool: user_api.get_user'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        '🚀 [RESTService] Calling GET http://localhost:5000/api/users/123'
      );
      expect(consoleSpy).toHaveBeenCalledWith('✅ [RESTService] REST call successful');

      consoleSpy.mockRestore();
    });

    it('should log REST call failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const networkError = new Error('Network error');
      mockFetch.mockRejectedValue(networkError);

      await expect(
        providerRESTService.toolsCall('ssft7he_get_user', { userId: '123' })
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ [RESTService] REST call failed:',
        networkError
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('canHandleRequest', () => {
    it('should return true for valid REST server tool names', async () => {
      const canHandle = await providerRESTService.canHandleRequest('ssft7he_get_user');
      expect(canHandle).toBe(true);
    });

    it('should return false for invalid tool name format', async () => {
      const canHandle = await providerRESTService.canHandleRequest('invalidFormat');
      expect(canHandle).toBe(false);
    });

    it('should return false for non-existent server', async () => {
      const canHandle = await providerRESTService.canHandleRequest('nonExistent_function');
      expect(canHandle).toBe(false);
    });

    it('should return false for MCP server identifiers', async () => {
      const mcpConfig = {
        mcpServers: [
          {
            identifier: 'mcp_server',
            name: 'MCP Server',
            description: '',
            transport: 'http' as const,
            url: '',
          },
        ],
        restServers: [],
      };
      mockProviderConfig.getProvidersConfig = vi.fn().mockResolvedValue(mcpConfig);

      const canHandle = await providerRESTService.canHandleRequest('mcpServer_function');
      expect(canHandle).toBe(false);
    });
  });

  describe('complex parameter scenarios', () => {
    it('should handle endpoints without path parameters', async () => {
      const mockResponse = { users: [] };
      mockFetch.mockResolvedValue(createMockAxiosResponse(mockResponse));

      await providerRESTService.toolsCall('ssft7he_create_user', {
        payload: { name: 'Test', email: 'test@example.com' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/users',
        expect.objectContaining({
          method: 'POST',
          data: { name: 'Test', email: 'test@example.com' },
        })
      );
    });

    it('should handle endpoints without query parameters', async () => {
      const mockResponse = { id: '123' };
      mockFetch.mockResolvedValue(createMockAxiosResponse(mockResponse));

      await providerRESTService.toolsCall('ssft7he_get_user', {
        userId: '123',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/users/123',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should handle endpoints without payload', async () => {
      const mockResponse = { deleted: true };
      mockFetch.mockResolvedValue(createMockAxiosResponse(mockResponse));

      await providerRESTService.toolsCall('ssft7he_get_user', {
        userId: '123',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/users/123',
        expect.not.objectContaining({
          data: expect.anything(),
        })
      );
    });
  });
});
