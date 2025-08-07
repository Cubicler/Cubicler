import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { loadConfigFromSource } from '../../src/utils/config-helper.js';
import { createEnvCache } from '../../src/utils/cache.js';
import type { WebhooksConfig } from '../../src/model/webhooks.js';

// Mock dependencies
vi.mock('../../src/utils/config-helper.js');
vi.mock('../../src/utils/cache.js');
vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

const mockLoadConfigFromSource = vi.mocked(loadConfigFromSource);
const mockCreateEnvCache = vi.mocked(createEnvCache);

describe('WebhookRepository', () => {
  // Mock cache instance
  const mockCache = {
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
    has: vi.fn(),
    delete: vi.fn(),
    size: vi.fn(),
  };

  // We'll import the WebhookRepository dynamically after setting up mocks
  let WebhookRepository: any;

  // Test data
  const mockWebhooksConfig: WebhooksConfig = {
    webhooks: [
      {
        identifier: 'github_push',
        name: 'GitHub Push Webhook',
        description: 'Handle GitHub push events',
        config: {
          authentication: {
            type: 'signature',
            secret: 'github-webhook-secret',
          },
          allowedOrigins: ['github.com'],
        },
        agents: ['code_reviewer', 'deployment_agent'],
        payload_transform: [
          {
            path: 'repository.name',
            transform: 'map',
            map: { 'repository.name': 'repo_name' },
          },
          {
            path: 'commits[]',
            transform: 'template',
            template: 'Commit: {value.id}',
          },
        ],
      },
      {
        identifier: 'slack_command',
        name: 'Slack Command Webhook',
        description: 'Handle Slack slash commands',
        config: {
          authentication: {
            type: 'bearer',
            token: 'slack-webhook-token',
          },
        },
        agents: ['slack_bot'],
      },
      {
        identifier: 'internal_trigger',
        name: 'Internal System Trigger',
        description: 'Internal system notifications',
        config: {},
        agents: ['system_monitor', 'alert_handler'],
      },
    ],
  };

  const emptyWebhooksConfig: WebhooksConfig = {
    webhooks: [],
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CUBICLER_WEBHOOKS_LIST;
  });

  describe('getWebhooksConfig', () => {
    beforeEach(async () => {
      // Import WebhookRepository after mocks are set up
      const module = await import('../../src/repository/webhook-repository.js');
      WebhookRepository = module.WebhookRepository;
    });

    it('should load and cache webhooks configuration from file', async () => {
      process.env.CUBICLER_WEBHOOKS_LIST = './tests/mocks/test-webhooks.json';

      // Mock cache miss
      mockCache.get.mockReturnValue(null);
      mockLoadConfigFromSource.mockResolvedValue(mockWebhooksConfig);

      const repository = new WebhookRepository();
      const result = await repository.getWebhooksConfig();

      expect(result).toEqual(mockWebhooksConfig);
      expect(mockLoadConfigFromSource).toHaveBeenCalledWith(
        'CUBICLER_WEBHOOKS_LIST',
        'webhook configuration'
      );
      expect(mockCache.set).toHaveBeenCalledWith('webhooks-config', mockWebhooksConfig);
      expect(mockCache.get).toHaveBeenCalledWith('webhooks-config');
    });

    it('should return cached configuration when available', async () => {
      process.env.CUBICLER_WEBHOOKS_LIST = './tests/mocks/test-webhooks.json';

      // Mock cache hit
      mockCache.get.mockReturnValue(mockWebhooksConfig);

      const repository = new WebhookRepository();
      const result = await repository.getWebhooksConfig();

      expect(result).toEqual(mockWebhooksConfig);
      expect(mockLoadConfigFromSource).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
      expect(mockCache.get).toHaveBeenCalledWith('webhooks-config');
    });

    it('should return empty configuration when CUBICLER_WEBHOOKS_LIST is not set', async () => {
      // No environment variable set
      mockCache.get.mockReturnValue(null);

      const repository = new WebhookRepository();
      const result = await repository.getWebhooksConfig();

      expect(result).toEqual(emptyWebhooksConfig);
      expect(mockLoadConfigFromSource).not.toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledWith('webhooks-config', emptyWebhooksConfig);
    });

    it('should handle configuration loading errors', async () => {
      process.env.CUBICLER_WEBHOOKS_LIST = './invalid-path.json';

      mockCache.get.mockReturnValue(null);
      mockLoadConfigFromSource.mockRejectedValue(new Error('File not found'));

      const repository = new WebhookRepository();

      await expect(repository.getWebhooksConfig()).rejects.toThrow(
        'Failed to load webhook configuration: File not found'
      );

      expect(mockLoadConfigFromSource).toHaveBeenCalledWith(
        'CUBICLER_WEBHOOKS_LIST',
        'webhook configuration'
      );
    });

    it('should validate configuration structure - missing webhooks array', async () => {
      process.env.CUBICLER_WEBHOOKS_LIST = './test-config.json';

      mockCache.get.mockReturnValue(null);
      mockLoadConfigFromSource.mockResolvedValue({ invalid: 'structure' });

      const repository = new WebhookRepository();

      await expect(repository.getWebhooksConfig()).rejects.toThrow(
        'Failed to load webhook configuration: Invalid webhook configuration: missing or invalid webhooks array'
      );
    });

    it('should validate configuration structure - null configuration', async () => {
      process.env.CUBICLER_WEBHOOKS_LIST = './test-config.json';

      mockCache.get.mockReturnValue(null);
      mockLoadConfigFromSource.mockResolvedValue(null);

      const repository = new WebhookRepository();

      await expect(repository.getWebhooksConfig()).rejects.toThrow(
        'Failed to load webhook configuration: Invalid webhook configuration: must be a valid JSON object'
      );
    });

    it('should validate individual webhook configurations', async () => {
      process.env.CUBICLER_WEBHOOKS_LIST = './test-config.json';

      const invalidWebhookConfig = {
        webhooks: [
          {
            // Missing required identifier
            name: 'Test Webhook',
            description: 'Test description',
            config: {},
            agents: ['test_agent'],
          },
        ],
      };

      mockCache.get.mockReturnValue(null);
      mockLoadConfigFromSource.mockResolvedValue(invalidWebhookConfig);

      const repository = new WebhookRepository();

      await expect(repository.getWebhooksConfig()).rejects.toThrow(
        'Failed to load webhook configuration: Webhook must have a valid identifier'
      );
    });
  });

  describe('getWebhookConfig', () => {
    beforeEach(async () => {
      const module = await import('../../src/repository/webhook-repository.js');
      WebhookRepository = module.WebhookRepository;
    });

    it('should return specific webhook configuration by identifier', async () => {
      process.env.CUBICLER_WEBHOOKS_LIST = './test-config.json';

      mockCache.get.mockReturnValue(mockWebhooksConfig);

      const repository = new WebhookRepository();
      const result = await repository.getWebhookConfig('github_push');

      expect(result).toEqual(mockWebhooksConfig.webhooks[0]);
    });

    it('should return null for non-existent webhook', async () => {
      process.env.CUBICLER_WEBHOOKS_LIST = './test-config.json';

      mockCache.get.mockReturnValue(mockWebhooksConfig);

      const repository = new WebhookRepository();
      const result = await repository.getWebhookConfig('non_existent');

      expect(result).toBeNull();
    });

    it('should return null when webhooks config is empty', async () => {
      process.env.CUBICLER_WEBHOOKS_LIST = './test-config.json';

      mockCache.get.mockReturnValue(emptyWebhooksConfig);

      const repository = new WebhookRepository();
      const result = await repository.getWebhookConfig('github_push');

      expect(result).toBeNull();
    });
  });

  describe('isAgentAuthorized', () => {
    beforeEach(async () => {
      const module = await import('../../src/repository/webhook-repository.js');
      WebhookRepository = module.WebhookRepository;
    });

    it('should return true when agent is authorized for webhook', async () => {
      process.env.CUBICLER_WEBHOOKS_LIST = './test-config.json';

      mockCache.get.mockReturnValue(mockWebhooksConfig);

      const repository = new WebhookRepository();
      const result = await repository.isAgentAuthorized('github_push', 'code_reviewer');

      expect(result).toBe(true);
    });

    it('should return true when agent is in the authorized list', async () => {
      process.env.CUBICLER_WEBHOOKS_LIST = './test-config.json';

      mockCache.get.mockReturnValue(mockWebhooksConfig);

      const repository = new WebhookRepository();
      const result = await repository.isAgentAuthorized('internal_trigger', 'alert_handler');

      expect(result).toBe(true);
    });

    it('should return false when agent is not authorized for webhook', async () => {
      process.env.CUBICLER_WEBHOOKS_LIST = './test-config.json';

      mockCache.get.mockReturnValue(mockWebhooksConfig);

      const repository = new WebhookRepository();
      const result = await repository.isAgentAuthorized('github_push', 'unauthorized_agent');

      expect(result).toBe(false);
    });

    it('should return false when webhook does not exist', async () => {
      process.env.CUBICLER_WEBHOOKS_LIST = './test-config.json';

      mockCache.get.mockReturnValue(mockWebhooksConfig);

      const repository = new WebhookRepository();
      const result = await repository.isAgentAuthorized('non_existent', 'test_agent');

      expect(result).toBe(false);
    });
  });

  describe('validateWebhookConfig', () => {
    beforeEach(async () => {
      const module = await import('../../src/repository/webhook-repository.js');
      WebhookRepository = module.WebhookRepository;
    });

    it('should validate webhook with missing identifier', async () => {
      process.env.CUBICLER_WEBHOOKS_LIST = './test-config.json';

      const invalidConfig = {
        webhooks: [
          {
            name: 'Test Webhook',
            description: 'Test description',
            config: {},
            agents: ['test_agent'],
          },
        ],
      };

      mockCache.get.mockReturnValue(null);
      mockLoadConfigFromSource.mockResolvedValue(invalidConfig);

      const repository = new WebhookRepository();

      await expect(repository.getWebhooksConfig()).rejects.toThrow(
        'Failed to load webhook configuration: Webhook must have a valid identifier'
      );
    });

    it('should validate webhook with missing name', async () => {
      process.env.CUBICLER_WEBHOOKS_LIST = './test-config.json';

      const invalidConfig = {
        webhooks: [
          {
            identifier: 'test_webhook',
            description: 'Test description',
            config: {},
            agents: ['test_agent'],
          },
        ],
      };

      mockCache.get.mockReturnValue(null);
      mockLoadConfigFromSource.mockResolvedValue(invalidConfig);

      const repository = new WebhookRepository();

      await expect(repository.getWebhooksConfig()).rejects.toThrow(
        'Failed to load webhook configuration: Webhook test_webhook must have a valid name'
      );
    });

    it('should validate webhook with missing description', async () => {
      process.env.CUBICLER_WEBHOOKS_LIST = './test-config.json';

      const invalidConfig = {
        webhooks: [
          {
            identifier: 'test_webhook',
            name: 'Test Webhook',
            config: {},
            agents: ['test_agent'],
          },
        ],
      };

      mockCache.get.mockReturnValue(null);
      mockLoadConfigFromSource.mockResolvedValue(invalidConfig);

      const repository = new WebhookRepository();

      await expect(repository.getWebhooksConfig()).rejects.toThrow(
        'Failed to load webhook configuration: Webhook test_webhook must have a valid description'
      );
    });

    it('should validate webhook with empty agents array', async () => {
      process.env.CUBICLER_WEBHOOKS_LIST = './test-config.json';

      const invalidConfig = {
        webhooks: [
          {
            identifier: 'test_webhook',
            name: 'Test Webhook',
            description: 'Test description',
            config: {},
            agents: [],
          },
        ],
      };

      mockCache.get.mockReturnValue(null);
      mockLoadConfigFromSource.mockResolvedValue(invalidConfig);

      const repository = new WebhookRepository();

      await expect(repository.getWebhooksConfig()).rejects.toThrow(
        'Failed to load webhook configuration: Webhook test_webhook must have at least one authorized agent'
      );
    });

    it('should validate webhook with invalid agent identifier', async () => {
      process.env.CUBICLER_WEBHOOKS_LIST = './test-config.json';

      const invalidConfig = {
        webhooks: [
          {
            identifier: 'test_webhook',
            name: 'Test Webhook',
            description: 'Test description',
            config: {},
            agents: ['valid_agent', ''],
          },
        ],
      };

      mockCache.get.mockReturnValue(null);
      mockLoadConfigFromSource.mockResolvedValue(invalidConfig);

      const repository = new WebhookRepository();

      await expect(repository.getWebhooksConfig()).rejects.toThrow(
        'Failed to load webhook configuration: Webhook test_webhook has invalid agent identifier:'
      );
    });

    it('should validate webhook with missing config object', async () => {
      process.env.CUBICLER_WEBHOOKS_LIST = './test-config.json';

      const invalidConfig = {
        webhooks: [
          {
            identifier: 'test_webhook',
            name: 'Test Webhook',
            description: 'Test description',
            agents: ['test_agent'],
          },
        ],
      };

      mockCache.get.mockReturnValue(null);
      mockLoadConfigFromSource.mockResolvedValue(invalidConfig);

      const repository = new WebhookRepository();

      await expect(repository.getWebhooksConfig()).rejects.toThrow(
        'Failed to load webhook configuration: Webhook test_webhook must have a valid config object'
      );
    });

    it('should validate webhook with invalid authentication type', async () => {
      process.env.CUBICLER_WEBHOOKS_LIST = './test-config.json';

      const invalidConfig = {
        webhooks: [
          {
            identifier: 'test_webhook',
            name: 'Test Webhook',
            description: 'Test description',
            config: {
              authentication: {
                type: 'invalid',
              },
            },
            agents: ['test_agent'],
          },
        ],
      };

      mockCache.get.mockReturnValue(null);
      mockLoadConfigFromSource.mockResolvedValue(invalidConfig);

      const repository = new WebhookRepository();

      await expect(repository.getWebhooksConfig()).rejects.toThrow(
        'Failed to load webhook configuration: Webhook test_webhook has invalid authentication type: invalid'
      );
    });

    it('should validate signature authentication without secret', async () => {
      process.env.CUBICLER_WEBHOOKS_LIST = './test-config.json';

      const invalidConfig = {
        webhooks: [
          {
            identifier: 'test_webhook',
            name: 'Test Webhook',
            description: 'Test description',
            config: {
              authentication: {
                type: 'signature',
              },
            },
            agents: ['test_agent'],
          },
        ],
      };

      mockCache.get.mockReturnValue(null);
      mockLoadConfigFromSource.mockResolvedValue(invalidConfig);

      const repository = new WebhookRepository();

      await expect(repository.getWebhooksConfig()).rejects.toThrow(
        'Failed to load webhook configuration: Webhook test_webhook with signature authentication must have a valid secret'
      );
    });

    it('should validate bearer authentication without token', async () => {
      process.env.CUBICLER_WEBHOOKS_LIST = './test-config.json';

      const invalidConfig = {
        webhooks: [
          {
            identifier: 'test_webhook',
            name: 'Test Webhook',
            description: 'Test description',
            config: {
              authentication: {
                type: 'bearer',
              },
            },
            agents: ['test_agent'],
          },
        ],
      };

      mockCache.get.mockReturnValue(null);
      mockLoadConfigFromSource.mockResolvedValue(invalidConfig);

      const repository = new WebhookRepository();

      await expect(repository.getWebhooksConfig()).rejects.toThrow(
        'Failed to load webhook configuration: Webhook test_webhook with bearer authentication must have a valid token'
      );
    });

    it('should validate webhook with invalid payload_transform', async () => {
      process.env.CUBICLER_WEBHOOKS_LIST = './test-config.json';

      const invalidConfig = {
        webhooks: [
          {
            identifier: 'test_webhook',
            name: 'Test Webhook',
            description: 'Test description',
            config: {},
            agents: ['test_agent'],
            payload_transform: 'invalid',
          },
        ],
      };

      mockCache.get.mockReturnValue(null);
      mockLoadConfigFromSource.mockResolvedValue(invalidConfig);

      const repository = new WebhookRepository();

      await expect(repository.getWebhooksConfig()).rejects.toThrow(
        'Failed to load webhook configuration: Webhook test_webhook payload_transform must be an array'
      );
    });

    it('should accept valid webhook configuration', async () => {
      process.env.CUBICLER_WEBHOOKS_LIST = './test-config.json';

      const validConfig = {
        webhooks: [
          {
            identifier: 'test_webhook',
            name: 'Test Webhook',
            description: 'Test description',
            config: {
              authentication: {
                type: 'signature',
                secret: 'test-secret',
              },
            },
            agents: ['test_agent'],
            payload_transform: [
              {
                path: 'data.field',
                transform: 'map',
                map: { 'data.field': 'transformed_field' },
              },
            ],
          },
        ],
      };

      mockCache.get.mockReturnValue(null);
      mockLoadConfigFromSource.mockResolvedValue(validConfig);

      const repository = new WebhookRepository();
      const result = await repository.getWebhooksConfig();

      expect(result).toEqual(validConfig);
    });
  });
});
