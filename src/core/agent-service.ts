import { config } from 'dotenv';
import type { Agent, AgentInfo, AgentsConfig } from '../model/agents.js';
import type { AgentsProviding } from '../interface/agents-providing.js';
import type { ServersProviding } from '../interface/servers-providing.js';
import type { AgentsConfigProviding } from '../interface/agents-config-providing.js';
import type { AvailableServersResponse, ServerInfo } from '../model/server.js';
import { loadPrompt } from '../utils/prompt-helper.js';
import { filterAllowedServers } from '../utils/restriction-helper.js';

config();

/**
 * Agent Service for Cubicler
 * Handles agent configuration with base/default/agent-specific prompt composition
 */
export class AgentService implements AgentsProviding {
  /**
   * Creates a new AgentService instance
   * @param serversProvider - Provider service for accessing server information
   * @param agentsConfigProvider - Repository for accessing agents configuration
   */
  constructor(
    // eslint-disable-next-line no-unused-vars
    private readonly serversProvider: ServersProviding,
    // eslint-disable-next-line no-unused-vars
    private readonly agentsConfigProvider: AgentsConfigProviding
  ) {}

  /**
   * Compose prompt for a specific agent
   * Combines basePrompt + (defaultPrompt | agent-specific prompt)
   * Supports loading prompts from URLs or files
   *
   * Priority:
   * 1. If agent has specific prompt: basePrompt + agent.prompt
   * 2. If no agent-specific prompt: basePrompt + defaultPrompt
   * 3. If no basePrompt: use defaultPrompt or agent.prompt alone
   * @param agentIdentifier - Optional agent identifier. If not provided, uses default agent
   * @returns The composed prompt string for the agent
   */
  async getAgentPrompt(agentIdentifier?: string): Promise<string> {
    const config = await this.agentsConfigProvider.getAgentsConfig();
    const agent = await this.resolveAgent(agentIdentifier, config);

    const promptParts: string[] = [];

    // Add base prompt if available (can be URL or inline)
    if (config.basePrompt) {
      const basePrompt = await loadPrompt(config.basePrompt, 'base prompt');
      promptParts.push(basePrompt);
    }

    // Add agent-specific prompt or default prompt (can be URLs or inline)
    if (agent.prompt) {
      const agentPrompt = await loadPrompt(agent.prompt, `agent prompt for ${agent.identifier}`);
      promptParts.push(agentPrompt);
    } else if (config.defaultPrompt) {
      const defaultPrompt = await loadPrompt(config.defaultPrompt, 'default prompt');
      promptParts.push(defaultPrompt);
    }

    // If no prompts are configured, return a minimal default (without technical section)
    if (promptParts.length === 0) {
      return 'You are a helpful AI assistant powered by Cubicler.';
    }

    // Add technical section about available servers (only if prompts are configured)
    const technicalSection = await this.buildTechnicalSection(agent);
    if (technicalSection) {
      promptParts.push(technicalSection);
    }

    return promptParts.join('\n\n');
  }

  /**
   * Get agent information for dispatch (without sensitive details)
   * @param agentIdentifier - Optional agent identifier. If not provided, uses default agent
   * @returns Agent information object with identifier, name, and description
   */
  async getAgentInfo(agentIdentifier?: string): Promise<AgentInfo> {
    const config = await this.agentsConfigProvider.getAgentsConfig();
    const agent = await this.resolveAgent(agentIdentifier, config);

    return {
      identifier: agent.identifier,
      name: agent.name,
      description: agent.description,
    };
  }

  /**
   * Get all agents with basic information
   * @returns Array of agent information objects
   */
  async getAllAgents(): Promise<AgentInfo[]> {
    const config = await this.agentsConfigProvider.getAgentsConfig();

    return config.agents.map((agent: Agent) => ({
      identifier: agent.identifier,
      name: agent.name,
      description: agent.description,
    }));
  }

  /**
   * Check if an agent exists
   * @param agentIdentifier - The agent identifier to check
   * @returns true if the agent exists, false otherwise
   */
  async hasAgent(agentIdentifier: string): Promise<boolean> {
    const config = await this.agentsConfigProvider.getAgentsConfig();
    return config.agents.some((a) => a.identifier === agentIdentifier);
  }

  /**
   * Get agent URL for communication
   * @param agentIdentifier - Optional agent identifier. If not provided, uses default agent
   * @returns The URL endpoint for the agent
   * @throws Error if agent doesn't have a URL (e.g., direct transport)
   */
  async getAgentUrl(agentIdentifier?: string): Promise<string> {
    const config = await this.agentsConfigProvider.getAgentsConfig();
    const agent = await this.resolveAgent(agentIdentifier, config);

    switch (agent.transport) {
      case 'http':
        return (agent as any).config.url;
      case 'stdio':
        return (agent as any).config.url;
      case 'direct':
        throw new Error(`Direct transport agents don't have URLs. Use agent factory instead.`);
      default:
        throw new Error(`Unsupported transport type: ${(agent as any).transport}`);
    }
  }

  /**
   * Get full agent configuration
   * @param agentIdentifier - Optional agent identifier. If not provided, uses default agent
   * @returns The full agent configuration object
   */
  async getAgent(agentIdentifier?: string): Promise<Agent> {
    const config = await this.agentsConfigProvider.getAgentsConfig();
    return await this.resolveAgent(agentIdentifier, config);
  }

  /**
   * Generate technical section about available servers and how to access their tools
   * This is inlined as it's only used in getAgentPrompt()
   */
  private async buildTechnicalSection(agent?: Agent): Promise<string> {
    const baseSections = this.createBaseTechnicalSections();
    const serverSections = await this.createServerSpecificSections(agent);

    return [...baseSections, ...serverSections].join('\n');
  }

