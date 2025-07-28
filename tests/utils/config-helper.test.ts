import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { 
  isRemoteUrl, 
  loadConfigFromSource, 
  validateProvidersConfig, 
  validateAgentsConfig 
} from '../../src/utils/config-helper.js';
import { fetchWithDefaultTimeout } from '../../src/utils/fetch-helper.js';
import { getConfigurationSource, isValidUrl, getConfigLoadTimeout } from '../../src/utils/env-helper.js';
import type { ProvidersConfig } from '../../src/model/providers.js';
import type { AgentsConfig } from '../../src/model/agents.js';

// Mock dependencies
vi.mock('fs');
vi.mock('../../src/utils/fetch-helper.js');
vi.mock('../../src/utils/env-helper.js');

const mockReadFileSync = vi.mocked(readFileSync);
const mockFetchWithDefaultTimeout = vi.mocked(fetchWithDefaultTimeout);
const mockGetConfigurationSource = vi.mocked(getConfigurationSource);
const mockIsValidUrl = vi.mocked(isValidUrl);
const mockGetConfigLoadTimeout = vi.mocked(getConfigLoadTimeout);

describe('Config Helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset console methods to avoid spam in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isRemoteUrl', () => {
    it('should return true for http URLs', () => {
      expect(isRemoteUrl('http://example.com')).toBe(true);
    });

    it('should return true for https URLs', () => {
      expect(isRemoteUrl('https://example.com')).toBe(true);
    });

    it('should return false for local file paths', () => {
      expect(isRemoteUrl('/path/to/file.json')).toBe(false);
      expect(isRemoteUrl('./config.json')).toBe(false);
      expect(isRemoteUrl('../config.json')).toBe(false);
      expect(isRemoteUrl('config.json')).toBe(false);
    });

    it('should return false for other protocols', () => {
      expect(isRemoteUrl('ftp://example.com')).toBe(false);
      expect(isRemoteUrl('file:///path/to/file')).toBe(false);
    });
  });

  describe('loadConfigFromSource', () => {
    beforeEach(() => {
      mockGetConfigLoadTimeout.mockReturnValue(10000);
    });

    describe('loading from local file', () => {
      const testConfig = { test: 'config' };

      beforeEach(() => {
        mockGetConfigurationSource.mockReturnValue('/path/to/config.json');
      });

      it('should successfully load valid JSON from file', async () => {
        mockReadFileSync.mockReturnValue(JSON.stringify(testConfig));

        const result = await loadConfigFromSource('TEST_ENV', 'test config');

        expect(result).toEqual(testConfig);
        expect(mockReadFileSync).toHaveBeenCalledWith('/path/to/config.json', 'utf-8');
      });

      it('should throw error for invalid JSON in file', async () => {
        mockReadFileSync.mockReturnValue('invalid json');

        await expect(loadConfigFromSource('TEST_ENV', 'test config'))
          .rejects.toThrow('Failed to load test config from file "/path/to/config.json"');
      });

      it('should throw error when file cannot be read', async () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error('File not found');
        });

        await expect(loadConfigFromSource('TEST_ENV', 'test config'))
          .rejects.toThrow('Failed to load test config from file "/path/to/config.json": File not found');
      });
    });

    describe('loading from remote URL', () => {
      const testConfig = { test: 'config' };

      beforeEach(() => {
        mockGetConfigurationSource.mockReturnValue('https://example.com/config.json');
        mockIsValidUrl.mockReturnValue(true);
      });

      it('should successfully load valid JSON from URL', async () => {
        mockFetchWithDefaultTimeout.mockResolvedValue({
          status: 200,
          statusText: 'OK',
          data: testConfig,
          headers: {},
          config: {}
        } as any);

        const result = await loadConfigFromSource('TEST_ENV', 'test config');

        expect(result).toEqual(testConfig);
        expect(mockFetchWithDefaultTimeout).toHaveBeenCalledWith(
          'https://example.com/config.json',
          {
            timeout: 10000,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Cubicler/2.0'
            }
          }
        );
      });

      it('should throw error for invalid URL format', async () => {
        mockIsValidUrl.mockReturnValue(false);

        await expect(loadConfigFromSource('TEST_ENV', 'test config'))
          .rejects.toThrow('Invalid URL format: https://example.com/config.json');
      });

      it('should throw error for HTTP error status', async () => {
        mockFetchWithDefaultTimeout.mockResolvedValue({
          status: 404,
          statusText: 'Not Found',
          data: null,
          headers: {},
          config: {}
        } as any);

        await expect(loadConfigFromSource('TEST_ENV', 'test config'))
          .rejects.toThrow('Failed to load test config from URL "https://example.com/config.json": HTTP 404: Not Found');
      });

      it('should throw error for invalid JSON response', async () => {
        mockFetchWithDefaultTimeout.mockResolvedValue({
          status: 200,
          statusText: 'OK',
          data: null,
          headers: {},
          config: {}
        } as any);

        await expect(loadConfigFromSource('TEST_ENV', 'test config'))
          .rejects.toThrow('Failed to load test config from URL "https://example.com/config.json": Remote URL returned invalid JSON data');
      });

      it('should throw error when fetch fails', async () => {
        mockFetchWithDefaultTimeout.mockRejectedValue(new Error('Network error'));

        await expect(loadConfigFromSource('TEST_ENV', 'test config'))
          .rejects.toThrow('Failed to load test config from URL "https://example.com/config.json": Network error');
      });
    });
  });

  describe('validateProvidersConfig', () => {
    it('should validate empty config with no servers', () => {
      const config = {};
      expect(() => validateProvidersConfig(config)).not.toThrow();
    });

    it('should validate config with empty arrays', () => {
      const config = { mcpServers: [], restServers: [] };
      expect(() => validateProvidersConfig(config)).not.toThrow();
    });

    it('should throw error for non-object config', () => {
      expect(() => validateProvidersConfig(null))
        .toThrow('Invalid providers configuration: must be a valid JSON object');
      
      expect(() => validateProvidersConfig([]))
        .toThrow('Invalid providers configuration: must be a valid JSON object');
      
      expect(() => validateProvidersConfig('string'))
        .toThrow('Invalid providers configuration: must be a valid JSON object');
    });

    describe('MCP servers validation', () => {
      it('should validate valid MCP servers', () => {
        const config: ProvidersConfig = {
          mcpServers: [
            {
              identifier: 'weather-service',
              name: 'Weather Service',
              description: 'Weather API',
              transport: 'http',
              url: 'http://localhost:4000/mcp'
            }
          ]
        };
        expect(() => validateProvidersConfig(config)).not.toThrow();
      });

      it('should throw error for non-array mcpServers', () => {
        const config = { mcpServers: 'not-array' };
        expect(() => validateProvidersConfig(config))
          .toThrow('Invalid providers configuration: mcpServers must be an array');
      });

      it('should throw error for invalid MCP server object', () => {
        const config = { mcpServers: [null] };
        expect(() => validateProvidersConfig(config))
          .toThrow('Invalid MCP server at index 0: must be an object');
      });

      it('should throw error for missing identifier', () => {
        const config = {
          mcpServers: [{
            name: 'Test',
            url: 'http://localhost:4000'
          }]
        };
        expect(() => validateProvidersConfig(config))
          .toThrow('Invalid MCP server at index 0: missing or invalid identifier');
      });

      it('should throw error for missing URL', () => {
        const config = {
          mcpServers: [{
            identifier: 'test',
            name: 'Test'
          }]
        };
        expect(() => validateProvidersConfig(config))
          .toThrow('Invalid MCP server at index 0: missing or invalid url');  
      });

      it('should throw error for invalid identifier format', () => {
        const config = {
          mcpServers: [{
            identifier: 'Test Server',
            name: 'Test',
            url: 'http://localhost:4000'
          }]
        };
        expect(() => validateProvidersConfig(config))
          .toThrow('Invalid MCP server at index 0: identifier "Test Server" must be lowercase with only letters, numbers, hyphens, or underscores');
      });

      it('should accept valid identifier formats', () => {
        const validIdentifiers = ['test', 'test-server', 'test_server', 'test123', 'test-123_server'];
        
        validIdentifiers.forEach(identifier => {
          const config = {
            mcpServers: [{
              identifier,
              name: 'Test',
              url: 'http://localhost:4000'
            }]
          };
          expect(() => validateProvidersConfig(config)).not.toThrow();
        });
      });
    });

    describe('REST servers validation', () => {
      it('should validate valid REST servers', () => {
        const config: ProvidersConfig = {
          restServers: [
            {
              identifier: 'user-api',
              name: 'User API',
              description: 'User management API',
              url: 'http://localhost:5000/api',
              endPoints: []
            }
          ]
        };
        expect(() => validateProvidersConfig(config)).not.toThrow();
      });

      it('should throw error for non-array restServers', () => {
        const config = { restServers: 'not-array' };
        expect(() => validateProvidersConfig(config))
          .toThrow('Invalid providers configuration: restServers must be an array');
      });

      it('should throw error for invalid REST server object', () => {
        const config = { restServers: ['not-object'] };
        expect(() => validateProvidersConfig(config))
          .toThrow('Invalid REST server at index 0: must be an object');
      });

      it('should throw error for missing identifier', () => {
        const config = {
          restServers: [{
            name: 'Test',
            url: 'http://localhost:5000'
          }]
        };
        expect(() => validateProvidersConfig(config))
          .toThrow('Invalid REST server at index 0: missing or invalid identifier');
      });

      it('should throw error for missing URL', () => {
        const config = {
          restServers: [{
            identifier: 'test',
            name: 'Test'
          }]
        };
        expect(() => validateProvidersConfig(config))
          .toThrow('Invalid REST server at index 0: missing or invalid url');
      });

      it('should throw error for invalid identifier format', () => {
        const config = {
          restServers: [{
            identifier: 'Test API',
            name: 'Test',
            url: 'http://localhost:5000'
          }]
        };
        expect(() => validateProvidersConfig(config))
          .toThrow('Invalid REST server at index 0: identifier "Test API" must be lowercase with only letters, numbers, hyphens, or underscores');
      });
    });
  });

  describe('validateAgentsConfig', () => {
    it('should validate valid agents config', () => {
      const config: AgentsConfig = {
        basePrompt: 'You are a helpful assistant',
        defaultPrompt: 'You have access to tools',
        agents: [
          {
            identifier: 'gpt-4o',
            name: 'GPT-4O',
            transport: 'http',
            url: 'http://localhost:3000/agent',
            description: 'GPT-4O agent'
          }
        ]
      };
      expect(() => validateAgentsConfig(config)).not.toThrow();
    });

    it('should validate minimal agents config', () => {
      const config: AgentsConfig = {
        agents: [
          {
            identifier: 'test-agent',
            name: 'Test Agent',
            transport: 'http',
            url: 'http://localhost:3000/agent',
            description: 'Test agent description'
          }
        ]
      };
      expect(() => validateAgentsConfig(config)).not.toThrow();
    });

    it('should throw error for non-object config', () => {
      expect(() => validateAgentsConfig(null))
        .toThrow('Invalid agents configuration: must be a valid JSON object');
      
      expect(() => validateAgentsConfig([]))
        .toThrow('Invalid agents configuration: must be a valid JSON object');
      
      expect(() => validateAgentsConfig('string'))
        .toThrow('Invalid agents configuration: must be a valid JSON object');
    });

    it('should throw error for non-array agents', () => {
      const config = { agents: 'not-array' };
      expect(() => validateAgentsConfig(config))
        .toThrow('Invalid agents configuration: agents must be an array');
    });

    it('should throw error for empty agents array', () => {
      const config = { agents: [] };
      expect(() => validateAgentsConfig(config))
        .toThrow('Invalid agents configuration: at least one agent must be configured');
    });

    it('should throw error for invalid agent object', () => {
      const config = { agents: [null] };
      expect(() => validateAgentsConfig(config))
        .toThrow('Invalid agent at index 0: must be an object');
    });

    it('should throw error for missing identifier', () => {
      const config = {
        agents: [{
          name: 'Test Agent',
          url: 'http://localhost:3000',
          description: 'Test description'
        }]
      };
      expect(() => validateAgentsConfig(config))
        .toThrow('Invalid agent at index 0: missing or invalid identifier');
    });

    it('should throw error for missing URL', () => {
      const config = {
        agents: [{
          identifier: 'test',
          name: 'Test Agent',
          description: 'Test description'
        }]
      };
      expect(() => validateAgentsConfig(config))
        .toThrow('Invalid agent at index 0: missing or invalid url');
    });

    it('should throw error for missing name', () => {
      const config = {
        agents: [{
          identifier: 'test',
          url: 'http://localhost:3000',
          description: 'Test description'
        }]
      };
      expect(() => validateAgentsConfig(config))
        .toThrow('Invalid agent at index 0: missing or invalid name');
    });

    it('should throw error for invalid identifier format', () => {
      const config = {
        agents: [{
          identifier: 'Test Agent',
          name: 'Test Agent',
          url: 'http://localhost:3000',
          description: 'Test description'
        }]
      };
      expect(() => validateAgentsConfig(config))
        .toThrow('Invalid agent at index 0: identifier "Test Agent" must be lowercase with only letters, numbers, hyphens, or underscores');
    });

    it('should accept valid identifier formats', () => {
      const validIdentifiers = ['test', 'test-agent', 'test_agent', 'test123', 'gpt-4o_turbo'];
      
      validIdentifiers.forEach(identifier => {
        const config = {
          agents: [{
            identifier,
            name: 'Test Agent',
            url: 'http://localhost:3000',
            description: 'Test description'
          }]
        };
        expect(() => validateAgentsConfig(config)).not.toThrow();
      });
    });

    it('should throw error for duplicate identifiers', () => {
      const config = {
        agents: [
          {
            identifier: 'test-agent',
            name: 'Test Agent 1',
            url: 'http://localhost:3000',
            description: 'Test description 1'
          },
          {
            identifier: 'test-agent',
            name: 'Test Agent 2', 
            url: 'http://localhost:3001',
            description: 'Test description 2'
          }
        ]
      };
      expect(() => validateAgentsConfig(config))
        .toThrow('Duplicate agent identifiers found: test-agent');
    });

    it('should throw error for multiple duplicate identifiers', () => {
      const config = {
        agents: [
          {
            identifier: 'agent-1',
            name: 'Agent 1a',
            url: 'http://localhost:3000',
            description: 'Agent 1a description'
          },
          {
            identifier: 'agent-1',
            name: 'Agent 1b',
            url: 'http://localhost:3001',
            description: 'Agent 1b description'
          },
          {
            identifier: 'agent-2',
            name: 'Agent 2a',
            url: 'http://localhost:3002',
            description: 'Agent 2a description'
          },
          {
            identifier: 'agent-2',
            name: 'Agent 2b',
            url: 'http://localhost:3003',
            description: 'Agent 2b description'
          }
        ]
      };
      expect(() => validateAgentsConfig(config))
        .toThrow('Duplicate agent identifiers found: agent-1, agent-2');
    });

    it('should throw error for invalid basePrompt type', () => {
      const config = {
        basePrompt: 123,
        agents: [{
          identifier: 'test',
          name: 'Test',
          url: 'http://localhost:3000',
          description: 'Test description'
        }]
      };
      expect(() => validateAgentsConfig(config))
        .toThrow('Invalid agents configuration: basePrompt must be a string');
    });

    it('should throw error for invalid defaultPrompt type', () => {
      const config = {
        defaultPrompt: [],
        agents: [{
          identifier: 'test',
          name: 'Test',
          url: 'http://localhost:3000',
          description: 'Test description'
        }]
      };
      expect(() => validateAgentsConfig(config))
        .toThrow('Invalid agents configuration: defaultPrompt must be a string');
    });
  });
});
