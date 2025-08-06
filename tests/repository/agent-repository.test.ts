import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { loadConfigFromSource, validateAgentsConfig } from '../../src/utils/config-helper.js';
import { createEnvCache } from '../../src/utils/cache.js';
import type { AgentsConfig } from '../../src/model/agents.js';

// Mock dependencies
vi.mock('../../src/utils/config-helper.js');
vi.mock('../../src/utils/cache.js');
vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

const mockLoadConfigFromSource = vi.mocked(loadConfigFromSource);
const mockValidateAgentsConfig = vi.mocked(validateAgentsConfig);
const mockCreateEnvCache = vi.mocked(createEnvCache);

describe('AgentRepository', () => {
  // Mock cache instance
  const mockCache = {
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
    has: vi.fn(),
    delete: vi.fn(),
    size: vi.fn(),
  };

  // We'll import the AgentRepository dynamically after setting up mocks
  let AgentRepository: any;

  // Test data
  const mockAgentsConfig: AgentsConfig = {
    basePrompt: 'You are a helpful AI assistant powered by Cubicler.',
    defaultPrompt: 'You have access to various tools and services through Cubicler.',
    agents: [
      {
        identifier: 'gpt_4o',
        name: 'GPT-4O Agent',
        transport: 'http',
        config: { url: 'http://localhost:3000/agent' },
        description: 'Advanced GPT-4O agent for complex tasks',
        prompt: 'You specialize in complex reasoning and analysis.',
      },
      {
        identifier: 'claude_3_5',
        name: 'Claude 3.5 Agent',
        transport: 'http',
        config: { url: 'http://localhost:3001/agent' },
        description: 'Claude 3.5 Sonnet for creative and analytical tasks',
      },
      {
        identifier: 'local_llama',
        name: 'Local LLaMA Agent',
        transport: 'stdio',
        config: { url: '/usr/local/bin/llama-agent' },
        description: 'Local LLaMA model for offline processing',
        prompt: 'You are a local AI assistant optimized for privacy.',
      },
    ],
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
    const module = await import('../../src/repository/agent-repository.js');
    AgentRepository = module.default;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAgentsConfig', () => {
    it('should return cached config when available', async () => {
      // Arrange
      mockCache.get.mockReturnValue(mockAgentsConfig);

      // Act
      const result = await AgentRepository.getAgentsConfig();

      // Assert
      expect(result).toEqual(mockAgentsConfig);
      expect(mockCache.get).toHaveBeenCalledWith('config');
      expect(mockLoadConfigFromSource).not.toHaveBeenCalled();
      expect(mockValidateAgentsConfig).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('should load, validate and cache config when not cached', async () => {
      // Arrange
      mockCache.get.mockReturnValue(undefined);
      mockLoadConfigFromSource.mockResolvedValue(mockAgentsConfig);
      mockValidateAgentsConfig.mockImplementation(() => {}); // No-op for valid config

      // Act
      const result = await AgentRepository.getAgentsConfig();

      // Assert
      expect(result).toEqual(mockAgentsConfig);
      expect(mockCache.get).toHaveBeenCalledWith('config');
      expect(mockLoadConfigFromSource).toHaveBeenCalledWith(
        'CUBICLER_AGENTS_LIST',
        'agents configuration'
      );
      expect(mockValidateAgentsConfig).toHaveBeenCalledWith(mockAgentsConfig);
      expect(mockCache.set).toHaveBeenCalledWith('config', mockAgentsConfig);
    });

    it('should log correct agent count when loading config', async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockCache.get.mockReturnValue(undefined);
      mockLoadConfigFromSource.mockResolvedValue(mockAgentsConfig);
      mockValidateAgentsConfig.mockImplementation(() => {});

      // Act
      await AgentRepository.getAgentsConfig();

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        `✅ [AgentRepository] Loaded ${mockAgentsConfig.agents.length} agents`
      );
    });

    it('should handle agents config with only base prompt', async () => {
      // Arrange
      const minimalConfig: AgentsConfig = {
        basePrompt: 'Base prompt only',
        agents: [
          {
            identifier: 'simple_agent',
            name: 'Simple Agent',
            transport: 'http',
            config: { url: 'http://localhost:3000/agent' },
            description: 'Simple test agent',
          },
        ],
      };

      mockCache.get.mockReturnValue(undefined);
      mockLoadConfigFromSource.mockResolvedValue(minimalConfig);
      mockValidateAgentsConfig.mockImplementation(() => {});

      // Act
      const result = await AgentRepository.getAgentsConfig();

      // Assert
      expect(result).toEqual(minimalConfig);
      expect(result.basePrompt).toBe('Base prompt only');
      expect(result.defaultPrompt).toBeUndefined();
      expect(result.agents).toHaveLength(1);
    });

    it('should handle agents config without prompts', async () => {
      // Arrange
      const minimalConfig: AgentsConfig = {
        agents: [
          {
            identifier: 'no_prompt_agent',
            name: 'No Prompt Agent',
            transport: 'http',
            config: { url: 'http://localhost:3000/agent' },
            description: 'Agent without any prompts',
          },
        ],
      };

      mockCache.get.mockReturnValue(undefined);
      mockLoadConfigFromSource.mockResolvedValue(minimalConfig);
      mockValidateAgentsConfig.mockImplementation(() => {});

      // Act
      const result = await AgentRepository.getAgentsConfig();

      // Assert
      expect(result).toEqual(minimalConfig);
      expect(result.basePrompt).toBeUndefined();
      expect(result.defaultPrompt).toBeUndefined();
      expect(result.agents[0].prompt).toBeUndefined();
    });

    it('should handle agents with different transport types', async () => {
      // Arrange
      const multiTransportConfig: AgentsConfig = {
        agents: [
          {
            identifier: 'http_agent',
            name: 'HTTP Agent',
            transport: 'http',
            config: { url: 'http://localhost:3000/agent' },
            description: 'HTTP transport agent',
          },
          {
            identifier: 'stdio_agent',
            name: 'STDIO Agent',
            transport: 'stdio',
            config: { url: '/usr/local/bin/stdio-agent' },
            description: 'STDIO transport agent',
          },
        ],
      };

      mockCache.get.mockReturnValue(undefined);
      mockLoadConfigFromSource.mockResolvedValue(multiTransportConfig);
      mockValidateAgentsConfig.mockImplementation(() => {});

      // Act
      const result = await AgentRepository.getAgentsConfig();

      // Assert
      expect(result).toEqual(multiTransportConfig);
      expect(result.agents[0].transport).toBe('http');
      expect(result.agents[1].transport).toBe('stdio');
    });

    it('should propagate errors from loadConfigFromSource', async () => {
      // Arrange
      const errorMessage = 'Failed to load agents configuration';
      mockCache.get.mockReturnValue(undefined);
      mockLoadConfigFromSource.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      await expect(AgentRepository.getAgentsConfig()).rejects.toThrow(errorMessage);
      expect(mockValidateAgentsConfig).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('should propagate errors from validateAgentsConfig', async () => {
      // Arrange
      const errorMessage = 'Invalid agents configuration';
      mockCache.get.mockReturnValue(undefined);
      mockLoadConfigFromSource.mockResolvedValue(mockAgentsConfig);
      mockValidateAgentsConfig.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      // Act & Assert
      await expect(AgentRepository.getAgentsConfig()).rejects.toThrow(errorMessage);
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('should not cache config when validation fails', async () => {
      // Arrange
      mockCache.get.mockReturnValue(undefined);
      mockLoadConfigFromSource.mockResolvedValue(mockAgentsConfig);
      mockValidateAgentsConfig.mockImplementation(() => {
        throw new Error('Validation failed');
      });

      // Act & Assert
      await expect(AgentRepository.getAgentsConfig()).rejects.toThrow('Validation failed');
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('should handle empty agents array', async () => {
      // Arrange
      const emptyConfig: AgentsConfig = {
        basePrompt: 'Base prompt',
        defaultPrompt: 'Default prompt',
        agents: [],
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockCache.get.mockReturnValue(undefined);
      mockLoadConfigFromSource.mockResolvedValue(emptyConfig);
      mockValidateAgentsConfig.mockImplementation(() => {});

      // Act
      const result = await AgentRepository.getAgentsConfig();

      // Assert
      expect(result).toEqual(emptyConfig);
      expect(consoleSpy).toHaveBeenCalledWith('✅ [AgentRepository] Loaded 0 agents');
    });
  });

  describe('clearCache', () => {
    it('should clear the agents cache', () => {
      // Act
      AgentRepository.clearCache();

      // Assert
      expect(mockCache.clear).toHaveBeenCalledOnce();
    });

    it('should allow fresh config load after cache clear', async () => {
      // Arrange
      mockCache.get.mockReturnValueOnce(mockAgentsConfig); // First call returns cached
      mockCache.get.mockReturnValueOnce(undefined); // After clear, returns undefined
      mockLoadConfigFromSource.mockResolvedValue(mockAgentsConfig);
      mockValidateAgentsConfig.mockImplementation(() => {});

      // Act - First call should use cache
      const result1 = await AgentRepository.getAgentsConfig();
      expect(result1).toEqual(mockAgentsConfig);
      expect(mockLoadConfigFromSource).not.toHaveBeenCalled();

      // Clear cache
      AgentRepository.clearCache();
      expect(mockCache.clear).toHaveBeenCalled();

      // Second call should load from source
      const result2 = await AgentRepository.getAgentsConfig();

      // Assert
      expect(result2).toEqual(mockAgentsConfig);
      expect(mockLoadConfigFromSource).toHaveBeenCalledWith(
        'CUBICLER_AGENTS_LIST',
        'agents configuration'
      );
    });
  });

  describe('cache configuration', () => {
    it('should create cache with correct parameters', () => {
      // Assert - This is verified during module import in beforeEach
      expect(mockCreateEnvCache).toHaveBeenCalledWith('AGENTS', 600);
    });
  });

  describe('singleton behavior', () => {
    it('should export the same instance across imports', async () => {
      // Arrange - Import the module multiple times
      const module1 = await import('../../src/repository/agent-repository.js');
      const module2 = await import('../../src/repository/agent-repository.js');

      // Assert - Both imports should return the same instance
      expect(module1.default).toBe(module2.default);
    });
  });

  describe('interface compliance', () => {
    it('should implement AgentsConfigProviding interface', async () => {
      // Arrange
      const module = await import('../../src/repository/agent-repository.js');
      const repository = module.default;

      // Assert - Check that required methods are present
      expect(typeof repository.getAgentsConfig).toBe('function');
    });
  });
});
