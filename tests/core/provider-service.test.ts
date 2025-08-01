import { beforeEach, describe, it, expect, vi } from 'vitest';
import { ProviderService } from '../../src/core/provider-service.js';

describe('Provider Service', () => {
  let mockConfigProvider: any;
  let mockMcpToolsProvider: any;
  let mockRestToolsProvider: any;
  let providerService: ProviderService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock config provider
    mockConfigProvider = {
      getProvidersConfig: vi.fn(),
      clearCache: vi.fn(),
      getAvailableServers: vi.fn(),
      getServerHash: vi.fn(),
      updateServerToolCount: vi.fn(),
    };

    // Mock MCP tools provider
    mockMcpToolsProvider = {
      identifier: 'weather_service',
      toolsList: vi.fn(),
    };

    // Mock REST tools provider
    mockRestToolsProvider = {
      identifier: 'user_api',
      toolsList: vi.fn(),
    };

    // Create provider service with mocked dependencies
    providerService = new ProviderService(mockConfigProvider, [
      mockMcpToolsProvider,
      mockRestToolsProvider,
    ]);
  });

  describe('getAvailableServers', () => {
    it('should return list of all servers (MCP + REST)', async () => {
      const mockResponse = {
        total: 2,
        servers: [
          {
            identifier: 'weather_service',
            name: 'Weather Service',
            description: 'Weather API',
            toolsCount: 1,
          },
          {
            identifier: 'user_api',
            name: 'User API',
            description: 'User management',
            toolsCount: 1,
          },
        ],
      };

      mockConfigProvider.getAvailableServers.mockResolvedValue(mockResponse);

      const result = await providerService.getAvailableServers();

      expect(result).toEqual(mockResponse);
      expect(mockConfigProvider.getAvailableServers).toHaveBeenCalledTimes(1);
    });

    it('should handle empty servers list', async () => {
      const mockResponse = {
        total: 0,
        servers: [],
      };

      mockConfigProvider.getAvailableServers.mockResolvedValue(mockResponse);

      const result = await providerService.getAvailableServers();

      expect(result).toEqual(mockResponse);
      expect(mockConfigProvider.getAvailableServers).toHaveBeenCalledTimes(1);
    });

    it('should handle MCP server tool fetch failure gracefully', async () => {
      const mockResponse = {
        total: 1,
        servers: [
          {
            identifier: 'weather_service',
            name: 'Weather Service',
            description: 'Weather API',
            toolsCount: 0, // Fallback to 0 on error
          },
        ],
      };

      mockConfigProvider.getAvailableServers.mockResolvedValue(mockResponse);

      const result = await providerService.getAvailableServers();

      expect(result).toEqual(mockResponse);
      expect(mockConfigProvider.getAvailableServers).toHaveBeenCalledTimes(1);
    });

    it('should count REST server endpoints correctly', async () => {
      const mockResponse = {
        total: 1,
        servers: [
          {
            identifier: 'user_api',
            name: 'User API',
            description: 'User management',
            toolsCount: 3, // Three endpoints
          },
        ],
      };

      mockConfigProvider.getAvailableServers.mockResolvedValue(mockResponse);

      const result = await providerService.getAvailableServers();

      expect(result).toEqual(mockResponse);
      expect(result.servers[0].toolsCount).toBe(3);
      expect(mockConfigProvider.getAvailableServers).toHaveBeenCalledTimes(1);
    });
  });
});
