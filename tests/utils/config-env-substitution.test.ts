import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { loadConfigFromSource } from '../../src/utils/config-helper.js';
import { fetchWithDefaultTimeout } from '../../src/utils/fetch-helper.js';

// Mock only file system and fetch, not env-helper functions
vi.mock('fs');
vi.mock('../../src/utils/fetch-helper.js');

const mockReadFileSync = vi.mocked(readFileSync);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockFetchWithDefaultTimeout = vi.mocked(fetchWithDefaultTimeout);

describe('Environment Variable Substitution in Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    // Reset console methods to avoid spam in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  it('should substitute environment variables in providers config', async () => {
    // Setup environment variables
    process.env.API_TOKEN = 'secret-token';
    process.env.SERVICE_URL = 'http://localhost:4000';
    process.env.CUBICLER_PROVIDERS_LIST = '/path/to/config.json';

    const configWithEnvVars = {
      mcpServers: [
        {
          identifier: 'test_service',
          name: 'Test Service',
          description: 'Test service',
          transport: 'http',
          url: '{{env.SERVICE_URL}}/mcp',
          headers: {
            Authorization: 'Bearer {{env.API_TOKEN}}',
          },
        },
      ],
      restServers: [],
    };

    // Mock the file reading
    mockReadFileSync.mockReturnValue(JSON.stringify(configWithEnvVars));

    const result = await loadConfigFromSource('CUBICLER_PROVIDERS_LIST', 'test config');

    expect(result).toEqual({
      mcpServers: [
        {
          identifier: 'test_service',
          name: 'Test Service',
          description: 'Test service',
          transport: 'http',
          url: 'http://localhost:4000/mcp',
          headers: {
            Authorization: 'Bearer secret-token',
          },
        },
      ],
      restServers: [],
    });
  });

  it('should leave placeholders when environment variables are not set', async () => {
    // Ensure environment variables are not set
    delete process.env.MISSING_TOKEN;
    delete process.env.MISSING_URL;
    process.env.CUBICLER_PROVIDERS_LIST = '/path/to/config.json';

    const configWithEnvVars = {
      mcpServers: [
        {
          identifier: 'test_service',
          name: 'Test Service',
          description: 'Test service',
          transport: 'http',
          url: '{{env.MISSING_URL}}/mcp',
          headers: {
            Authorization: 'Bearer {{env.MISSING_TOKEN}}',
          },
        },
      ],
      restServers: [],
    };

    // Mock the file reading
    mockReadFileSync.mockReturnValue(JSON.stringify(configWithEnvVars));

    const result = await loadConfigFromSource('CUBICLER_PROVIDERS_LIST', 'test config');

    expect(result).toEqual({
      mcpServers: [
        {
          identifier: 'test_service',
          name: 'Test Service',
          description: 'Test service',
          transport: 'http',
          url: '{{env.MISSING_URL}}/mcp',
          headers: {
            Authorization: 'Bearer {{env.MISSING_TOKEN}}',
          },
        },
      ],
      restServers: [],
    });
  });

  it('should substitute environment variables in agents config', async () => {
    // Setup environment variables
    process.env.AGENT_URL = 'http://localhost:3000';
    process.env.AGENT_KEY = 'agent-api-key';
    process.env.CUBICLER_AGENTS_LIST = '/path/to/agents.json';

    const configWithEnvVars = {
      basePrompt: 'You are a helpful assistant',
      agents: [
        {
          identifier: 'test_agent',
          name: 'Test Agent',
          transport: 'http',
          url: '{{env.AGENT_URL}}/agent',
          description: 'Test agent with token {{env.AGENT_KEY}}',
        },
      ],
    };

    // Mock the file reading
    mockReadFileSync.mockReturnValue(JSON.stringify(configWithEnvVars));

    const result = await loadConfigFromSource('CUBICLER_AGENTS_LIST', 'test agents config');

    expect(result).toEqual({
      basePrompt: 'You are a helpful assistant',
      agents: [
        {
          identifier: 'test_agent',
          name: 'Test Agent',
          transport: 'http',
          url: 'http://localhost:3000/agent',
          description: 'Test agent with token agent-api-key',
        },
      ],
    });
  });
});
