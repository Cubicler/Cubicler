import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import {
  loadConfigFromSource,
  validateProvidersConfig,
  validateAgentsConfig,
} from '../../src/utils/config-helper.js';
import { isRemoteUrl } from '../../src/utils/source-helper.js';
import { fetchWithDefaultTimeout } from '../../src/utils/fetch-helper.js';
import { getConfigurationSource, getConfigLoadTimeout } from '../../src/utils/env-helper.js';
import type { ProvidersConfig } from '../../src/model/providers.js';
import type { AgentsConfig } from '../../src/model/agents.js';

// Mock dependencies
vi.mock('fs');
vi.mock('../../src/utils/fetch-helper.js');
vi.mock('../../src/utils/env-helper.js');

const mockReadFileSync = vi.mocked(readFileSync);
const mockFetchWithDefaultTimeout = vi.mocked(fetchWithDefaultTimeout);
const mockGetConfigurationSource = vi.mocked(getConfigurationSource);
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

        await expect(loadConfigFromSource('TEST_ENV', 'test config')).rejects.toThrow(
          'Failed to load test config from file "/path/to/config.json"'
        );
      });

      it('should throw error when file cannot be read', async () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error('File not found');
        });

        await expect(loadConfigFromSource('TEST_ENV', 'test config')).rejects.toThrow(
          'Failed to load test config from file "/path/to/config.json": File not found'
        );
      });
    });

    describe('loading from remote URL', () => {
      const testConfig = { test: 'config' };

      beforeEach(() => {
        mockGetConfigurationSource.mockReturnValue('https://example.com/config.json');
      });

      it('should successfully load valid JSON from URL', async () => {
        mockFetchWithDefaultTimeout.mockResolvedValue({
          status: 200,
          statusText: 'OK',
          data: testConfig,
          headers: {},
          config: {},
        } as any);

        const result = await loadConfigFromSource('TEST_ENV', 'test config');

        expect(result).toEqual(testConfig);
        expect(mockFetchWithDefaultTimeout).toHaveBeenCalledWith(
          'https://example.com/config.json',
          {
            timeout: 10000,
            headers: {
              Accept: 'application/json',
              'User-Agent': 'Cubicler/2.0',
            },
          }
        );
      });

      it('should throw error for HTTP error status', async () => {
        mockFetchWithDefaultTimeout.mockResolvedValue({
          status: 404,
          statusText: 'Not Found',
          data: null,
          headers: {},
          config: {},
        } as any);

        await expect(loadConfigFromSource('TEST_ENV', 'test config')).rejects.toThrow(
          'Failed to load test config from URL "https://example.com/config.json": HTTP 404: Not Found'
        );
      });

      it('should throw error for invalid JSON response', async () => {
        mockFetchWithDefaultTimeout.mockResolvedValue({
          status: 200,
          statusText: 'OK',
          data: null,
          headers: {},
          config: {},
        } as any);

        await expect(loadConfigFromSource('TEST_ENV', 'test config')).rejects.toThrow(
          'Failed to load test config from URL "https://example.com/config.json": Remote URL returned invalid JSON data'
        );
      });

      it('should throw error when fetch fails', async () => {
        mockFetchWithDefaultTimeout.mockRejectedValue(new Error('Network error'));

        await expect(loadConfigFromSource('TEST_ENV', 'test config')).rejects.toThrow(
          'Failed to load test config from URL "https://example.com/config.json": Network error'
        );
      });
    });
  });

  describe('validateProvidersConfig', () => {
    it('should validate empty object config', () => {
      const config = {};
      expect(() => validateProvidersConfig(config)).not.toThrow();
    });

    it('should throw error for non-object config', () => {
      expect(() => validateProvidersConfig(null)).toThrow(
        'Invalid providers configuration: must be a valid JSON object'
      );

      expect(() => validateProvidersConfig([])).toThrow(
        'Invalid providers configuration: must be a valid JSON object'
      );

      expect(() => validateProvidersConfig('string')).toThrow(
        'Invalid providers configuration: must be a valid JSON object'
      );
    });

    describe('MCP servers validation', () => {
      it('should validate valid MCP server object', () => {
        const config: ProvidersConfig = {
          mcpServers: {
            weather_service: {
              name: 'Weather Service',
              description: 'Weather API',
              url: 'http://localhost:4000/mcp',
            },
          },
          restServers: {},
        } as any;
        expect(() => validateProvidersConfig(config)).not.toThrow();
      });

      it('should throw for non-object mcpServers', () => {
        const config = { mcpServers: 'not-object' };
        expect(() => validateProvidersConfig(config)).toThrow(
          'Invalid providers configuration: mcpServers must be an object'
        );
      });

      it('should throw for invalid server shape', () => {
        const config = { mcpServers: { test: null } };
        expect(() => validateProvidersConfig(config)).toThrow(
          "Invalid MCP server 'test': must be an object"
        );
      });

      it('should enforce identifier format', () => {
        const config = {
          mcpServers: {
            'Bad Identifier': { name: 'X', description: 'Y', url: 'http://x' },
          },
        };
        expect(() => validateProvidersConfig(config)).toThrow(
          'Invalid MCP server: identifier "Bad Identifier" must contain only letters, numbers, hyphens, or underscores (no spaces)'
        );
      });
    });

    describe('REST servers validation', () => {
      it('should validate a REST server with endpoint', () => {
        const config: ProvidersConfig = {
          mcpServers: {},
          restServers: {
            user_api: {
              name: 'User API',
              description: 'User management API',
              url: 'http://localhost:5000/api',
              endpoints: {
                get_user: {
                  name: 'Get User',
                  description: 'Fetch user',
                  path: '/users/{id}',
                  method: 'GET',
                },
              },
            },
          },
        } as any;
        expect(() => validateProvidersConfig(config)).not.toThrow();
      });

      it('should error for non-object restServers', () => {
        const config = { restServers: [] };
        expect(() => validateProvidersConfig(config)).toThrow(
          'Invalid providers configuration: restServers must be an object'
        );
      });

      it('should error for invalid REST server', () => {
        const config = { restServers: { broken: null } };
        expect(() => validateProvidersConfig(config)).toThrow(
          "Invalid REST server 'broken': must be an object"
        );
      });
    });
  });

  describe('validateAgentsConfig', () => {
    it('should validate valid agents config (object)', () => {
      const config: AgentsConfig = {
        basePrompt: 'You are a helpful assistant',
        defaultPrompt: 'You have access to tools',
        agents: {
          gpt_4o: {
            name: 'GPT-4O',
            description: 'GPT-4O agent',
            transport: 'http',
            url: 'http://localhost:3000/agent',
          },
        },
      } as any;
      expect(() => validateAgentsConfig(config)).not.toThrow();
    });

    it('should validate minimal agents config', () => {
      const config: AgentsConfig = {
        agents: {
          test_agent: {
            name: 'Test Agent',
            description: 'Test agent description',
            transport: 'http',
            url: 'http://localhost:3000/agent',
          },
        },
      } as any;
      expect(() => validateAgentsConfig(config)).not.toThrow();
    });

    it('should throw error for non-object config', () => {
      expect(() => validateAgentsConfig(null)).toThrow(
        'Invalid agents configuration: must be a valid JSON object'
      );

      expect(() => validateAgentsConfig([])).toThrow(
        'Invalid agents configuration: must be a valid JSON object'
      );

      expect(() => validateAgentsConfig('string')).toThrow(
        'Invalid agents configuration: must be a valid JSON object'
      );
    });

    it('should throw error for agents not object', () => {
      const config = { agents: 'not-object' };
      expect(() => validateAgentsConfig(config)).toThrow(
        'Invalid agents configuration: agents must be an object'
      );
    });

    it('should throw error for empty agents object', () => {
      const config = { agents: {} };
      expect(() => validateAgentsConfig(config)).toThrow(
        'Invalid agents configuration: at least one agent must be configured'
      );
    });

    it('should throw error for invalid agent object', () => {
      const config = { agents: { broken: null } };
      expect(() => validateAgentsConfig(config)).toThrow(
        "Invalid agent 'broken': must be an object"
      );
    });

    it('should throw error for missing transport', () => {
      const config = { agents: { test: { name: 'X', description: 'Y' } } };
      expect(() => validateAgentsConfig(config)).toThrow(
        "Invalid agent 'test': missing or invalid transport"
      );
    });

    it('should throw error for missing name', () => {
      const config = { agents: { test: { transport: 'http', url: 'http://x', description: 'd' } } };
      expect(() => validateAgentsConfig(config)).toThrow(
        "Invalid agent 'test': missing or invalid name"
      );
    });

    it('should throw error for invalid identifier format (key)', () => {
      const config = {
        agents: {
          'Bad Identifier': {
            name: 'Test',
            description: 'Desc',
            transport: 'http',
            url: 'http://localhost:3000',
          },
        },
      };
      expect(() => validateAgentsConfig(config)).toThrow(
        'Invalid agent: identifier "Bad Identifier" must contain only letters, numbers, hyphens, or underscores (no spaces)'
      );
    });

    it('should accept valid identifier keys', () => {
      const valid = ['test', 'test-agent', 'test_agent', 'test123', 'gpt-4o_turbo'];
      valid.forEach((id) => {
        const config = {
          agents: {
            [id]: {
              name: 'Agent',
              description: 'Desc',
              transport: 'http',
              url: 'http://localhost',
            },
          },
        };
        expect(() => validateAgentsConfig(config)).not.toThrow();
      });
    });

    it('should throw error for identifier length exceeding 32 characters', () => {
      const longId = 'this_is_a_very_long_identifier_that_exceeds_32_characters';
      const config = {
        agents: {
          [longId]: {
            name: 'X',
            description: 'Y',
            transport: 'http',
            url: 'http://localhost',
          },
        },
      };
      expect(() => validateAgentsConfig(config)).toThrow(
        `Invalid agent: identifier "${longId}" must be 32 characters or less (current: 57)`
      );
    });

    it('should throw error for invalid basePrompt type', () => {
      const config = {
        basePrompt: 123,
        agents: {
          test: {
            name: 'Test',
            description: 'Desc',
            transport: 'http',
            url: 'http://localhost',
          },
        },
      };
      expect(() => validateAgentsConfig(config)).toThrow(
        'Invalid agents configuration: basePrompt must be a string'
      );
    });

    it('should throw error for invalid defaultPrompt type', () => {
      const config = {
        defaultPrompt: [],
        agents: {
          test: {
            name: 'Test',
            description: 'Desc',
            transport: 'http',
            url: 'http://localhost',
          },
        },
      };
      expect(() => validateAgentsConfig(config)).toThrow(
        'Invalid agents configuration: defaultPrompt must be a string'
      );
    });
  });
});
