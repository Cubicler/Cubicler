import { AgentInfo } from "../model/agents";

/**
 * Interface for services that provide agents list and agent functionality
 * Used for dependency injection to allow better testing and modularity
 */

export interface AgentsProviding {
    /**
     * Get all agents with basic information
     */
    getAllAgents(): Promise<AgentInfo[]>;

    /**
     * Check if an agent exists by identifier
     */
    hasAgent(agentIdentifier: string): Promise<boolean>;

    /**
     * Get agent information for dispatch (without sensitive details)
     */
    getAgentInfo(agentIdentifier?: string): Promise<AgentInfo>;

    /**
     * Get agent URL for communication
     */
    getAgentUrl(agentIdentifier?: string): Promise<string>;

    /**
     * Compose prompt for a specific agent
     */
    getAgentPrompt(agentIdentifier?: string): Promise<string>;
}
