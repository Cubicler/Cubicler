import type { AgentsConfig } from '../model/agents.js';

/**
 * Interface for providing agents configuration
 */
export interface AgentsConfigProviding {
  /**
   * Load agents configuration from source (file or URL)
   */
  getAgentsConfig(): Promise<AgentsConfig>;
}
