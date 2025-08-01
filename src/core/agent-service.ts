import { config } from 'dotenv';
import type { Agent, AgentInfo, AgentsConfig } from '../model/agents.js';
import type { AgentsProviding } from '../interface/agents-providing.js';
import type { ServersProviding } from '../interface/servers-providing.js';
import type { AgentsConfigProviding } from '../interface/agents-config-providing.js';
import { loadPrompt } from '../utils/prompt-helper.js';

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
    private serversProvider: ServersProviding,
    private agentsConfigProvider: AgentsConfigProviding
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
    const config = await this.agentsConfigProvider.getAgentsConfig();;

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
   * @param agentIdentifier - Optional agent identifier. If not provided, uses default agent
   * @returns Agent information object with identifier, name, and description
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
   * @returns Array of agent information objects
   */
  async getAllAgents(): Promise<AgentInfo[]> {
    const config = await this.agentsConfigProvider.getAgentsConfig();;

    return config.agents.map((agent) => ({
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
    try {
      await this.getAgent(agentIdentifier);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get agent URL for communication
   * @param agentIdentifier - Optional agent identifier. If not provided, uses default agent
   * @returns The URL endpoint for the agent
   */
  async getAgentUrl(agentIdentifier?: string): Promise<string> {
    const agent = agentIdentifier
      ? await this.getAgent(agentIdentifier)
      : await this.getDefaultAgent();
    return agent.url;
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
      sections.push('- `cubicler_available_servers` - Get list of all available servers');
      sections.push('- `cubicler_fetch_server_tools` - Get detailed tool information for a specific server');
      sections.push('');
      sections.push('Once you know the available tools, you can call them directly using the format:');
      sections.push('`s{index}_{function_name}` (e.g., `s0_get_current_weather`)');

      return sections.join('\n');
    } catch (error) {
      console.warn('⚠️ [AgentService] Failed to generate technical section:', error);
      return '';
    }
  }

  /**
   * Get a specific agent by identifier
   */
  private async getAgent(agentIdentifier: string): Promise<Agent> {
    const config = await this.agentsConfigProvider.getAgentsConfig();;
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
    const config = await this.agentsConfigProvider.getAgentsConfig();;

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

// Export singleton instance with provider service and agent repository injected
import providerService from './provider-service.js';
import agentRepository from '../repository/agent-repository.js';

// Export default instance for backward compatibility
export default new AgentService(providerService, agentRepository);
