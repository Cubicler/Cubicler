import { AgentConfig, AgentInfo } from '../model/agents.js';

/**
 * Interface for providing agent configuration and information
 */
export interface AgentsProviding {
  /**
   * Get agent prompt by identifier
   */
  getAgentPrompt(_agentIdentifier?: string): Promise<string>;

  /**
   * Get agent information for dispatch
   */
  getAgentInfo(_agentIdentifier?: string): Promise<AgentInfo>;

  /**
   * Get agent URL for communication
   */
  getAgentUrl(_agentIdentifier?: string): Promise<string>;

  /**
   * Get full agent configuration
   */
  getAgent(_agentIdentifier?: string): Promise<AgentConfig>;

  /**
   * Check if an agent exists
   */
  hasAgent(_agentIdentifier: string): Promise<boolean>;

  /**
   * Get all agents with basic information
   */
  getAllAgents(): Promise<AgentInfo[]>;
}
