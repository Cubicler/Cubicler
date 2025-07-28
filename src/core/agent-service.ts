import { config } from 'dotenv';
import type { AgentsConfig, Agent, AgentInfo } from '../model/agents.js';
import type { AgentsProviding } from "../interface/agents-providing.js";
import { Cache, createEnvCache } from '../utils/cache.js';
import { loadConfigFromSource, validateAgentsConfig } from '../utils/config-helper.js';

config();

/**
 * Agent Service for Cubicler
 * Handles agent configuration with base/default/agent-specific prompt composition
 */
class AgentService implements AgentsProviding {
  // Cache for agents configuration
  private agentsCache: Cache<AgentsConfig> = createEnvCache('AGENTS', 600); // 10 minutes default

  /**
   * Compose prompt for a specific agent
   * Combines basePrompt + (defaultPrompt | agent-specific prompt)
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

    // Add base prompt if available
    if (config.basePrompt) {
      promptParts.push(config.basePrompt.trim());
    }

    // Add agent-specific prompt or default prompt
    if (agent.prompt) {
      promptParts.push(agent.prompt.trim());
    } else if (config.defaultPrompt) {
      promptParts.push(config.defaultPrompt.trim());
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
    const agent = agentIdentifier ? await this.getAgent(agentIdentifier) : await this.getDefaultAgent();
    
    return {
      identifier: agent.identifier,
      name: agent.name,
      description: agent.description
    };
  }

  /**
   * Get all agents with basic information
   */
  async getAllAgents(): Promise<AgentInfo[]> {
    const config = await this.loadAgents();
    
    return config.agents.map(agent => ({
      identifier: agent.identifier,
      name: agent.name,
      description: agent.description
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
    const agent = agentIdentifier ? await this.getAgent(agentIdentifier) : await this.getDefaultAgent();
    return agent.url;
  }

  /**
   * Clear the agents cache
   */
  clearCache(): void {
    this.agentsCache.clear();
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
    const agent = config.agents.find(a => a.identifier === agentIdentifier);
    
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

    return config.agents[0]!;
  }
}

// Export singleton instance
export default new AgentService();
