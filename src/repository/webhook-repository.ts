import { config } from 'dotenv';
import type { WebhooksConfigProviding } from '../interface/webhooks-config-providing.js';
import { WebhookConfig, WebhooksConfig } from '../model/webhooks.js';
import { Cache, createEnvCache } from '../utils/cache.js';
import { loadConfigFromSource } from '../utils/config-helper.js';

config();

/**
 * Webhook Repository for Cubicler
 * Handles loading and caching of webhook configurations from webhooks.json or remote URLs
 * Implements WebhooksConfigProviding interface for dependency injection
 */
class WebhookRepository implements WebhooksConfigProviding {
  private cache: Cache<WebhooksConfig>;

  constructor() {
    this.cache = createEnvCache<WebhooksConfig>('WEBHOOKS');
  }

  /**
   * Get the webhooks configuration with caching support
   * @returns Promise resolving to the webhooks configuration
   */
  async getWebhooksConfig(): Promise<WebhooksConfig> {
    const cacheKey = 'webhooks-config';

    // Try to get from cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`🔄 [WebhookRepository] Using cached webhook configuration`);
      return cached;
    }

    console.log(`📂 [WebhookRepository] Loading webhook configuration...`);

    const source = process.env.CUBICLER_WEBHOOKS_LIST;
    if (!source) {
      console.log(
        `⚠️ [WebhookRepository] CUBICLER_WEBHOOKS_LIST not configured, using empty configuration`
      );
      const emptyConfig: WebhooksConfig = {};
      this.cache.set(cacheKey, emptyConfig);
      return emptyConfig;
    }

    try {
      const data = await loadConfigFromSource<WebhooksConfig>(
        'CUBICLER_WEBHOOKS_LIST',
        'webhook configuration'
      );

      // Validate configuration structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid webhook configuration: must be a valid JSON object');
      }

      // Validate that data is an object (webhooks are now keyed by identifier)
      if (typeof data !== 'object' || data === null) {
        throw new Error('Invalid webhook configuration: must be a valid JSON object');
      }

      // Validate individual webhook configurations
      const webhookEntries = Object.entries(data);
      for (const [webhookId, webhook] of webhookEntries) {
        this.validateWebhookConfig(webhookId, webhook);
      }

      console.log(`✅ [WebhookRepository] Loaded ${webhookEntries.length} webhook configurations`);

      // Cache the configuration
      this.cache.set(cacheKey, data);

      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ [WebhookRepository] Failed to load webhook configuration: ${errorMessage}`);
      throw new Error(`Failed to load webhook configuration: ${errorMessage}`);
    }
  }

  /**
   * Get a specific webhook configuration by identifier
   * @param identifier - The webhook identifier
   * @returns Promise resolving to the webhook config or null if not found
   */
  async getWebhookConfig(identifier: string): Promise<WebhookConfig | null> {
    const config = await this.getWebhooksConfig();
    return config[identifier] || null;
  }

  /**
   * Check if an agent is authorized for a specific webhook
   * @param webhookIdentifier - The webhook identifier
   * @param agentId - The agent identifier
   * @returns Promise resolving to true if authorized
   */
  async isAgentAuthorized(webhookIdentifier: string, agentId: string): Promise<boolean> {
    const webhook = await this.getWebhookConfig(webhookIdentifier);
    if (!webhook) {
      return false;
    }

    return webhook.allowedAgents.includes(agentId);
  }

  /**
   * Validate webhook configuration structure
   * @param webhookId - The webhook identifier
   * @param webhook - Webhook configuration to validate
   * @throws Error if configuration is invalid
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Webhook config validation requires any type
  private validateWebhookConfig(webhookId: string, webhook: any): asserts webhook is WebhookConfig {
    if (!webhook || typeof webhook !== 'object') {
      throw new Error(`Webhook ${webhookId} configuration must be an object`);
    }

    if (!webhook.name || typeof webhook.name !== 'string') {
      throw new Error(`Webhook ${webhookId} must have a valid name`);
    }

    if (!webhook.description || typeof webhook.description !== 'string') {
      throw new Error(`Webhook ${webhookId} must have a valid description`);
    }

    if (!Array.isArray(webhook.allowedAgents) || webhook.allowedAgents.length === 0) {
      throw new Error(`Webhook ${webhookId} must have at least one authorized agent`);
    }

    // Validate agent identifiers
    for (const agentId of webhook.allowedAgents) {
      if (typeof agentId !== 'string' || agentId.trim().length === 0) {
        throw new Error(`Webhook ${webhookId} has invalid agent identifier: ${agentId}`);
      }
    }

    // Validate authentication if present
    if (webhook.auth) {
      const auth = webhook.auth;
      if (!auth.type || !['signature', 'bearer', 'jwt'].includes(auth.type)) {
        throw new Error(`Webhook ${webhookId} has invalid authentication type: ${auth.type}`);
      }

      if (auth.type === 'signature' && (!auth.secret || typeof auth.secret !== 'string')) {
        throw new Error(
          `Webhook ${webhookId} with signature authentication must have a valid secret`
        );
      }

      if (auth.type === 'bearer' && (!auth.token || typeof auth.token !== 'string')) {
        throw new Error(`Webhook ${webhookId} with bearer authentication must have a valid token`);
      }

      if (auth.type === 'jwt' && (!auth.config || typeof auth.config !== 'object')) {
        throw new Error(
          `Webhook ${webhookId} with JWT authentication must have a valid config object`
        );
      }
    }

    // Validate payload transformations if present
    if (webhook.payload_transform && !Array.isArray(webhook.payload_transform)) {
      throw new Error(`Webhook ${webhookId} payload_transform must be an array`);
    }

    // Validate allowed origins if present
    if (webhook.allowedOrigins && !Array.isArray(webhook.allowedOrigins)) {
      throw new Error(`Webhook ${webhookId} allowedOrigins must be an array`);
    }
  }
}

// Create singleton instance
const webhookRepository = new WebhookRepository();

export { WebhookRepository };
export default webhookRepository;
