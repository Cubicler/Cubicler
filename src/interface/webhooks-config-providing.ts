import { WebhookConfig, WebhooksConfig } from '../model/webhooks.js';

/**
 * Interface for webhook configuration providers
 * Allows different implementations for loading webhook configurations
 */
export interface WebhooksConfigProviding {
  /**
   * Get the webhooks configuration
   * @returns Promise resolving to the webhooks configuration
   */
  getWebhooksConfig(): Promise<WebhooksConfig>;

  /**
   * Get a specific webhook configuration by identifier
   * @param _identifier - The webhook identifier
   * @returns Promise resolving to the webhook config or null if not found
   */
  getWebhookConfig(_identifier: string): Promise<WebhookConfig | null>;

  /**
   * Check if an agent is authorized for a specific webhook
   * @param _webhookIdentifier - The webhook identifier
   * @param _agentId - The agent identifier
   * @returns Promise resolving to true if authorized
   */
  isAgentAuthorized(_webhookIdentifier: string, _agentId: string): Promise<boolean>;
}
