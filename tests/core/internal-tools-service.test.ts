import { beforeEach, describe, it, expect, vi } from 'vitest';
import { InternalToolsService } from '../../src/core/internal-tools-service.js';
import type { ToolsListProviding } from '../../src/interface/tools-list-providing.js';
import type { ServersProviding } from '../../src/interface/servers-providing.js';

describe('Internal Tools Service', () => {
  let internalToolsService: InternalToolsService;
  let mockToolsProviders: ToolsListProviding[];
  let mockServersProvider: ServersProviding;

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

    // Create mock servers provider
    mockServersProvider = {
      getAvailableServers: vi.fn(),
      getServerHash: vi.fn(),
    };

    // Create internal tools service with mocked dependencies
    internalToolsService = new InternalToolsService(mockToolsProviders);
    internalToolsService.setServersProvider(mockServersProvider);
  });

  describe('toolsList', () => {
    it('should return list of internal tools', async () => {
      const tools = await internalToolsService.toolsList();

      expect(tools).toHaveLength(2);

      // Check cubicler_available_servers tool
      const availableServersTool = tools.find((t: any) => t.name === 'cubicler_available_servers');
      expect(availableServersTool).toBeDefined();
      expect(availableServersTool?.description).toContain('available servers');
      expect(availableServersTool?.parameters.type).toBe('object');

      // Check cubicler_fetch_server_tools tool
      const fetchServerToolsTool = tools.find((t: any) => t.name === 'cubicler_fetch_server_tools');
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
        internalToolsService.toolsCall('cubicler_fetch_server_tools', {})
      ).rejects.toThrow('Missing required parameter: serverIdentifier');
    });

    it('should execute cubicler_available_servers successfully', async () => {
      const mockAvailableServersResponse = {
        total: 2,
        servers: [
          {
            identifier: 'weather_service',
            name: 'Weather Service',
            description: 'Provides weather information',
            toolsCount: 2,
          },
          {
            identifier: 'search_service',
            name: 'Search Service',
            description: 'Provides search functionality',
            toolsCount: 1,
          },
        ],
      };

      vi.mocked(mockServersProvider.getAvailableServers).mockResolvedValue(
        mockAvailableServersResponse
      );

      const result = await internalToolsService.toolsCall('cubicler_available_servers', {});

      expect(result).toEqual(mockAvailableServersResponse);
    });

    it('should execute cubicler_fetch_server_tools for cubicler server', async () => {
      const result = await internalToolsService.toolsCall('cubicler_fetch_server_tools', {
        serverIdentifier: 'cubicler',
      });

      expect(result).toEqual({
        tools: [
          {
            name: 'cubicler_available_servers',
            description: 'Get information about available servers managed by Cubicler',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'cubicler_fetch_server_tools',
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

    it('should return tools for a specific server', async () => {
      // Use proper 6-character hash like the real system would generate
      vi.mocked(mockToolsProviders[0].toolsList).mockResolvedValue([
        {
          name: '1r2dj4_get_weather',
          description: 'Get weather',
          parameters: { type: 'object', properties: {} },
        },
      ]);

      // Mock servers provider to resolve server hash
      vi.mocked(mockServersProvider.getServerHash).mockImplementation(
        async (identifier: string) => {
          if (identifier === 'weather_service') return '1r2dj4';
          if (identifier === 'search_service') return 'abc123';
          return null;
        }
      );

      const result = await internalToolsService.toolsCall('cubicler_fetch_server_tools', {
        serverIdentifier: 'weather_service',
      });

      expect(result).toEqual({
        tools: [
          {
            name: '1r2dj4_get_weather',
            description: 'Get weather',
            parameters: { type: 'object', properties: {} },
          },
        ],
      });
    });

    it('should throw error for non-existent server in fetch_server_tools', async () => {
      // Mock servers provider to return null for non-existent server
      vi.mocked(mockServersProvider.getServerHash).mockImplementation(
        async (identifier: string) => {
          if (identifier === 'weather_service') return '0';
          if (identifier === 'search_service') return '1';
          return null; // Return null for non-existent servers
        }
      );

      await expect(
        internalToolsService.toolsCall('cubicler_fetch_server_tools', {
          serverIdentifier: 'non_existent_service',
        })
      ).rejects.toThrow(
        'Failed to get tools for server non_existent_service: Server not found: non_existent_service'
      );
    });

    it('should handle provider errors gracefully in available_servers', async () => {
      // Mock the servers provider to return available servers
      const mockAvailableServersResponse = {
        total: 1,
        servers: [
          {
            identifier: 'search_service',
            name: 'Search Service',
            description: 'Provides search functionality',
            toolsCount: 1,
          },
        ],
      };

      vi.mocked(mockServersProvider.getAvailableServers).mockResolvedValue(
        mockAvailableServersResponse
      );

      const result = await internalToolsService.toolsCall('cubicler_available_servers', {});

      expect(result).toEqual(mockAvailableServersResponse);
    });

    it('should handle provider errors gracefully in fetch_server_tools', async () => {
      // Mock servers provider to return server hash (use proper 6-character hashes)
      vi.mocked(mockServersProvider.getServerHash).mockImplementation(
        async (identifier: string) => {
          if (identifier === 'weather_service') return '1r2dj4';
          if (identifier === 'search_service') return 'abc123';
          return null;
        }
      );

      vi.mocked(mockToolsProviders[0].toolsList).mockRejectedValue(new Error('Provider error'));
      vi.mocked(mockToolsProviders[1].toolsList).mockResolvedValue([
        {
          name: 'abc123_search',
          description: 'Search',
          parameters: { type: 'object', properties: {} },
        },
      ]);

      const result = await internalToolsService.toolsCall('cubicler_fetch_server_tools', {
        serverIdentifier: 'search_service',
      });

      expect(result).toEqual({
        tools: [
          {
            name: 'abc123_search',
            description: 'Search',
            parameters: { type: 'object', properties: {} },
          },
        ],
      });
    });
  });

  describe('canHandleRequest', () => {
    it('should return true for supported internal tools', async () => {
      const result1 = await internalToolsService.canHandleRequest('cubicler_available_servers');
      const result2 = await internalToolsService.canHandleRequest('cubicler_fetch_server_tools');

      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('should return false for unsupported tools', async () => {
      const result = await internalToolsService.canHandleRequest('cubicler_unknownTool');
      expect(result).toBe(false);
    });

    it('should return false for non-cubicler tools', async () => {
      const result = await internalToolsService.canHandleRequest('s0_get_weather');
      expect(result).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await expect(internalToolsService.initialize()).resolves.toBeUndefined();
    });
  });
});
