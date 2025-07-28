import { AgentInfo } from '../model/agents';

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
   * Check if an agent exists
   */
  hasAgent(_agentIdentifier: string): Promise<boolean>;

  /**
   * Get all agents with basic information
   */
  getAllAgents(): Promise<AgentInfo[]>;
}