  /**
   * Create base technical instruction sections
   * @returns Array of base instruction sections
   */
  private createBaseTechnicalSections(): string[] {
    return [
      '## How You Operate as an AI Agent in Cubicler',
      '',
      "You're an AI agent running in **Cubicler**, a smart orchestration system. Cubicler connects you to external services (weather, databases, etc.) via **function calls** — **never** through direct API requests.",
      '',
      '### ✅ Capabilities',
      '',
      '**1. Discover Services**',
      '',
      'Call `cubicler_available_servers()` - Lists available services (with IDs, names, descriptions)',
      '',
      '**2. Discover Tools in a Service**',
      '',
      'Call `cubicler_fetch_server_tools({ "serverIdentifier": "service_id" })` - Lists tools/functions for a specific service',
      '',
      '**3. Execute External Tools**',
      '',
      'Call `abc123_get_weather({ "city": "Jakarta" })` - Use exactly the names and parameter structures returned by discovery',
      '',
      '### 🧠 Workflow',
      '',
      '1. Understand the request (e.g., weather, user data)',
      '2. Discover services if unsure: `cubicler_available_servers()`',
      '3. Fetch tools from the relevant service: `cubicler_fetch_server_tools({ "serverIdentifier": "weather_service" })`',
      '4. Call the tool with correct params: `abc123_get_current_weather({ "city": "Jakarta" })`',
      '5. Return a clean, helpful response to the user',
      '',
      '### ⚠️ Rules',
      '',
      '**✅ DO:**',
      '',
      '- Only use listed tools',
      '- Copy function names and parameters exactly',
      '- Keep responses clear and non-technical',
      '',
      "**❌ DON'T:**",
      '',
      '- Guess or make up tool names',
      '- Modify function names or params',
      '- Expose technical details to users',
      '- Assume a service exists without checking',
      '',
      this.createExampleSection(),
    ];
  }

  /**
   * Create example usage section
   * @returns Example section as string
   */
  private createExampleSection(): string {
    return [
      '### 💡 Example',
      '',
      'User asks: **"What\'s the weather in Jakarta?"**',
      '',
      'You:',
      '',
      '1. `cubicler_available_servers()`',
      '2. `cubicler_fetch_server_tools({ "serverIdentifier": "weather_service" })`',
      '3. `abc123_get_current_weather({ "city": "Jakarta" })`',
      '4. Respond: _"The weather in Jakarta is 28°C and partly cloudy."_',
      '',
      '**Goal:** Solve user problems by coordinating the right external tools via Cubicler with accuracy and clarity.',
    ].join('\n');
  }

  /**
   * Create server-specific sections based on available servers
   * @param agent - Optional agent to apply restrictions
   * @returns Array of server-specific sections
   */
  private async createServerSpecificSections(agent?: Agent): Promise<string[]> {
    try {
      const serversResponse = await this.serversProvider.getAvailableServers();

      if (serversResponse.total > 0) {
        // Apply agent restrictions if agent is provided
        const filteredServers = agent 
          ? filterAllowedServers(agent, serversResponse.servers)
          : serversResponse.servers;

        if (filteredServers.length > 0) {
          return this.createAvailableServersSection({
            ...serversResponse,
            servers: filteredServers,
            total: filteredServers.length
          });
        } else {
          return this.createNoServersSection();
        }
      } else {
        return this.createNoServersSection();
      }
    } catch (error) {
      console.warn('⚠️ [AgentService] Failed to fetch server information:', error);
      return [];
    }
  }

  /**
   * Create available servers section
   * @param serversResponse - Response containing available servers
   * @returns Array of section strings
   */
  private createAvailableServersSection(serversResponse: AvailableServersResponse): string[] {
    const sections = [
      '',
      '## Currently Available Servers',
      '',
      'Right now, you have access to these external servers:',
      '',
    ];

    serversResponse.servers.forEach((server: ServerInfo) => {
      sections.push(`**${server.name}** (\`${server.identifier}\`)`);
      sections.push(`- ${server.description}`);
      sections.push(`- Available tools: ${server.toolsCount}`);
      sections.push('');
    });

    sections.push(
      'Remember: Use `cubicler_fetch_server_tools({"serverIdentifier": "service_identifier"})` to see exactly what functions each service provides.'
    );

    return sections;
  }

  /**
   * Create no servers available section
   * @returns Array of section strings
   */
  private createNoServersSection(): string[] {
    return [
      '',
      '## No External Services Currently Available',
      '',
      "No external services are currently configured. You can still help users with questions that don't require external data.",
    ];
  }

  /**
   * Resolve agent by identifier or return default agent
   * Consolidates the common pattern used across multiple methods
   * @param agentIdentifier - Optional agent identifier
   * @param config - Agents configuration (passed to avoid multiple fetches)
   * @returns The resolved agent
   */
  private async resolveAgent(
    agentIdentifier: string | undefined,
    config: AgentsConfig
  ): Promise<Agent> {
    if (agentIdentifier) {
      const agent = config.agents.find((a: Agent) => a.identifier === agentIdentifier);
      if (!agent) {
        throw new Error(`Agent not found: ${agentIdentifier}`);
      }
      return agent;
    }

    // Return default agent (first available)
    if (config.agents.length === 0) {
      throw new Error('No agents available');
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Safe: we just checked length > 0
    return config.agents[0]!;
  }
}

// Export singleton instance with provider service and agent repository injected
import providerService from './provider-service.js';
import agentRepository from '../repository/agent-repository.js';

// Export default instance for backward compatibility
export default new AgentService(providerService, agentRepository);
