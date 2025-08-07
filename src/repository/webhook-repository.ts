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
      const emptyConfig: WebhooksConfig = { webhooks: [] };
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

      if (!Array.isArray(data.webhooks)) {
        throw new Error('Invalid webhook configuration: missing or invalid webhooks array');
      }

      // Validate individual webhook configurations
      for (const webhook of data.webhooks) {
        this.validateWebhookConfig(webhook);
      }

      console.log(`✅ [WebhookRepository] Loaded ${data.webhooks.length} webhook configurations`);

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
    return config.webhooks.find((webhook) => webhook.identifier === identifier) || null;
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

    return webhook.agents.includes(agentId);
  }

  /**
   * Validate webhook configuration structure
   * @param webhook - Webhook configuration to validate
   * @throws Error if configuration is invalid
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Webhook config validation requires any type
  private validateWebhookConfig(webhook: any): asserts webhook is WebhookConfig {
    if (!webhook || typeof webhook !== 'object') {
      throw new Error('Webhook configuration must be an object');
    }

    if (!webhook.identifier || typeof webhook.identifier !== 'string') {
      throw new Error('Webhook must have a valid identifier');
    }

    if (!webhook.name || typeof webhook.name !== 'string') {
      throw new Error(`Webhook ${webhook.identifier} must have a valid name`);
    }

    if (!webhook.description || typeof webhook.description !== 'string') {
      throw new Error(`Webhook ${webhook.identifier} must have a valid description`);
    }

    if (!Array.isArray(webhook.agents) || webhook.agents.length === 0) {
      throw new Error(`Webhook ${webhook.identifier} must have at least one authorized agent`);
    }

    // Validate agent identifiers
    for (const agentId of webhook.agents) {
      if (typeof agentId !== 'string' || agentId.trim().length === 0) {
        throw new Error(`Webhook ${webhook.identifier} has invalid agent identifier: ${agentId}`);
      }
    }

    // Validate configuration object
    if (!webhook.config || typeof webhook.config !== 'object') {
      throw new Error(`Webhook ${webhook.identifier} must have a valid config object`);
    }

    // Validate authentication if present
    if (webhook.config.authentication) {
      const auth = webhook.config.authentication;
      if (!auth.type || !['signature', 'bearer'].includes(auth.type)) {
        throw new Error(
          `Webhook ${webhook.identifier} has invalid authentication type: ${auth.type}`
        );
      }

      if (auth.type === 'signature' && (!auth.secret || typeof auth.secret !== 'string')) {
        throw new Error(
          `Webhook ${webhook.identifier} with signature authentication must have a valid secret`
        );
      }

      if (auth.type === 'bearer' && (!auth.token || typeof auth.token !== 'string')) {
        throw new Error(
          `Webhook ${webhook.identifier} with bearer authentication must have a valid token`
        );
      }
    }

    // Validate payload transformations if present
    if (webhook.payload_transform && !Array.isArray(webhook.payload_transform)) {
      throw new Error(`Webhook ${webhook.identifier} payload_transform must be an array`);
    }
  }
}

// Create singleton instance
const webhookRepository = new WebhookRepository();

export { WebhookRepository };
export default webhookRepository;
