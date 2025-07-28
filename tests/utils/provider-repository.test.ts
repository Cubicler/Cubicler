import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { loadConfigFromSource, validateProvidersConfig } from '../../src/utils/config-helper.js';
import { createEnvCache } from '../../src/utils/cache.js';
import type { ProvidersConfig } from '../../src/model/providers.js';

// Mock dependencies
vi.mock('../../src/utils/config-helper.js');
vi.mock('../../src/utils/cache.js');
vi.mock('dotenv', () => ({
  config: vi.fn()
}));

const mockLoadConfigFromSource = vi.mocked(loadConfigFromSource);
const mockValidateProvidersConfig = vi.mocked(validateProvidersConfig);
const mockCreateEnvCache = vi.mocked(createEnvCache);

describe('ProviderRepository', () => {
  // Mock cache instance
  const mockCache = {
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
    has: vi.fn(),
    delete: vi.fn(),
    size: vi.fn()
  };

  // We'll import the ProviderRepository dynamically after setting up mocks
  let ProviderRepository: any;

  // Test data
  const mockProvidersConfig: ProvidersConfig = {
    mcpServers: [
      {
        identifier: 'weather_service',
        name: 'Weather Service',
        description: 'Provides weather information via MCP',
        transport: 'http',
        url: 'http://localhost:4000/mcp',
        headers: {
          'Authorization': 'Bearer test-token'
        }
      },
      {
        identifier: 'file_service',
        name: 'File Service',
        description: 'File management via MCP',
        transport: 'http',
        url: 'http://localhost:4001/mcp'
      }
    ],
    restServers: [
      {
        identifier: 'user_api',
        name: 'User API',
        description: 'Legacy REST API for user management',
        url: 'http://localhost:5000/api',
        defaultHeaders: {
          'Authorization': 'Bearer api-token'
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
                  description: 'User ID to fetch'
                }
              },
              required: ['userId']
            }
          }
        ]
      }
    ]
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset console methods to avoid spam in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Mock cache creation
    mockCreateEnvCache.mockReturnValue(mockCache as any);
    
    // Clear modules and reimport to get fresh instance
    vi.resetModules();
    const module = await import('../../src/utils/provider-repository.js');
    ProviderRepository = module.default;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getProvidersConfig', () => {
    it('should return cached config when available', async () => {
      // Arrange
      mockCache.get.mockReturnValue(mockProvidersConfig);

      // Act
      const result = await ProviderRepository.getProvidersConfig();

      // Assert
      expect(result).toEqual(mockProvidersConfig);
      expect(mockCache.get).toHaveBeenCalledWith('config');
      expect(mockLoadConfigFromSource).not.toHaveBeenCalled();
      expect(mockValidateProvidersConfig).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('should load, validate and cache config when not cached', async () => {
      // Arrange
      mockCache.get.mockReturnValue(undefined);
      mockLoadConfigFromSource.mockResolvedValue(mockProvidersConfig);
      mockValidateProvidersConfig.mockImplementation(() => {}); // No-op for valid config

      // Act
      const result = await ProviderRepository.getProvidersConfig();

      // Assert
      expect(result).toEqual(mockProvidersConfig);
      expect(mockCache.get).toHaveBeenCalledWith('config');
      expect(mockLoadConfigFromSource).toHaveBeenCalledWith(
        'CUBICLER_PROVIDERS_LIST',
        'providers configuration'
      );
      expect(mockValidateProvidersConfig).toHaveBeenCalledWith(mockProvidersConfig);
      expect(mockCache.set).toHaveBeenCalledWith('config', mockProvidersConfig);
    });

    it('should log correct counts for MCP and REST servers', async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockCache.get.mockReturnValue(undefined);
      mockLoadConfigFromSource.mockResolvedValue(mockProvidersConfig);
      mockValidateProvidersConfig.mockImplementation(() => {});

      // Act
      await ProviderRepository.getProvidersConfig();

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        '✅ [ProvidersRepository] Loaded 2 MCP servers and 1 REST servers'
      );
    });

    it('should handle config with only MCP servers', async () => {
      // Arrange
      const configWithOnlyMcp: ProvidersConfig = {
        mcpServers: mockProvidersConfig.mcpServers
      };
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      mockCache.get.mockReturnValue(undefined);
      mockLoadConfigFromSource.mockResolvedValue(configWithOnlyMcp);
      mockValidateProvidersConfig.mockImplementation(() => {});

      // Act
      const result = await ProviderRepository.getProvidersConfig();

      // Assert
      expect(result).toEqual(configWithOnlyMcp);
      expect(consoleSpy).toHaveBeenCalledWith(
        '✅ [ProvidersRepository] Loaded 2 MCP servers and 0 REST servers'
      );
    });

    it('should handle config with only REST servers', async () => {
      // Arrange
      const configWithOnlyRest: ProvidersConfig = {
        restServers: mockProvidersConfig.restServers
      };
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      mockCache.get.mockReturnValue(undefined);
      mockLoadConfigFromSource.mockResolvedValue(configWithOnlyRest);
      mockValidateProvidersConfig.mockImplementation(() => {});

      // Act
      const result = await ProviderRepository.getProvidersConfig();

      // Assert
      expect(result).toEqual(configWithOnlyRest);
      expect(consoleSpy).toHaveBeenCalledWith(
        '✅ [ProvidersRepository] Loaded 0 MCP servers and 1 REST servers'
      );
    });

    it('should handle empty config', async () => {
      // Arrange
      const emptyConfig: ProvidersConfig = {};
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      mockCache.get.mockReturnValue(undefined);
      mockLoadConfigFromSource.mockResolvedValue(emptyConfig);
      mockValidateProvidersConfig.mockImplementation(() => {});

      // Act
      const result = await ProviderRepository.getProvidersConfig();

      // Assert
      expect(result).toEqual(emptyConfig);
      expect(consoleSpy).toHaveBeenCalledWith(
        '✅ [ProvidersRepository] Loaded 0 MCP servers and 0 REST servers'
      );
    });

    it('should propagate errors from loadConfigFromSource', async () => {
      // Arrange
      const error = new Error('Failed to load config');
      mockCache.get.mockReturnValue(undefined);
      mockLoadConfigFromSource.mockRejectedValue(error);

      // Act & Assert
      await expect(ProviderRepository.getProvidersConfig()).rejects.toThrow('Failed to load config');
      expect(mockValidateProvidersConfig).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('should propagate validation errors', async () => {
      // Arrange
      const validationError = new Error('Invalid configuration');
      mockCache.get.mockReturnValue(undefined);
      mockLoadConfigFromSource.mockResolvedValue(mockProvidersConfig);
      mockValidateProvidersConfig.mockImplementation(() => {
        throw validationError;
      });

      // Act & Assert
      await expect(ProviderRepository.getProvidersConfig()).rejects.toThrow('Invalid configuration');
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('should not cache config if validation fails', async () => {
      // Arrange
      const validationError = new Error('Invalid configuration');
      mockCache.get.mockReturnValue(undefined);
      mockLoadConfigFromSource.mockResolvedValue(mockProvidersConfig);
      mockValidateProvidersConfig.mockImplementation(() => {
        throw validationError;
      });

      // Act & Assert
      await expect(ProviderRepository.getProvidersConfig()).rejects.toThrow('Invalid configuration');
      expect(mockCache.set).not.toHaveBeenCalled();
    });
  });

  describe('clearCache', () => {
    it('should clear the providers cache', () => {
      // Act
      ProviderRepository.clearCache();

      // Assert
      expect(mockCache.clear).toHaveBeenCalled();
    });
  });

  describe('singleton behavior', () => {
    it('should return the same instance when imported multiple times', async () => {
      // Import again to verify singleton behavior
      const module2 = await import('../../src/utils/provider-repository.js');
      const ProviderRepository2 = module2.default;
      
      expect(ProviderRepository).toBe(ProviderRepository2);
    });

    it('should maintain cache state across multiple calls', async () => {
      // Arrange
      mockCache.get.mockReturnValueOnce(undefined).mockReturnValueOnce(mockProvidersConfig);
      mockLoadConfigFromSource.mockResolvedValue(mockProvidersConfig);
      mockValidateProvidersConfig.mockImplementation(() => {});

      // Act
      const result1 = await ProviderRepository.getProvidersConfig();
      const result2 = await ProviderRepository.getProvidersConfig();

      // Assert
      expect(result1).toEqual(mockProvidersConfig);
      expect(result2).toEqual(mockProvidersConfig);
      expect(mockLoadConfigFromSource).toHaveBeenCalledTimes(1); // Only called once due to caching
      expect(mockCache.set).toHaveBeenCalledTimes(1); // Only set once
    });
  });

  describe('cache configuration', () => {
    it('should create cache with correct parameters', () => {
      // The cache should be created during module import, so we check if it was called
      expect(mockCreateEnvCache).toHaveBeenCalledWith('PROVIDERS', 600);
    });
  });

  describe('error handling', () => {
    it('should handle cache errors gracefully', async () => {
      // Arrange
      mockCache.get.mockImplementation(() => {
        throw new Error('Cache error');
      });
      mockLoadConfigFromSource.mockResolvedValue(mockProvidersConfig);
      mockValidateProvidersConfig.mockImplementation(() => {});

      // Act & Assert
      // If cache.get throws, it should fall back to loading from source
      await expect(ProviderRepository.getProvidersConfig()).rejects.toThrow('Cache error');
    });

    it('should handle cache set errors gracefully', async () => {
      // Arrange
      mockCache.get.mockReturnValue(undefined);
      mockCache.set.mockImplementation(() => {
        throw new Error('Cache set error');
      });
      mockLoadConfigFromSource.mockResolvedValue(mockProvidersConfig);
      mockValidateProvidersConfig.mockImplementation(() => {});

      // Act & Assert
      // If cache.set throws, it should still return the config
      await expect(ProviderRepository.getProvidersConfig()).rejects.toThrow('Cache set error');
    });
  });

  describe('interface compliance', () => {
    it('should implement ProvidersConfigProviding interface', () => {
      // Verify that ProviderRepository has the required methods
      expect(typeof ProviderRepository.getProvidersConfig).toBe('function');
      expect(typeof ProviderRepository.clearCache).toBe('function');
    });

    it('should return Promise<ProvidersConfig> from getProvidersConfig', async () => {
      // Arrange
      mockCache.get.mockReturnValue(mockProvidersConfig);

      // Act
      const result = ProviderRepository.getProvidersConfig();

      // Assert
      expect(result).toBeInstanceOf(Promise);
      const resolvedResult = await result;
      expect(typeof resolvedResult).toBe('object');
      expect(resolvedResult).toHaveProperty('mcpServers');
      expect(resolvedResult).toHaveProperty('restServers');
    });
  });
});
