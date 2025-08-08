import crypto from 'crypto';
import { WebhooksConfigProviding } from '../interface/webhooks-config-providing.js';
import { DispatchHandling } from '../interface/dispatch-handling.js';
import { AgentsProviding } from '../interface/agents-providing.js';
import { MCPHandling } from '../interface/mcp-handling.js';
import { ServersProviding } from '../interface/servers-providing.js';
import { ProcessedWebhook, WebhookConfig, WebhookRequest } from '../model/webhooks.js';
import { DispatchResponse, WebhookTrigger } from '../model/dispatch.js';
import { transformResponse } from '../utils/response-transformer.js';
import { filterAllowedServers, filterAllowedTools } from '../utils/restriction-helper.js';
import jwtHelper from '../utils/jwt-helper.js';
import type { AvailableServersResponse } from '../model/server.js';
import type { JSONValue } from '../model/types.js';
import type { ToolDefinition } from '../model/tools.js';
import { withInvocationContext } from '../utils/prompt-context.js';

/**
 * Webhook Service for Cubicler
 * Handles webhook validation, authentication, payload transformation, and dispatching to agents
 * Uses dependency injection for configuration provider and dispatch service
 */
class WebhookService {
  private configProvider: WebhooksConfigProviding;
  private dispatchService: DispatchHandling;
  private agentProvider: AgentsProviding;
  private mcpService: MCPHandling;
  private serversProvider: ServersProviding;

  /**
   * Creates a new WebhookService instance
   * @param configProvider - Webhook configuration provider
   * @param dispatchService - Service for dispatching messages to agents
   * @param agentProvider - Service for agent operations
   * @param mcpService - Service for MCP operations (tools and servers)
   * @param serversProvider - Service for server operations
   */
  constructor(
    configProvider: WebhooksConfigProviding,
    dispatchService: DispatchHandling,
    agentProvider: AgentsProviding,
    mcpService: MCPHandling,
    serversProvider: ServersProviding
  ) {
    this.configProvider = configProvider;
    this.dispatchService = dispatchService;
    this.agentProvider = agentProvider;
    this.mcpService = mcpService;
    this.serversProvider = serversProvider;
  }

  /**
   * Process a webhook and dispatch it to the specified agent
   * This method handles the complete webhook-to-agent flow:
   * 1. Validates and processes the webhook
   * 2. Gathers agent info, tools, and servers
   * 3. Dispatches to the agent
   * @param webhookRequest - The webhook request data
   * @returns Promise resolving to the agent's response
   * @throws Error if validation or processing fails
   */
  async processAndDispatchWebhook(webhookRequest: WebhookRequest): Promise<DispatchResponse> {
    console.log(
      `🪝 [WebhookService] Processing and dispatching webhook: ${webhookRequest.identifier} for agent ${webhookRequest.agentId}`
    );

    // Step 1: Process webhook (validation, authentication, transformation)
    const processedWebhook = await this.processWebhook(webhookRequest);
    const trigger = this.createTriggerContext(processedWebhook);

    // Step 2: Get agent info and prompt
    const [agentInfo, agent, prompt] = await Promise.all([
      this.agentProvider.getAgentInfo(webhookRequest.agentId),
      this.agentProvider.getAgent(webhookRequest.agentId),
      this.agentProvider.getAgentPrompt(webhookRequest.agentId),
    ]);

    // Step 3: Get tools and servers via MCP service
    const [serversInfo, allTools] = await Promise.all([
      this.mcpService
        .handleMCPRequest({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: { name: 'cubicler_available_servers', arguments: {} },
        })
        .then((response) => {
          if (response.error) {
            throw new Error(`MCP Error: ${response.error.message}`);
          }
          const result = response.result as AvailableServersResponse;
          return result.servers || [];
        }),
      this.mcpService
        .handleMCPRequest({
          jsonrpc: '2.0',
          id: Date.now() + 1,
          method: 'tools/list',
          params: {},
        })
        .then((response) => {
          if (response.error) {
            throw new Error(`MCP Error: ${response.error.message}`);
          }
          const result = response.result as { tools: ToolDefinition[] };
          return result.tools || [];
        }),
    ]);

    // Step 4: Apply agent restrictions
    const filteredServers = filterAllowedServers(agent, serversInfo);
    const filteredTools = await filterAllowedTools(agent, allTools, this.serversProvider);

    // Step 5: Create agent request with webhook trigger
    const agentRequest = {
      agent: {
        identifier: agentInfo.identifier,
        name: agentInfo.name,
        description: agentInfo.description,
        prompt: withInvocationContext(prompt, {
          type: 'webhook',
          webhook: {
            identifier: trigger.identifier,
            name: trigger.name,
            triggeredAt: trigger.triggeredAt,
          },
        }),
      },
      tools: filteredTools,
      servers: filteredServers,
      trigger,
    };

    // Step 6: Dispatch to agent
    console.log(`🚀 [WebhookService] Dispatching webhook to agent ${agentInfo.name}`);
    const response = await this.dispatchService.dispatchWebhook(
      webhookRequest.agentId,
      agentRequest
    );

    console.log(
      `✅ [WebhookService] Successfully processed and dispatched webhook: ${webhookRequest.identifier}`
    );
    return response;
  }

