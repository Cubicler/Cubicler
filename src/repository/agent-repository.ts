import { config } from 'dotenv';
import type { AgentsConfig } from '../model/agents.js';
import { Cache, createEnvCache } from '../utils/cache.js';
import { AgentsConfigProviding } from '../interface/agents-config-providing.js';
import { loadConfigFromSource, validateAgentsConfig } from '../utils/config-helper.js';

config();

/**
 * Agents repository for loading and caching agents configuration
 * Used by all services to access the agents configuration
 */
class AgentRepository implements AgentsConfigProviding {
  // Cache for agents configuration
  private readonly agentsCache: Cache<AgentsConfig> = createEnvCache('AGENTS', 600); // 10 minutes default

  /**
   * Load agents configuration from source (file or URL)
   */
  async getAgentsConfig(): Promise<AgentsConfig> {
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

    console.log(`✅ [AgentRepository] Loaded ${config.agents.length} agents`);

    return config;
  }

  /**
   * Clear the agents cache
   */
  clearCache(): void {
    this.agentsCache.clear();
  }
}

// Export singleton instance
export default new AgentRepository();
