import { ProviderJwtAuthConfig, ResponseTransform } from './providers.js';
import type { JSONValue } from './types.js';

/**
 * Webhook authentication configuration
 */
export interface WebhookAuthConfig {
  type: 'signature' | 'bearer' | 'jwt';
  secret?: string; // For signature validation
  token?: string; // For bearer token authentication
  config?: ProviderJwtAuthConfig; // For JWT authentication
}

/**
 * Individual webhook configuration (native format)
 */
export interface WebhookConfig {
  name: string;
  description: string;
  auth?: WebhookAuthConfig;
  allowedOrigins?: string[];
  allowedAgents: string[]; // Array of agent identifiers that can receive this webhook
  payload_transform?: ResponseTransform[]; // Array of transformations to apply to payload
}

/**
 * Webhooks collection (native format - keyed by identifier)
 */
export type WebhooksCollection = Record<string, WebhookConfig>;

/**
 * Webhooks configuration file structure (native format)
 */
export type WebhooksConfig = WebhooksCollection;

/**
 * Webhook request data (raw incoming webhook)
 */
export interface WebhookRequest {
  identifier: string;
  agentId: string;
  payload: JSONValue; // Raw webhook payload as JSON
  headers: Record<string, string>;
  signature?: string; // For signature validation
}

/**
 * Processed webhook data after validation and transformation
 */
export interface ProcessedWebhook {
  webhookId: string;
  webhook: WebhookConfig;
  transformedPayload: JSONValue; // Transformed payload as JSON
  triggeredAt: string;
}

/**
 * @deprecated Legacy webhook configuration for backward compatibility
 * Use WebhookConfig with webhookId separately instead
 */
export interface LegacyWebhookConfig {
  identifier: string;
  name: string;
  description: string;
  config: {
    authentication?: WebhookAuthConfig;
    allowedOrigins?: string[];
  };
  agents: string[];
  payload_transform?: ResponseTransform[];
}
