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
      getProvidersConfig: vi.fn()
    };

    // Mock MCP tools provider
    mockMcpToolsProvider = {
      identifier: 'weather_service',
      toolsList: vi.fn()
    };

    // Mock REST tools provider
    mockRestToolsProvider = {
      identifier: 'user_api',
      toolsList: vi.fn()
    };

    // Create provider service with mocked dependencies
    providerService = new ProviderService(mockConfigProvider, [mockMcpToolsProvider, mockRestToolsProvider]);
  });

  describe('getAvailableServers', () => {
    it('should return list of all servers (MCP + REST)', async () => {
      mockConfigProvider.getProvidersConfig.mockResolvedValue({
        mcpServers: [
          { 
            identifier: "weather_service", 
            name: "Weather Service", 
            description: "Weather API",
            transport: "http", 
            url: "http://localhost:4000/mcp" 
          }
        ],
        restServers: [
          { 
            identifier: "user_api", 
            name: "User API", 
            description: "User management",
            url: "http://localhost:5000/api",
            endPoints: [
              { name: "get_user", description: "Get user", path: "/users/{userId}", method: "GET" }
            ]
          }
        ]
      });

      mockMcpToolsProvider.toolsList.mockResolvedValue([
        { name: 'weather_service.get_weather', description: 'Get weather data' }
      ]);

      const result = await providerService.getAvailableServers();

      expect(result.total).toBe(2);
      expect(result.servers).toHaveLength(2);
      expect(result.servers[0].identifier).toBe('weather_service');
      expect(result.servers[0].toolsCount).toBe(1); // From MCP tools
      expect(result.servers[1].identifier).toBe('user_api');
      expect(result.servers[1].toolsCount).toBe(1); // From REST endpoints
    });

    it('should handle empty servers list', async () => {
      mockConfigProvider.getProvidersConfig.mockResolvedValue({ 
        mcpServers: [], 
        restServers: [] 
      });

      const result = await providerService.getAvailableServers();

      expect(result.total).toBe(0);
      expect(result.servers).toHaveLength(0);
    });

    it('should handle MCP server tool fetch failure gracefully', async () => {
      mockConfigProvider.getProvidersConfig.mockResolvedValue({
        mcpServers: [
          { 
            identifier: "weather_service", 
            name: "Weather Service", 
            description: "Weather API"
          }
        ],
        restServers: []
      });

      mockMcpToolsProvider.toolsList.mockRejectedValue(new Error('Connection failed'));

      const result = await providerService.getAvailableServers();

      expect(result.total).toBe(1);
      expect(result.servers[0].toolsCount).toBe(0); // Fallback to 0 on error
    });

    it('should count REST server endpoints correctly', async () => {
      mockConfigProvider.getProvidersConfig.mockResolvedValue({
        mcpServers: [],
        restServers: [
          { 
            identifier: "user_api", 
            name: "User API", 
            description: "User management",
            url: "http://localhost:5000/api",
            endPoints: [
              { name: "get_user", description: "Get user", path: "/users/{userId}", method: "GET" },
              { name: "create_user", description: "Create user", path: "/users", method: "POST" },
              { name: "update_user", description: "Update user", path: "/users/{userId}", method: "PUT" }
            ]
          }
        ]
      });

      const result = await providerService.getAvailableServers();

      expect(result.servers[0].toolsCount).toBe(3);
    });
  });

  describe('getServerTools', () => {
    it('should get tools from MCP server', async () => {
      const mockTools = [
        { name: 'weather_service.get_weather', description: 'Get weather data' },
        { name: 'weather_service.get_forecast', description: 'Get weather forecast' }
      ];

      mockMcpToolsProvider.toolsList.mockResolvedValue(mockTools);

      const result = await providerService.getServerTools('weather_service');

      expect(result.tools).toEqual(mockTools);
      expect(mockMcpToolsProvider.toolsList).toHaveBeenCalledTimes(1);
    });

    it('should get tools from REST server', async () => {
      const mockTools = [
        { name: 'user_api.get_user', description: 'Get user by ID' },
        { name: 'user_api.create_user', description: 'Create new user' }
      ];

      mockRestToolsProvider.toolsList.mockResolvedValue(mockTools);

      const result = await providerService.getServerTools('user_api');

      expect(result.tools).toEqual(mockTools);
      expect(mockRestToolsProvider.toolsList).toHaveBeenCalledTimes(1);
    });

    it('should throw error for non-existent server', async () => {
      await expect(providerService.getServerTools('non_existent')).rejects.toThrow('Server not found: non_existent');
    });

    it('should propagate error from tools provider', async () => {
      mockMcpToolsProvider.toolsList.mockRejectedValue(new Error('MCP server unreachable'));

      await expect(providerService.getServerTools('weather_service')).rejects.toThrow('MCP server unreachable');
    });
  });
});
