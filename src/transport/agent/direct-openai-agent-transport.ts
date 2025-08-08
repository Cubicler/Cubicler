import type { AgentRequest, AgentResponse } from '../../model/dispatch.js';
import type { DirectOpenAIAgentConfig } from '../../model/agents.js';
import type { MCPHandling } from '../../interface/mcp-handling.js';
import type { ServersProviding } from '../../interface/servers-providing.js';
import { createOpenAIServiceBasic } from '@cubicler/cubicagent-openai';
import type {
  DispatchConfig,
  OpenAIConfig,
} from '@cubicler/cubicagent-openai/dist/config/environment.js';
import { DirectAgentTransport } from './direct-agent-transport.js';
import { expandEnvVariable } from '../../utils/env-helper.js';

/**
 * Direct transport for OpenAI agents
 * Handles OpenAI-specific config validation and dispatch logic
 */
export class DirectOpenAIAgentTransport extends DirectAgentTransport {
  constructor(
    config: DirectOpenAIAgentConfig,
    mcpService: MCPHandling,
    agent: DirectOpenAIAgentConfig & { identifier: string },
    serversProvider: ServersProviding
  ) {
    super(config, mcpService, agent, serversProvider);
    this.validateConfig(config);
  }

  /**
   * Dispatch request to OpenAI agent
   */
  async dispatch(agentRequest: AgentRequest): Promise<AgentResponse> {
    console.log(`🤖 [DirectOpenAIAgentTransport] Creating OpenAI agent for dispatch`);

    const openaiConfig = this.config as DirectOpenAIAgentConfig;

    // Build OpenAI config from our DirectOpenAIConfig
    const openaiServiceConfig: OpenAIConfig = {
      apiKey: expandEnvVariable(openaiConfig.apiKey),
      model: openaiConfig.model || 'gpt-4o',
      summarizerModel: openaiConfig.summarizerModel,
      temperature: openaiConfig.temperature ?? 0.7,
      sessionMaxTokens: openaiConfig.sessionMaxTokens ?? 4000,
      organization: openaiConfig.organization,
      project: openaiConfig.project,
      baseURL: openaiConfig.baseURL,
      timeout: openaiConfig.timeout ?? 30000,
      maxRetries: openaiConfig.maxRetries ?? 3,
    };

    // Build dispatch config with defaults
    const dispatchConfig: DispatchConfig = {
      timeout: 90000,
      mcpMaxRetries: 3,
      mcpCallTimeout: 30000,
      sessionMaxIteration: 10,
      endpoint: '/mcp',
      agentPort: 3000,
    };

    // Create OpenAI service instance via factory (2.4+ API)
    const openaiService = createOpenAIServiceBasic(
      this, // AgentClient implementation (DirectAgentTransport)
      this, // AgentServer implementation (DirectAgentTransport)
      openaiServiceConfig,
      dispatchConfig
    );

    try {
      // Start the OpenAI service first (required in 2.4.0+)
      await openaiService.start();

      // Transform AgentRequest to match CubicAgentKit expectations
      const transformedRequest = this.transformAgentRequest(agentRequest);

      // Dispatch the request to the OpenAI service
      const response = await openaiService.dispatch(transformedRequest);
      console.log(`✅ [DirectOpenAIAgentTransport] OpenAI dispatch completed`);
      return response;
    } catch (error) {
      console.error(`❌ [DirectOpenAIAgentTransport] OpenAI dispatch failed:`, error);
      throw error;
    }
  }

  /**
   * Transform local AgentRequest to CubicAgentKit-compatible format
   * Converts unsupported message types (image, url) to text descriptions
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- CubicAgentKit types not compatible with local types
  private transformAgentRequest(agentRequest: AgentRequest): any {
    return {
      ...agentRequest,
      messages:
        agentRequest.messages?.map((message) => {
          // Convert unsupported message types to CubicAgentKit-compatible format
          if (message.type === 'image') {
            return {
              ...message,
              type: 'text' as const,
              content: `[Image content]: ${message.content || 'Image data provided'}${
                message.metadata?.fileName ? ` (${message.metadata.fileName})` : ''
              }`,
            };
          }

          if (message.type === 'url') {
            return {
              ...message,
              type: 'text' as const,
              content: `[URL reference]: ${message.content || 'URL provided'}`,
            };
          }

          // text and null types are already compatible
          return message;
        }) || [],
    };
  }

  /**
   * Validate OpenAI direct transport configuration
   */
  private validateConfig(config: DirectOpenAIAgentConfig): void {
    if (!config.provider || config.provider !== 'openai') {
      throw new Error('DirectOpenAIAgentTransport requires provider to be "openai"');
    }
    if (!config.apiKey || typeof config.apiKey !== 'string') {
      throw new Error('OpenAI direct transport requires a valid apiKey');
    }
    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
      throw new Error('OpenAI temperature must be between 0 and 2');
    }
    if (config.sessionMaxTokens !== undefined && config.sessionMaxTokens < 1) {
      throw new Error('OpenAI sessionMaxTokens must be greater than 0');
    }
  }
}
