import { beforeEach, describe, it, expect, vi, type MockedFunction } from 'vitest';
import { ProviderRESTService } from '../../src/core/provider-rest-service.js';
import type { ProvidersConfigProviding } from '../../src/interface/providers-config-providing.js';
import type { ServersProviding } from '../../src/interface/servers-providing.js';
import type { ProvidersConfig, RESTServer } from '../../src/model/providers.js';
import type { AxiosResponse } from 'axios';
import * as fetchHelper from '../../src/utils/fetch-helper.js';
import jwtHelper from '../../src/utils/jwt-helper.js';

// Mock fetch helper
vi.mock('../../src/utils/fetch-helper.js', () => ({
  fetchWithDefaultTimeout: vi.fn(),
}));

// Mock JWT helper
vi.mock('../../src/utils/jwt-helper.js', () => ({
  default: {
    getToken: vi.fn(),
  },
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
  let mockJwtHelper: MockedFunction<typeof jwtHelper.getToken>;

  const mockRestServer: RESTServer = {
    identifier: 'user_api',
    name: 'User API',
    description: 'Legacy REST API for user management',
    config: {
      url: 'http://localhost:5000/api',
      defaultHeaders: {
        Authorization: 'Bearer api-token',
      },
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
    transport: 'http',
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
    mockJwtHelper = vi.mocked(jwtHelper.getToken);
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
        name: 'sft7he_get_user',
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
        name: 'sft7he_create_user',
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
        name: 'sft7he_update_user',
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

      const result = await providerRESTService.toolsCall('sft7he_get_user', {
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

      const result = await providerRESTService.toolsCall('sft7he_create_user', {
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

      const result = await providerRESTService.toolsCall('sft7he_update_user', {
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

      await providerRESTService.toolsCall('sft7he_get_user', {
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
        'Invalid function name format: invalidToolName. Expected format: {hash}_{snake_case_function}'
      );
    });

    it('should throw error for empty server identifier', async () => {
      await expect(providerRESTService.toolsCall('_functionName', {})).rejects.toThrow(
        'Invalid function name format: _functionName. Expected format: {hash}_{snake_case_function}'
      );
    });

    it('should throw error for non-existent server', async () => {
      await expect(providerRESTService.toolsCall('999999_function', {})).rejects.toThrow(
        'REST server not found for hash: 999999'
      );
    });

    it('should throw error for non-existent endpoint', async () => {
      await expect(
        providerRESTService.toolsCall('sft7he_non_existent_function', {})
      ).rejects.toThrow('REST endpoint not found: non_existent_function in server user_api');
    });

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValue(createMockAxiosResponse({}, 404));

      await expect(
        providerRESTService.toolsCall('sft7he_get_user', { userId: '123' })
      ).rejects.toThrow('REST call failed with status 404: Error');
    });

    it('should handle fetch rejection', async () => {
      const networkError = new Error('Network error');
      mockFetch.mockRejectedValue(networkError);

      await expect(
        providerRESTService.toolsCall('sft7he_get_user', { userId: '123' })
      ).rejects.toThrow('REST execution failed: Network error');
    });

    it('should log REST call execution', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockFetch.mockResolvedValue(createMockAxiosResponse({}));

      await providerRESTService.toolsCall('sft7he_get_user', { userId: '123' });

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
        providerRESTService.toolsCall('sft7he_get_user', { userId: '123' })
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
      const canHandle = await providerRESTService.canHandleRequest('sft7he_get_user');
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

      await providerRESTService.toolsCall('sft7he_create_user', {
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

      await providerRESTService.toolsCall('sft7he_get_user', {
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

      await providerRESTService.toolsCall('sft7he_get_user', {
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

  describe('response transformations', () => {
    const mockRestServerWithTransforms: RESTServer = {
      identifier: 'transform_api',
      name: 'Transform API',
      description: 'API with response transformations',
      config: { url: 'http://localhost:5000/api' },
      endPoints: [
        {
          name: 'get_status',
          description: 'Get status with transformations',
          path: '/status',
          method: 'GET',
          response_transform: [
            {
              path: 'status',
              transform: 'map',
              map: { '0': 'Offline', '1': 'Online', '2': 'Away' },
            },
            {
              path: 'last_seen',
              transform: 'date_format',
              format: 'YYYY-MM-DD HH:mm:ss',
            },
            {
              path: 'debug_info',
              transform: 'remove',
            },
          ],
        },
      ],
      transport: 'http',
    };

    beforeEach(() => {
      const configWithTransforms = {
        restServers: [mockRestServerWithTransforms],
        mcpServers: [],
      };
      mockProviderConfig.getProvidersConfig = vi.fn().mockResolvedValue(configWithTransforms);
    });

    it('should apply transformations to response data', async () => {
      const mockResponse = {
        status: '1',
        last_seen: '2023-12-25T10:30:45.000Z',
        debug_info: { trace: 'sensitive' },
        message: 'Hello',
      };
      mockFetch.mockResolvedValue(createMockAxiosResponse(mockResponse));

      // Get the correct function name from tools list
      const tools = await providerRESTService.toolsList();
      const statusTool = tools.find((tool) => tool.name.includes('get_status'));
      expect(statusTool).toBeDefined();

      const result = await providerRESTService.toolsCall(statusTool!.name, {});

      expect(result).toEqual({
        status: 'Online',
        last_seen: '2023-12-25 10:30:45',
        message: 'Hello',
        // debug_info should be removed
      });
      expect(result).not.toHaveProperty('debug_info');
    });
  });

  describe('JWT Authentication', () => {
    const mockJwtRestServer: RESTServer = {
      identifier: 'secure_api',
      name: 'Secure API',
      description: 'JWT secured REST API',
      transport: 'http',
      config: {
        url: 'https://secure-api.example.com/api',
        auth: {
          type: 'jwt',
          config: {
            token: 'static-jwt-token',
          },
        },
      },
      endPoints: [
        {
          name: 'get_secure_data',
          description: 'Get secure data',
          path: '/secure/data',
          method: 'GET',
        },
      ],
    };

    const mockOAuthRestServer: RESTServer = {
      identifier: 'oauth_api',
      name: 'OAuth API',
      description: 'OAuth2 JWT REST API',
      transport: 'http',
      config: {
        url: 'https://oauth-api.example.com/api',
        auth: {
          type: 'jwt',
          config: {
            tokenUrl: 'https://auth.example.com/oauth/token',
            clientId: 'client123',
            clientSecret: 'secret456',
            audience: 'api-audience',
            refreshThreshold: 5,
          },
        },
      },
      endPoints: [
        {
          name: 'create_resource',
          description: 'Create resource with OAuth JWT',
          path: '/resources',
          method: 'POST',
          payload: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
            required: ['name'],
          },
        },
      ],
    };

    it('should include JWT token in headers for static token auth', async () => {
      const mockConfig = {
        restServers: [mockJwtRestServer],
        mcpServers: [],
      };
      mockProviderConfig.getProvidersConfig = vi.fn().mockResolvedValue(mockConfig);
      mockJwtHelper.mockResolvedValue('test-jwt-token');

      const mockResponse = { data: 'secure data' };
      mockFetch.mockResolvedValue(createMockAxiosResponse(mockResponse));

      // Get tools and execute
      const tools = await providerRESTService.toolsList();
      const secureDataTool = tools.find((tool) => tool.name.includes('get_secure_data'));
      expect(secureDataTool).toBeDefined();

      const result = await providerRESTService.toolsCall(secureDataTool!.name, {});

      expect(mockJwtHelper).toHaveBeenCalledWith({
        token: 'static-jwt-token',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://secure-api.example.com/api/secure/data',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-jwt-token',
            'Content-Type': 'application/json',
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should include JWT token in headers for OAuth2 auth', async () => {
      const mockConfig = {
        restServers: [mockOAuthRestServer],
        mcpServers: [],
      };
      mockProviderConfig.getProvidersConfig = vi.fn().mockResolvedValue(mockConfig);
      mockJwtHelper.mockResolvedValue('oauth-jwt-token');

      const mockResponse = { id: '123', name: 'Test Resource' };
      mockFetch.mockResolvedValue(createMockAxiosResponse(mockResponse));

      // Get tools and execute
      const tools = await providerRESTService.toolsList();
      const createResourceTool = tools.find((tool) => tool.name.includes('create_resource'));
      expect(createResourceTool).toBeDefined();

      const result = await providerRESTService.toolsCall(createResourceTool!.name, {
        payload: { name: 'Test Resource' },
      });

      expect(mockJwtHelper).toHaveBeenCalledWith({
        tokenUrl: 'https://auth.example.com/oauth/token',
        clientId: 'client123',
        clientSecret: 'secret456',
        audience: 'api-audience',
        refreshThreshold: 5,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth-api.example.com/api/resources',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer oauth-jwt-token',
            'Content-Type': 'application/json',
          }),
          data: { name: 'Test Resource' },
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should handle JWT token generation errors', async () => {
      const mockConfig = {
        restServers: [mockJwtRestServer],
        mcpServers: [],
      };
      mockProviderConfig.getProvidersConfig = vi.fn().mockResolvedValue(mockConfig);
      mockJwtHelper.mockRejectedValue(new Error('Token generation failed'));

      const tools = await providerRESTService.toolsList();
      const secureDataTool = tools.find((tool) => tool.name.includes('get_secure_data'));
      expect(secureDataTool).toBeDefined();

      await expect(providerRESTService.toolsCall(secureDataTool!.name, {})).rejects.toThrow(
        'Token generation failed'
      );

      expect(mockJwtHelper).toHaveBeenCalledWith({
        token: 'static-jwt-token',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should work without JWT auth when not configured', async () => {
      const mockResponse = { users: [] };
      mockFetch.mockResolvedValue(createMockAxiosResponse(mockResponse));

      // Use original server without JWT auth
      const result = await providerRESTService.toolsCall('sft7he_create_user', {
        payload: { name: 'Test', email: 'test@example.com' },
      });

      expect(mockJwtHelper).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/users',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer api-token', // From defaultHeaders
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });
  });
});
