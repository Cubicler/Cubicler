import type { AgentConfig } from '../model/agents.js';
import type { AgentTransport } from '../interface/agent-transport.js';
import type { MCPHandling } from '../interface/mcp-handling.js';
import type { ServersProviding } from '../interface/servers-providing.js';
import { HttpAgentTransport } from '../transport/agent/http-agent-transport.js';
import { SseAgentTransport } from '../transport/agent/sse-agent-transport.js';
import { DirectOpenAIAgentTransport } from '../transport/agent/direct-openai-agent-transport.js';
import { StdioAgentPools } from '../transport/agent/stdio-agent-pools.js';

/**
 * Factory for creating agent transport implementations
 * Creates appropriate transport based on agent configuration
 */
export class AgentTransportFactory {
  /**
   * Creates a new AgentTransportFactory instance
   * @param mcpService - MCP service for handling tools and servers
   * @param serversProvider - Server provider for resolving server identifiers from hashes
   */
  constructor(
    // eslint-disable-next-line no-unused-vars
    private readonly mcpService: MCPHandling,
    // eslint-disable-next-line no-unused-vars
    private readonly serversProvider: ServersProviding
  ) {}

  /**
   * Create appropriate transport for the given agent
   * @param agentId - Agent identifier
   * @param agent - Agent configuration containing transport type and configuration
   * @returns AgentTransport implementation for the specified transport type
   * @throws Error if transport type is unsupported
   */
  createTransport(agentId: string, agent: AgentConfig): AgentTransport {
    switch (agent.transport) {
      case 'http': {
        if (!('url' in agent)) {
          throw new Error(`HTTP agent ${agentId} requires 'url' property`);
        }
        return new HttpAgentTransport(agent);
      }
      case 'sse': {
        if (!('url' in agent)) {
          throw new Error(`SSE agent ${agentId} requires 'url' property`);
        }
        return new SseAgentTransport(agent, agentId);
      }
      case 'stdio': {
        if (!('command' in agent)) {
          throw new Error(`Stdio agent ${agentId} requires 'command' property`);
        }
        // Always use StdioAgentPools for stdio agents - provides pooling when enabled,
        // single transport when disabled, and ensures single in-flight dispatch enforcement
        return new StdioAgentPools(agent, this.mcpService);
      }
      case 'direct': {
        if (!('provider' in agent)) {
          throw new Error(`Direct agent ${agentId} requires 'provider' property`);
        }

        // Check provider and create appropriate direct transport
        switch (agent.provider) {
          case 'openai':
            return new DirectOpenAIAgentTransport(
              agent,
              this.mcpService,
              { identifier: agentId, ...agent },
              this.serversProvider
            );
          default:
            throw new Error(
              `Unsupported direct transport provider: ${agent.provider}. Supported providers: openai`
            );
        }
      }
      default:
        throw new Error(`Unsupported transport type: ${(agent as AgentConfig).transport}`);
    }
  }
}
