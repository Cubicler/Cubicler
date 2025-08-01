import { beforeEach, describe, it, expect, vi } from 'vitest';
import { InternalToolsService } from '../../src/core/internal-tools-service.js';
import type { ToolsListProviding } from '../../src/interface/tools-list-providing.js';
import type { ToolDefinition } from '../../src/model/tools.js';

describe('Internal Tools Service', () => {
  let internalToolsService: InternalToolsService;
  let mockToolsProviders: ToolsListProviding[];

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock tools providers
    const mockProvider1: ToolsListProviding = {
      identifier: 'weather_service',
      toolsList: vi.fn(),
    };

    const mockProvider2: ToolsListProviding = {
      identifier: 'search_service', 
      toolsList: vi.fn(),
    };

    mockToolsProviders = [mockProvider1, mockProvider2];

    // Create internal tools service with mocked dependencies
    internalToolsService = new InternalToolsService(mockToolsProviders);
  });

  describe('toolsList', () => {
    it('should return list of internal tools', async () => {
      const tools = await internalToolsService.toolsList();

      expect(tools).toHaveLength(2);

      // Check cubicler_availableServers tool
      const availableServersTool = tools.find((t: any) => t.name === 'cubicler_availableServers');
      expect(availableServersTool).toBeDefined();
      expect(availableServersTool?.description).toContain('available servers');
      expect(availableServersTool?.parameters.type).toBe('object');

      // Check cubicler_fetchServerTools tool
      const fetchServerToolsTool = tools.find((t: any) => t.name === 'cubicler_fetchServerTools');
      expect(fetchServerToolsTool).toBeDefined();
      expect(fetchServerToolsTool?.description).toContain('tools from one particular server');
      expect(fetchServerToolsTool?.parameters.required).toContain('serverIdentifier');
    });
  });

  describe('identifier', () => {
    it('should return correct identifier', () => {
      expect(internalToolsService.identifier).toBe('cubicler');
    });
  });

  describe('toolsCall', () => {
    it('should throw error for unknown internal tool', async () => {
      await expect(internalToolsService.toolsCall('cubicler_unknownTool', {})).rejects.toThrow(
        'Unknown internal tool: cubicler_unknownTool'
      );
    });

    it('should throw error for missing serverIdentifier in fetch_server_tools', async () => {
      await expect(
        internalToolsService.toolsCall('cubicler_fetchServerTools', {})
      ).rejects.toThrow('Missing required parameter: serverIdentifier');
    });

    it('should execute cubicler_availableServers successfully', async () => {
      const mockTools: ToolDefinition[] = [
        {
          name: 'weatherService_getWeather',
          description: 'Get weather data',
          parameters: { type: 'object', properties: {} },
        },
        {
          name: 'weatherService_getForecast',
          description: 'Get weather forecast',
          parameters: { type: 'object', properties: {} },
        },
        {
          name: 'searchService_search',
          description: 'Search for content',
          parameters: { type: 'object', properties: {} },
        },
      ];

      vi.mocked(mockToolsProviders[0].toolsList).mockResolvedValue([
        mockTools[0],
        mockTools[1],
      ]);

      vi.mocked(mockToolsProviders[1].toolsList).mockResolvedValue([mockTools[2]]);

      const result = await internalToolsService.toolsCall('cubicler_availableServers', {});

      expect(result).toEqual({
        total: 2,
        servers: [
          {
            identifier: 'weatherService',
            name: 'Weather Service',
            description: 'weather_service server: weatherService',
            toolsCount: 2,
          },
          {
            identifier: 'searchService',
            name: 'Search Service',
            description: 'search_service server: searchService',
            toolsCount: 1,
          },
        ],
      });
    });

    it('should execute cubicler_fetchServerTools for cubicler server', async () => {
      const result = await internalToolsService.toolsCall('cubicler_fetchServerTools', {
        serverIdentifier: 'cubicler',
      });

      expect(result).toEqual({
        tools: [
          {
            name: 'cubicler_availableServers',
            description: 'Get information about available servers managed by Cubicler',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'cubicler_fetchServerTools',
            description: 'Get tools from one particular server managed by Cubicler',
            parameters: {
              type: 'object',
              properties: {
                serverIdentifier: {
                  type: 'string',
                  description: 'Identifier of the server to fetch tools from',
                },
              },
              required: ['serverIdentifier'],
            },
          },
        ],
      });
    });

    it('should execute cubicler_fetchServerTools for external server', async () => {
      const mockWeatherTools: ToolDefinition[] = [
        {
          name: 'weatherService_getWeather',
          description: 'Get weather',
          parameters: { type: 'object', properties: {} },
        },
      ];

      const mockSearchTools: ToolDefinition[] = [
        {
          name: 'searchService_search',
          description: 'Search for content',
          parameters: { type: 'object', properties: {} },
        },
      ];

      vi.mocked(mockToolsProviders[0].toolsList).mockResolvedValue(mockWeatherTools);
      vi.mocked(mockToolsProviders[1].toolsList).mockResolvedValue(mockSearchTools);

      const result = await internalToolsService.toolsCall('cubicler_fetchServerTools', {
        serverIdentifier: 'weatherService',
      });

      expect(result).toEqual({
        tools: mockWeatherTools,
      });
    });

    it('should throw error for non-existent server in fetch_server_tools', async () => {
      vi.mocked(mockToolsProviders[0].toolsList).mockResolvedValue([
        {
          name: 'weatherService_getWeather',
          description: 'Get weather',
          parameters: { type: 'object', properties: {} },
        },
      ]);

      vi.mocked(mockToolsProviders[1].toolsList).mockResolvedValue([]);

      await expect(
        internalToolsService.toolsCall('cubicler_fetchServerTools', {
          serverIdentifier: 'nonExistentService',
        })
      ).rejects.toThrow('Failed to get tools for server nonExistentService: Server not found: nonExistentService');
    });

    it('should handle provider errors gracefully in available_servers', async () => {
      vi.mocked(mockToolsProviders[0].toolsList).mockRejectedValue(new Error('Provider error'));
      vi.mocked(mockToolsProviders[1].toolsList).mockResolvedValue([
        {
          name: 'searchService_search',
          description: 'Search',
          parameters: { type: 'object', properties: {} },
        },
      ]);

      const result = await internalToolsService.toolsCall('cubicler_availableServers', {});

      expect(result).toEqual({
        total: 1,
        servers: [
          {
            identifier: 'searchService',
            name: 'Search Service',
            description: 'search_service server: searchService',
            toolsCount: 1,
          },
        ],
      });
    });

    it('should handle provider errors gracefully in fetch_server_tools', async () => {
      vi.mocked(mockToolsProviders[0].toolsList).mockRejectedValue(new Error('Provider error'));
      vi.mocked(mockToolsProviders[1].toolsList).mockResolvedValue([
        {
          name: 'searchService_search',
          description: 'Search',
          parameters: { type: 'object', properties: {} },
        },
      ]);

      const result = await internalToolsService.toolsCall('cubicler_fetchServerTools', {
        serverIdentifier: 'searchService',
      });

      expect(result).toEqual({
        tools: [
          {
            name: 'searchService_search',
            description: 'Search',
            parameters: { type: 'object', properties: {} },
          },
        ],
      });
    });
  });

  describe('canHandleRequest', () => {
    it('should return true for supported internal tools', async () => {
      const result1 = await internalToolsService.canHandleRequest('cubicler_availableServers');
      const result2 = await internalToolsService.canHandleRequest('cubicler_fetchServerTools');

      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('should return false for unsupported tools', async () => {
      const result = await internalToolsService.canHandleRequest('cubicler_unknownTool');
      expect(result).toBe(false);
    });

    it('should return false for non-cubicler tools', async () => {
      const result = await internalToolsService.canHandleRequest('weatherService_getWeather');
      expect(result).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await expect(internalToolsService.initialize()).resolves.toBeUndefined();
    });
  });
});
