import { beforeEach, describe, it, expect, vi, afterEach } from 'vitest';
import crypto from 'crypto';
import { WebhookService } from '../../src/core/webhook-service.js';
import type { WebhooksConfigProviding } from '../../src/interface/webhooks-config-providing.js';
import { WebhookConfig, WebhookRequest, ProcessedWebhook } from '../../src/model/webhooks.js';
import { transformResponse } from '../../src/utils/response-transformer.js';

// Mock the response transformer
vi.mock('../../src/utils/response-transformer.js');

const mockTransformResponse = vi.mocked(transformResponse);

describe('WebhookService', () => {
  let mockConfigProvider: WebhooksConfigProviding;
  let webhookService: WebhookService;

  // Test webhook configurations
  const mockWebhookWithSignature: WebhookConfig = {
    name: 'GitHub Push Webhook',
    description: 'Handle GitHub push events',
    auth: {
      type: 'signature',
      secret: 'test-secret',
    },
    allowedAgents: ['code_reviewer', 'deployment_agent'],
    payload_transform: [
      {
        path: 'repository.name',
        transform: 'map',
        map: { 'repository.name': 'repo_name' },
      },
    ],
  };

  const mockWebhookWithBearer: WebhookConfig = {
    name: 'Slack Command Webhook',
    description: 'Handle Slack slash commands',
    auth: {
      type: 'bearer',
      token: 'test-token',
    },
    allowedAgents: ['slack_bot'],
  };

  const mockWebhookNoAuth: WebhookConfig = {
    name: 'Internal System Trigger',
    description: 'Internal system notifications',
    allowedAgents: ['system_monitor'],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset console methods to avoid spam in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock config provider
    mockConfigProvider = {
      getWebhooksConfig: vi.fn(),
      getWebhookConfig: vi.fn(),
      isAgentAuthorized: vi.fn(),
    };

    // Create service instance
    webhookService = new WebhookService(
      mockConfigProvider as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );

    // Default mock setup for transformResponse
    mockTransformResponse.mockImplementation((payload, transforms) => {
      // Simple mock transformation
      if (transforms && transforms.length > 0) {
        // Ensure we always return an object for test transformation mock
        return {
          ...(typeof payload === 'object' && payload !== null ? payload : {}),
          transformed: true,
        } as any;
      }
      return payload as any;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('processWebhook', () => {
    it('should process webhook with signature authentication successfully', async () => {
      const payload = { action: 'push', repository: { name: 'test-repo' } };
      const payloadString = JSON.stringify(payload);
      const signature = `sha256=${crypto
        .createHmac('sha256', 'test-secret')
        .update(payloadString, 'utf8')
        .digest('hex')}`;

      const webhookRequest: WebhookRequest = {
        identifier: 'github_push',
        agentId: 'code_reviewer',
        payload,
        headers: {
          'x-signature-256': signature,
        },
      };

      // Mock config provider responses
      mockConfigProvider.getWebhookConfig = vi.fn().mockResolvedValue(mockWebhookWithSignature);
      mockConfigProvider.isAgentAuthorized = vi.fn().mockResolvedValue(true);

      const result = await webhookService.processWebhook(webhookRequest);

      expect(result).toBeDefined();
      expect(result.webhook).toEqual(mockWebhookWithSignature);
      expect(result.transformedPayload).toEqual({ ...payload, transformed: true });
      expect(result.triggeredAt).toBeDefined();
      expect(typeof result.triggeredAt).toBe('string');

      expect(mockConfigProvider.getWebhookConfig).toHaveBeenCalledWith('github_push');
      expect(mockConfigProvider.isAgentAuthorized).toHaveBeenCalledWith(
        'github_push',
        'code_reviewer'
      );
      expect(mockTransformResponse).toHaveBeenCalledWith(
        payload,
        mockWebhookWithSignature.payload_transform
      );
    });

    it('should process webhook with bearer token authentication successfully', async () => {
      const payload = { command: '/weather', text: 'New York' };

      const webhookRequest: WebhookRequest = {
        identifier: 'slack_command',
        agentId: 'slack_bot',
        payload,
        headers: {
          authorization: 'Bearer test-token',
        },
      };

      mockConfigProvider.getWebhookConfig = vi.fn().mockResolvedValue(mockWebhookWithBearer);
      mockConfigProvider.isAgentAuthorized = vi.fn().mockResolvedValue(true);

      const result = await webhookService.processWebhook(webhookRequest);

      expect(result).toBeDefined();
      expect(result.webhook).toEqual(mockWebhookWithBearer);
      expect(result.transformedPayload).toEqual(payload); // No transformations
      expect(result.triggeredAt).toBeDefined();
    });

    it('should process webhook without authentication successfully', async () => {
      const payload = { alert: 'system_overload', severity: 'high' };

      const webhookRequest: WebhookRequest = {
        identifier: 'internal_trigger',
        agentId: 'system_monitor',
        payload,
        headers: {},
      };

      mockConfigProvider.getWebhookConfig = vi.fn().mockResolvedValue(mockWebhookNoAuth);
      mockConfigProvider.isAgentAuthorized = vi.fn().mockResolvedValue(true);

      const result = await webhookService.processWebhook(webhookRequest);

      expect(result).toBeDefined();
      expect(result.webhook).toEqual(mockWebhookNoAuth);
      expect(result.transformedPayload).toEqual(payload);
    });

    it('should throw error when webhook is not found', async () => {
      const webhookRequest: WebhookRequest = {
        identifier: 'unknown_webhook',
        agentId: 'test_agent',
        payload: {},
        headers: {},
      };

      mockConfigProvider.getWebhookConfig = vi.fn().mockResolvedValue(null);

      await expect(webhookService.processWebhook(webhookRequest)).rejects.toThrow(
        'Webhook not found: unknown_webhook'
      );
    });

    it('should throw error when agent is not authorized', async () => {
      const webhookRequest: WebhookRequest = {
        identifier: 'github_push',
        agentId: 'unauthorized_agent',
        payload: {},
        headers: {},
      };

      mockConfigProvider.getWebhookConfig = vi.fn().mockResolvedValue(mockWebhookWithSignature);
      mockConfigProvider.isAgentAuthorized = vi.fn().mockResolvedValue(false);

      await expect(webhookService.processWebhook(webhookRequest)).rejects.toThrow(
        'Agent unauthorized_agent is not authorized for webhook github_push'
      );
    });

    it('should throw error with invalid signature', async () => {
      const payload = { action: 'push' };
      // Create an invalid signature with the same length as a valid one
      const invalidSignature =
        'sha256=0000000000000000000000000000000000000000000000000000000000000000';

      const webhookRequest: WebhookRequest = {
        identifier: 'github_push',
        agentId: 'code_reviewer',
        payload,
        headers: {
          'x-signature-256': invalidSignature,
        },
      };

      mockConfigProvider.getWebhookConfig = vi.fn().mockResolvedValue(mockWebhookWithSignature);
      mockConfigProvider.isAgentAuthorized = vi.fn().mockResolvedValue(true);

      await expect(webhookService.processWebhook(webhookRequest)).rejects.toThrow(
        'Invalid webhook signature'
      );
    });

    it('should throw error with missing signature', async () => {
      const webhookRequest: WebhookRequest = {
        identifier: 'github_push',
        agentId: 'code_reviewer',
        payload: { action: 'push' },
        headers: {},
      };

      mockConfigProvider.getWebhookConfig = vi.fn().mockResolvedValue(mockWebhookWithSignature);
      mockConfigProvider.isAgentAuthorized = vi.fn().mockResolvedValue(true);

      await expect(webhookService.processWebhook(webhookRequest)).rejects.toThrow(
        'Missing webhook signature'
      );
    });

    it('should throw error with invalid bearer token', async () => {
      // Create an invalid token with the same length as the valid one
      const validTokenLength = 'test-token'.length;
      const invalidToken = 'x'.repeat(validTokenLength);

      const webhookRequest: WebhookRequest = {
        identifier: 'slack_command',
        agentId: 'slack_bot',
        payload: {},
        headers: {
          authorization: `Bearer ${invalidToken}`,
        },
      };

      mockConfigProvider.getWebhookConfig = vi.fn().mockResolvedValue(mockWebhookWithBearer);
      mockConfigProvider.isAgentAuthorized = vi.fn().mockResolvedValue(true);

      await expect(webhookService.processWebhook(webhookRequest)).rejects.toThrow(
        'Invalid bearer token'
      );
    });

    it('should throw error with missing authorization header for bearer auth', async () => {
      const webhookRequest: WebhookRequest = {
        identifier: 'slack_command',
        agentId: 'slack_bot',
        payload: {},
        headers: {},
      };

      mockConfigProvider.getWebhookConfig = vi.fn().mockResolvedValue(mockWebhookWithBearer);
      mockConfigProvider.isAgentAuthorized = vi.fn().mockResolvedValue(true);

      await expect(webhookService.processWebhook(webhookRequest)).rejects.toThrow(
        'Missing Authorization header'
      );
    });

    it('should handle signature from request signature property', async () => {
      const payload = { action: 'push', repository: { name: 'test-repo' } };
      const payloadString = JSON.stringify(payload);
      const signature = `sha256=${crypto
        .createHmac('sha256', 'test-secret')
        .update(payloadString, 'utf8')
        .digest('hex')}`;

      const webhookRequest: WebhookRequest = {
        identifier: 'github_push',
        agentId: 'code_reviewer',
        payload,
        headers: {},
        signature,
      };

      mockConfigProvider.getWebhookConfig = vi.fn().mockResolvedValue(mockWebhookWithSignature);
      mockConfigProvider.isAgentAuthorized = vi.fn().mockResolvedValue(true);

      const result = await webhookService.processWebhook(webhookRequest);

      expect(result).toBeDefined();
      expect(result.webhook).toEqual(mockWebhookWithSignature);
    });

    it('should handle bearer token without Bearer prefix', async () => {
      const payload = { command: '/help' };

      const webhookRequest: WebhookRequest = {
        identifier: 'slack_command',
        agentId: 'slack_bot',
        payload,
        headers: {
          authorization: 'test-token', // No Bearer prefix
        },
      };

      mockConfigProvider.getWebhookConfig = vi.fn().mockResolvedValue(mockWebhookWithBearer);
      mockConfigProvider.isAgentAuthorized = vi.fn().mockResolvedValue(true);

      const result = await webhookService.processWebhook(webhookRequest);

      expect(result).toBeDefined();
      expect(result.webhook).toEqual(mockWebhookWithBearer);
    });

    it('should throw error for signature auth without secret', async () => {
      const webhookConfigNoSecret: WebhookConfig = {
        ...mockWebhookWithSignature,
        auth: {
          type: 'signature',
          // secret missing
        },
      };

      const webhookRequest: WebhookRequest = {
        identifier: 'github_push',
        agentId: 'code_reviewer',
        payload: {},
        headers: {},
      };

      mockConfigProvider.getWebhookConfig = vi.fn().mockResolvedValue(webhookConfigNoSecret);
      mockConfigProvider.isAgentAuthorized = vi.fn().mockResolvedValue(true);

      await expect(webhookService.processWebhook(webhookRequest)).rejects.toThrow(
        'Signature authentication requires a secret'
      );
    });

    it('should throw error for bearer auth without token', async () => {
      const webhookConfigNoToken: WebhookConfig = {
        ...mockWebhookWithBearer,
        auth: {
          type: 'bearer',
          // token missing
        },
      };

      const webhookRequest: WebhookRequest = {
        identifier: 'slack_command',
        agentId: 'slack_bot',
        payload: {},
        headers: {},
      };

      mockConfigProvider.getWebhookConfig = vi.fn().mockResolvedValue(webhookConfigNoToken);
      mockConfigProvider.isAgentAuthorized = vi.fn().mockResolvedValue(true);

      await expect(webhookService.processWebhook(webhookRequest)).rejects.toThrow(
        'Bearer authentication requires a token'
      );
    });

    it('should throw error for unsupported authentication type', async () => {
      const webhookConfigInvalidAuth: WebhookConfig = {
        ...mockWebhookWithSignature,
        auth: {
          // @ts-expect-error invalid auth type for test
          type: 'oauth',
        },
      };

      const webhookRequest: WebhookRequest = {
        identifier: 'github_push',
        agentId: 'code_reviewer',
        payload: {},
        headers: {},
      };

      mockConfigProvider.getWebhookConfig = vi.fn().mockResolvedValue(webhookConfigInvalidAuth);
      mockConfigProvider.isAgentAuthorized = vi.fn().mockResolvedValue(true);

      await expect(webhookService.processWebhook(webhookRequest)).rejects.toThrow(
        'Unsupported authentication type: oauth'
      );
    });
  });

  describe('createTriggerContext', () => {
    it('should create proper trigger context from processed webhook', () => {
      const transformedPayload = { repo_name: 'test-repo', transformed: true };
      const triggeredAt = '2025-08-07T10:30:00.000Z';

      const processedWebhook: ProcessedWebhook = {
        webhookId: 'github_push',
        webhook: mockWebhookWithSignature,
        transformedPayload,
        triggeredAt,
      };

      const result = webhookService.createTriggerContext(processedWebhook);

      expect(result).toEqual({
        type: 'webhook',
        identifier: 'github_push',
        name: 'GitHub Push Webhook',
        description: 'Handle GitHub push events',
        triggeredAt,
        payload: transformedPayload,
      });
    });

    it('should create trigger context with different webhook types', () => {
      const processedWebhook: ProcessedWebhook = {
        webhookId: 'internal_trigger',
        webhook: mockWebhookNoAuth,
        transformedPayload: { alert: 'critical' },
        triggeredAt: '2025-08-07T11:00:00.000Z',
      };

      const result = webhookService.createTriggerContext(processedWebhook);

      expect(result).toEqual({
        type: 'webhook',
        identifier: 'internal_trigger',
        name: 'Internal System Trigger',
        description: 'Internal system notifications',
        triggeredAt: '2025-08-07T11:00:00.000Z',
        payload: { alert: 'critical' },
      });
    });
  });

  describe('payload transformation', () => {
    it('should not transform payload when no transformations are configured', async () => {
      const payload = { command: '/help' };

      const webhookRequest: WebhookRequest = {
        identifier: 'slack_command',
        agentId: 'slack_bot',
        payload,
        headers: {
          authorization: 'Bearer test-token',
        },
      };

      mockConfigProvider.getWebhookConfig = vi.fn().mockResolvedValue(mockWebhookWithBearer);
      mockConfigProvider.isAgentAuthorized = vi.fn().mockResolvedValue(true);

      const result = await webhookService.processWebhook(webhookRequest);

      expect(result.transformedPayload).toEqual(payload);
      expect(mockTransformResponse).not.toHaveBeenCalled();
    });

    it('should apply transformations when configured', async () => {
      const payload = { repository: { name: 'test-repo' }, action: 'push' };
      const transformedPayload = { repo_name: 'test-repo', action: 'push', transformed: true };

      mockTransformResponse.mockReturnValue(transformedPayload);

      const webhookRequest: WebhookRequest = {
        identifier: 'github_push',
        agentId: 'code_reviewer',
        payload,
        headers: {
          'x-signature-256': `sha256=${crypto
            .createHmac('sha256', 'test-secret')
            .update(JSON.stringify(payload), 'utf8')
            .digest('hex')}`,
        },
      };

      mockConfigProvider.getWebhookConfig = vi.fn().mockResolvedValue(mockWebhookWithSignature);
      mockConfigProvider.isAgentAuthorized = vi.fn().mockResolvedValue(true);

      const result = await webhookService.processWebhook(webhookRequest);

      expect(result.transformedPayload).toEqual(transformedPayload);
      expect(mockTransformResponse).toHaveBeenCalledWith(
        payload,
        mockWebhookWithSignature.payload_transform
      );
    });
  });
});
