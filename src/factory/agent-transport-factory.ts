import type { Agent, DirectAgent, HttpAgent, StdioAgent } from '../model/agents.js';
import type { AgentTransport } from '../interface/agent-transport.js';
import type { MCPHandling } from '../interface/mcp-handling.js';
import { HttpAgentTransport } from '../transport/http-agent-transport.js';
import { StdioAgentTransport } from '../transport/stdio-agent-transport.js';
import { DirectOpenAIAgentTransport } from '../transport/direct-openai-agent-transport.js';

/**
 * Factory for creating agent transport implementations
 * Creates appropriate transport based on agent configuration
 */
export class AgentTransportFactory {
  /**
   * Creates a new AgentTransportFactory instance
   * @param mcpService - MCP service for handling tools and servers
   */
  constructor(
    // eslint-disable-next-line no-unused-vars
    private readonly mcpService: MCPHandling
  ) {}

  /**
   * Create appropriate transport for the given agent
   * @param agent - Agent configuration containing transport type and configuration
   * @returns AgentTransport implementation for the specified transport type
   * @throws Error if transport type is unsupported
   */
  createTransport(agent: Agent): AgentTransport {
    switch (agent.transport) {
      case 'http': {
        const httpAgent = agent as HttpAgent;
        return new HttpAgentTransport(httpAgent.config.url);
      }
      case 'stdio': {
        const stdioAgent = agent as StdioAgent;
        return new StdioAgentTransport(stdioAgent.config.url);
      }
      case 'direct': {
        const directAgent = agent as DirectAgent;
        
        // Check provider and create appropriate direct transport
        switch (directAgent.config.provider) {
          case 'openai':
            return new DirectOpenAIAgentTransport(directAgent.config, this.mcpService);
          default:
            throw new Error(`Unsupported direct transport provider: ${directAgent.config.provider}. Supported providers: openai`);
        }
      }
      default:
        throw new Error(`Unsupported transport type: ${(agent as any).transport}`);
    }
  }
}
