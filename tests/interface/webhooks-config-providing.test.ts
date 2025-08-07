import { describe, it, expect, vi } from 'vitest';
import type { WebhooksConfigProviding } from '../../src/interface/webhooks-config-providing.js';
import { WebhookConfig, WebhooksConfig } from '../../src/model/webhooks.js';

describe('WebhooksConfigProviding Interface', () => {
  describe('interface compliance', () => {
    it('should define all required methods', () => {
      // Create a mock implementation to test interface compliance
      const mockProvider: WebhooksConfigProviding = {
        getWebhooksConfig: vi.fn(),
        getWebhookConfig: vi.fn(),
        isAgentAuthorized: vi.fn(),
      };

      expect(mockProvider.getWebhooksConfig).toBeDefined();
      expect(mockProvider.getWebhookConfig).toBeDefined();
      expect(mockProvider.isAgentAuthorized).toBeDefined();

      expect(typeof mockProvider.getWebhooksConfig).toBe('function');
      expect(typeof mockProvider.getWebhookConfig).toBe('function');
      expect(typeof mockProvider.isAgentAuthorized).toBe('function');
    });

    it('should support getWebhooksConfig method contract', async () => {
      const mockWebhooksConfig: WebhooksConfig = {
        webhooks: [
          {
            identifier: 'test_webhook',
            name: 'Test Webhook',
            description: 'Test webhook for interface compliance',
            config: {
              authentication: {
                type: 'signature',
                secret: 'test-secret',
              },
            },
            agents: ['test_agent'],
          },
        ],
      };

      const mockProvider: WebhooksConfigProviding = {
        getWebhooksConfig: vi.fn().mockResolvedValue(mockWebhooksConfig),
        getWebhookConfig: vi.fn(),
        isAgentAuthorized: vi.fn(),
      };

      const result = await mockProvider.getWebhooksConfig();

      expect(result).toEqual(mockWebhooksConfig);
      expect(mockProvider.getWebhooksConfig).toHaveBeenCalledTimes(1);
    });

    it('should support getWebhookConfig method contract', async () => {
      const mockWebhookConfig: WebhookConfig = {
        identifier: 'test_webhook',
        name: 'Test Webhook',
        description: 'Test webhook for interface compliance',
        config: {
          authentication: {
            type: 'bearer',
            token: 'test-token',
          },
        },
        agents: ['test_agent'],
      };

      const mockProvider: WebhooksConfigProviding = {
        getWebhooksConfig: vi.fn(),
        getWebhookConfig: vi.fn().mockResolvedValue(mockWebhookConfig),
        isAgentAuthorized: vi.fn(),
      };

      const result = await mockProvider.getWebhookConfig('test_webhook');

      expect(result).toEqual(mockWebhookConfig);
      expect(mockProvider.getWebhookConfig).toHaveBeenCalledWith('test_webhook');
      expect(mockProvider.getWebhookConfig).toHaveBeenCalledTimes(1);
    });

    it('should support getWebhookConfig returning null for non-existent webhooks', async () => {
      const mockProvider: WebhooksConfigProviding = {
        getWebhooksConfig: vi.fn(),
        getWebhookConfig: vi.fn().mockResolvedValue(null),
        isAgentAuthorized: vi.fn(),
      };

      const result = await mockProvider.getWebhookConfig('non_existent');

      expect(result).toBeNull();
      expect(mockProvider.getWebhookConfig).toHaveBeenCalledWith('non_existent');
    });

    it('should support isAgentAuthorized method contract', async () => {
      const mockProvider: WebhooksConfigProviding = {
        getWebhooksConfig: vi.fn(),
        getWebhookConfig: vi.fn(),
        isAgentAuthorized: vi.fn().mockResolvedValue(true),
      };

      const result = await mockProvider.isAgentAuthorized('test_webhook', 'test_agent');

      expect(result).toBe(true);
      expect(mockProvider.isAgentAuthorized).toHaveBeenCalledWith('test_webhook', 'test_agent');
      expect(mockProvider.isAgentAuthorized).toHaveBeenCalledTimes(1);
    });

    it('should support isAgentAuthorized returning false for unauthorized agents', async () => {
      const mockProvider: WebhooksConfigProviding = {
        getWebhooksConfig: vi.fn(),
        getWebhookConfig: vi.fn(),
        isAgentAuthorized: vi.fn().mockResolvedValue(false),
      };

      const result = await mockProvider.isAgentAuthorized('test_webhook', 'unauthorized_agent');

      expect(result).toBe(false);
      expect(mockProvider.isAgentAuthorized).toHaveBeenCalledWith(
        'test_webhook',
        'unauthorized_agent'
      );
    });

    it('should handle async operations correctly', async () => {
      const mockWebhooksConfig: WebhooksConfig = { webhooks: [] };
      const mockWebhookConfig: WebhookConfig = {
        identifier: 'async_test',
        name: 'Async Test',
        description: 'Testing async operations',
        config: {},
        agents: ['async_agent'],
      };

      const mockProvider: WebhooksConfigProviding = {
        getWebhooksConfig: vi
          .fn()
          .mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve(mockWebhooksConfig), 10))
          ),
        getWebhookConfig: vi
          .fn()
          .mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve(mockWebhookConfig), 10))
          ),
        isAgentAuthorized: vi
          .fn()
          .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(true), 10))),
      };

      const [configResult, webhookResult, authResult] = await Promise.all([
        mockProvider.getWebhooksConfig(),
        mockProvider.getWebhookConfig('async_test'),
        mockProvider.isAgentAuthorized('async_test', 'async_agent'),
      ]);

      expect(configResult).toEqual(mockWebhooksConfig);
      expect(webhookResult).toEqual(mockWebhookConfig);
      expect(authResult).toBe(true);
    });

    it('should support error handling in interface methods', async () => {
      const mockProvider: WebhooksConfigProviding = {
        getWebhooksConfig: vi.fn().mockRejectedValue(new Error('Config load failed')),
        getWebhookConfig: vi.fn().mockRejectedValue(new Error('Webhook not found')),
        isAgentAuthorized: vi.fn().mockRejectedValue(new Error('Authorization check failed')),
      };

      await expect(mockProvider.getWebhooksConfig()).rejects.toThrow('Config load failed');
      await expect(mockProvider.getWebhookConfig('test')).rejects.toThrow('Webhook not found');
      await expect(mockProvider.isAgentAuthorized('test', 'agent')).rejects.toThrow(
        'Authorization check failed'
      );
    });
  });

  describe('parameter type validation', () => {
    it('should enforce correct parameter types for getWebhookConfig', async () => {
      const mockProvider: WebhooksConfigProviding = {
        getWebhooksConfig: vi.fn(),
        getWebhookConfig: vi.fn().mockImplementation((identifier: string) => {
          // TypeScript ensures identifier is a string
          expect(typeof identifier).toBe('string');
          return Promise.resolve(null);
        }),
        isAgentAuthorized: vi.fn(),
      };

      await mockProvider.getWebhookConfig('test_identifier');

      expect(mockProvider.getWebhookConfig).toHaveBeenCalledWith('test_identifier');
    });

    it('should enforce correct parameter types for isAgentAuthorized', async () => {
      const mockProvider: WebhooksConfigProviding = {
        getWebhooksConfig: vi.fn(),
        getWebhookConfig: vi.fn(),
        isAgentAuthorized: vi.fn().mockImplementation((webhookId: string, agentId: string) => {
          // TypeScript ensures both parameters are strings
          expect(typeof webhookId).toBe('string');
          expect(typeof agentId).toBe('string');
          return Promise.resolve(true);
        }),
      };

      await mockProvider.isAgentAuthorized('webhook_id', 'agent_id');

      expect(mockProvider.isAgentAuthorized).toHaveBeenCalledWith('webhook_id', 'agent_id');
    });
  });

  describe('return type validation', () => {
    it('should return Promise<WebhooksConfig> from getWebhooksConfig', async () => {
      const mockWebhooksConfig: WebhooksConfig = { webhooks: [] };

      const mockProvider: WebhooksConfigProviding = {
        getWebhooksConfig: vi.fn().mockResolvedValue(mockWebhooksConfig),
        getWebhookConfig: vi.fn(),
        isAgentAuthorized: vi.fn(),
      };

      const result = await mockProvider.getWebhooksConfig();

      // TypeScript compilation ensures this is WebhooksConfig type
      expect(result).toHaveProperty('webhooks');
      expect(Array.isArray(result.webhooks)).toBe(true);
    });

    it('should return Promise<WebhookConfig | null> from getWebhookConfig', async () => {
      const mockWebhookConfig: WebhookConfig = {
        identifier: 'test',
        name: 'Test',
        description: 'Test',
        config: {},
        agents: ['agent'],
      };

      const mockProvider: WebhooksConfigProviding = {
        getWebhooksConfig: vi.fn(),
        getWebhookConfig: vi
          .fn()
          .mockResolvedValueOnce(mockWebhookConfig)
          .mockResolvedValueOnce(null),
        isAgentAuthorized: vi.fn(),
      };

      const result1 = await mockProvider.getWebhookConfig('test');
      const result2 = await mockProvider.getWebhookConfig('non_existent');

      // TypeScript compilation ensures this is WebhookConfig | null
      expect(result1).toEqual(mockWebhookConfig);
      expect(result2).toBeNull();
    });

    it('should return Promise<boolean> from isAgentAuthorized', async () => {
      const mockProvider: WebhooksConfigProviding = {
        getWebhooksConfig: vi.fn(),
        getWebhookConfig: vi.fn(),
        isAgentAuthorized: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false),
      };

      const result1 = await mockProvider.isAgentAuthorized('webhook', 'authorized');
      const result2 = await mockProvider.isAgentAuthorized('webhook', 'unauthorized');

      // TypeScript compilation ensures this is boolean
      expect(typeof result1).toBe('boolean');
      expect(typeof result2).toBe('boolean');
      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });
  });
});
