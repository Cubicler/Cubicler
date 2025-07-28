import { config } from 'dotenv';
import type { Agent, AgentInfo, AgentsConfig } from '../model/agents.js';
import type { AgentsProviding } from '../interface/agents-providing.js';
import type { ServersProviding } from '../interface/servers-providing.js';
import { Cache, createEnvCache } from '../utils/cache.js';
import { loadConfigFromSource, validateAgentsConfig } from '../utils/config-helper.js';
import { loadPrompt } from '../utils/prompt-helper.js';

config();

/**
 * Agent Service for Cubicler
 * Handles agent configuration with base/default/agent-specific prompt composition
 */
export class AgentService implements AgentsProviding {
  // Cache for agents configuration
  private agentsCache: Cache<AgentsConfig> = createEnvCache('AGENTS', 600); // 10 minutes default

  constructor(private serversProvider: ServersProviding) {}

  /**
   * Compose prompt for a specific agent
   * Combines basePrompt + (defaultPrompt | agent-specific prompt)
   * Supports loading prompts from URLs or files
   *
   * Priority:
   * 1. If agent has specific prompt: basePrompt + agent.prompt
   * 2. If no agent-specific prompt: basePrompt + defaultPrompt
   * 3. If no basePrompt: use defaultPrompt or agent.prompt alone
   */
  async getAgentPrompt(agentIdentifier?: string): Promise<string> {
    const config = await this.loadAgents();

    let agent: Agent;
    if (agentIdentifier) {
      agent = await this.getAgent(agentIdentifier);
    } else {
      agent = await this.getDefaultAgent();
    }

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

    // Add technical section about available servers
    const technicalSection = await this.generateTechnicalSection();
    if (technicalSection) {
      promptParts.push(technicalSection);
    }

    // If no prompts are configured, return a minimal default
    if (promptParts.length === 0) {
      return 'You are a helpful AI assistant powered by Cubicler.';
    }

    return promptParts.join('\n\n');
  }

  /**
   * Get agent information for dispatch (without sensitive details)
   */
  async getAgentInfo(agentIdentifier?: string): Promise<AgentInfo> {
    const agent = agentIdentifier
      ? await this.getAgent(agentIdentifier)
      : await this.getDefaultAgent();

    return {
      identifier: agent.identifier,
      name: agent.name,
      description: agent.description,
    };
  }

  /**
   * Get all agents with basic information
   */
  async getAllAgents(): Promise<AgentInfo[]> {
    const config = await this.loadAgents();

    return config.agents.map((agent) => ({
      identifier: agent.identifier,
      name: agent.name,
      description: agent.description,
    }));
  }

  /**
   * Check if an agent exists
   */
  async hasAgent(agentIdentifier: string): Promise<boolean> {
    try {
      await this.getAgent(agentIdentifier);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get agent URL for communication
   */
  async getAgentUrl(agentIdentifier?: string): Promise<string> {
    const agent = agentIdentifier
      ? await this.getAgent(agentIdentifier)
      : await this.getDefaultAgent();
    return agent.url;
  }

  /**
   * Clear the agents cache
   */
  clearCache(): void {
    this.agentsCache.clear();
  }

  /**
   * Generate technical section about available servers and how to access their tools
   */
  private async generateTechnicalSection(): Promise<string> {
    try {
      const serversResponse = await this.serversProvider.getAvailableServers();
      
      if (serversResponse.total === 0) {
        return '';
      }

      const sections: string[] = [
        '## Available Services',
        '',
        'You have access to the following external services through Cubicler:',
        ''
      ];

      // Add information about each server
      serversResponse.servers.forEach((server) => {
        sections.push(`### ${server.name} (${server.identifier})`);
        sections.push(server.description);
        sections.push(`Available tools: ${server.toolsCount}`);
        sections.push('');
      });

      // Add instructions on how to discover and use tools
      sections.push('## How to Access Tools');
      sections.push('');
      sections.push('To discover what tools are available from any service, use:');
      sections.push('- `cubicler.available_servers` - Get list of all available servers');
      sections.push('- `cubicler.fetch_server_tools` - Get detailed tool information for a specific server');
      sections.push('');
      sections.push('Once you know the available tools, you can call them directly using the format:');
      sections.push('`{server_identifier}.{tool_name}` (e.g., `weather_service.get_current_weather`)');

      return sections.join('\n');
    } catch (error) {
      console.warn('⚠️ [AgentService] Failed to generate technical section:', error);
      return '';
    }
  }

  /**
   * Load agents configuration from source (file or URL)
   */
  private async loadAgents(): Promise<AgentsConfig> {
    const cached = this.agentsCache.get('config');
    if (cached) {
      return cached;
    }

    const config = await loadConfigFromSource<AgentsConfig>(
      'CUBICLER_AGENTS_LIST',
      'agents configuration'
    );

    // Validate configuration structure
    validateAgentsConfig(config);

    // Cache the result
    this.agentsCache.set('config', config);

    console.log(`✅ [AgentService] Loaded ${config.agents.length} agents`);

    return config;
  }

  /**
   * Get a specific agent by identifier
   */
  private async getAgent(agentIdentifier: string): Promise<Agent> {
    const config = await this.loadAgents();
    const agent = config.agents.find((a) => a.identifier === agentIdentifier);

    if (!agent) {
      throw new Error(`Agent not found: ${agentIdentifier}`);
    }

    return agent;
  }

  /**
   * Get the first available agent (default agent)
   */
  private async getDefaultAgent(): Promise<Agent> {
    const config = await this.loadAgents();

    if (config.agents.length === 0) {
      throw new Error('No agents available');
    }

    const firstAgent = config.agents[0];
    if (!firstAgent) {
      throw new Error('No agents available');
    }

    return firstAgent;
  }
}

// Export singleton instance with provider service injected
import providerService from './provider-service.js';
export default new AgentService(providerService);