  /**
   * Process an incoming webhook request
   * @param webhookRequest - The webhook request data
   * @returns Promise resolving to processed webhook data
   * @throws Error if validation fails
   */
  async processWebhook(webhookRequest: WebhookRequest): Promise<ProcessedWebhook> {
    console.log(
      `📨 [WebhookService] Processing webhook: ${webhookRequest.identifier} for agent ${webhookRequest.agentId}`
    );

    // Get webhook configuration
    const webhook = await this.configProvider.getWebhookConfig(webhookRequest.identifier);
    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookRequest.identifier}`);
    }

    // Validate agent authorization
    const isAuthorized = await this.configProvider.isAgentAuthorized(
      webhookRequest.identifier,
      webhookRequest.agentId
    );
    if (!isAuthorized) {
      throw new Error(
        `Agent ${webhookRequest.agentId} is not authorized for webhook ${webhookRequest.identifier}`
      );
    }

    // Validate authentication
    await this.validateAuthentication(webhook, webhookRequest);

    // Transform payload
    const transformedPayload = this.transformPayload(webhook, webhookRequest.payload);

    const processedWebhook: ProcessedWebhook = {
      webhookId: webhookRequest.identifier,
      webhook,
      transformedPayload,
      triggeredAt: new Date().toISOString(),
    };

    console.log(`✅ [WebhookService] Successfully processed webhook: ${webhookRequest.identifier}`);

    return processedWebhook;
  }

  /**
   * Create a webhook trigger context for agent requests
   * @param processedWebhook - The processed webhook data
   * @returns Webhook trigger context
   */
  createTriggerContext(processedWebhook: ProcessedWebhook): WebhookTrigger {
    return {
      type: 'webhook',
      identifier: processedWebhook.webhookId,
      name: processedWebhook.webhook.name,
      description: processedWebhook.webhook.description,
      triggeredAt: processedWebhook.triggeredAt,
      payload: processedWebhook.transformedPayload,
    };
  }

  /**
   * Validate webhook authentication
   * @param webhook - Webhook configuration
   * @param webhookRequest - The webhook request data
   * @throws Error if authentication fails
   */
  private async validateAuthentication(
    webhook: WebhookConfig,
    webhookRequest: WebhookRequest
  ): Promise<void> {
    if (!webhook.auth) {
      // No authentication required
      return;
    }

    const auth = webhook.auth;

    switch (auth.type) {
      case 'signature':
        if (!auth.secret) {
          throw new Error('Signature authentication requires a secret');
        }
        await this.validateSignature(auth.secret, webhookRequest);
        break;

      case 'bearer':
        if (!auth.token) {
          throw new Error('Bearer authentication requires a token');
        }
        await this.validateBearerToken(auth.token, webhookRequest);
        break;

      case 'jwt':
        if (!auth.config) {
          throw new Error('JWT authentication requires config');
        }
        await this.validateJwtToken(auth.config, webhookRequest);
        break;

      default:
        throw new Error(`Unsupported authentication type: ${(auth as any).type}`); // eslint-disable-line @typescript-eslint/no-explicit-any
    }
  }

  /**
   * Validate webhook signature (GitHub-style HMAC-SHA256)
   * @param secret - The webhook secret
   * @param webhookRequest - The webhook request data
   * @throws Error if signature validation fails
   */
  private async validateSignature(secret: string, webhookRequest: WebhookRequest): Promise<void> {
    const signature = webhookRequest.headers['x-signature-256'] || webhookRequest.signature;

    if (!signature) {
      throw new Error('Missing webhook signature');
    }

    // Create HMAC signature from payload
    const payloadString = JSON.stringify(webhookRequest.payload);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadString, 'utf8')
      .digest('hex');

    // GitHub-style signature format: "sha256=<hash>"
    const expectedSignatureWithPrefix = `sha256=${expectedSignature}`;

    // Use constant-time comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignatureWithPrefix, 'utf8')
    );

    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    console.log(
      `🔐 [WebhookService] Signature validation successful for webhook ${webhookRequest.identifier}`
    );
  }

  /**
   * Validate bearer token authentication
   * @param expectedToken - The expected bearer token
   * @param webhookRequest - The webhook request data
   * @throws Error if token validation fails
   */
  private async validateBearerToken(
    expectedToken: string,
    webhookRequest: WebhookRequest
  ): Promise<void> {
    const authHeader = webhookRequest.headers.authorization;

    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

    // Use constant-time comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(bearerToken, 'utf8'),
      Buffer.from(expectedToken, 'utf8')
    );

    if (!isValid) {
      throw new Error('Invalid bearer token');
    }

    console.log(
      `🔐 [WebhookService] Bearer token validation successful for webhook ${webhookRequest.identifier}`
    );
  }

  /**
   * Validate JWT token authentication
   * @param jwtConfig - JWT authentication configuration
   * @param webhookRequest - The webhook request data
   * @throws Error if JWT validation fails
   */
  private async validateJwtToken(
    jwtConfig: import('../model/providers.js').ProviderJwtAuthConfig,
    webhookRequest: WebhookRequest
  ): Promise<void> {
    const authHeader = webhookRequest.headers.authorization;

    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

    try {
      // Get valid token from JWT helper (handles static tokens and OAuth2 refresh)
      const validToken = await jwtHelper.getToken(jwtConfig);

      // For webhooks with JWT, we expect the incoming token to match our valid token
      // Use constant-time comparison to prevent timing attacks
      const isValid = crypto.timingSafeEqual(
        Buffer.from(token, 'utf8'),
        Buffer.from(validToken, 'utf8')
      );

      if (!isValid) {
        throw new Error('Invalid JWT token');
      }

      console.log(
        `🔐 [WebhookService] JWT validation successful for webhook ${webhookRequest.identifier}`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown JWT validation error';
      throw new Error(`JWT validation failed: ${errorMessage}`);
    }
  }

  /**
   * Transform webhook payload using configured transformations
   * @param webhook - Webhook configuration
   * @param payload - Raw payload to transform
   * @returns Transformed payload
   */
  private transformPayload(webhook: WebhookConfig, payload: JSONValue): JSONValue {
    if (!webhook.payload_transform || webhook.payload_transform.length === 0) {
      return payload;
    }

    console.log(
      `🔄 [WebhookService] Applying ${webhook.payload_transform.length} transformations to webhook payload`
    );

    const transformedPayload = transformResponse(payload, webhook.payload_transform);

    console.log(`✅ [WebhookService] Payload transformation completed`);

    return transformedPayload;
  }
}

import webhookRepository from '../repository/webhook-repository.js';
import dispatchService from './dispatch-service.js';
import agentService from './agent-service.js';
import mcpService from './mcp-service.js';
import providerService from './provider-service.js';

// Create the webhook service instance with all required dependencies
const webhookService = new WebhookService(
  webhookRepository,
  dispatchService,
  agentService,
  mcpService,
  providerService
);

export { WebhookService };
export default webhookService;
