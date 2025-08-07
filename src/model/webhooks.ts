import { ResponseTransform } from './providers.js';
import type { JSONValue } from './types.js';

/**
 * Webhook authentication configuration
 */
export interface WebhookAuthConfig {
  type: 'signature' | 'bearer';
  secret?: string; // For signature validation
  token?: string; // For bearer token authentication
}

/**
 * Webhook configuration from webhooks.json
 */
export interface WebhookConfig {
  identifier: string; // lowercase, no spaces, only - or _
  name: string;
  description: string;
  config: {
    authentication?: WebhookAuthConfig;
    allowedOrigins?: string[];
  };
  agents: string[]; // Array of agent identifiers that can receive this webhook
  payload_transform?: ResponseTransform[]; // Array of transformations to apply to payload
}

/**
 * Webhooks configuration file structure
 */
export interface WebhooksConfig {
  webhooks: WebhookConfig[];
}

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
  webhook: WebhookConfig;
  transformedPayload: JSONValue; // Transformed payload as JSON
  triggeredAt: string;
}
