import { config } from 'dotenv';
import type { ProvidersConfig } from '../model/providers.js';
import { Cache, createEnvCache } from './cache.js';
import { ProvidersConfigProviding } from '../interface/provider-config-providing.js';
import { loadConfigFromSource, validateProvidersConfig } from './config-helper.js';

config();

/**
 * Providers repository for loading and caching providers configuration
 * Used by all services to access the providers configuration
 */
class ProviderRepository implements ProvidersConfigProviding {
  // Cache for providers configuration
  private readonly providersCache: Cache<ProvidersConfig> = createEnvCache('PROVIDERS', 600); // 10 minutes default

  /**
   * Load providers configuration from source (file or URL)
   */
  async getProvidersConfig(): Promise<ProvidersConfig> {
    const cached = this.providersCache.get('config');
    if (cached) {
      return cached;
    }

    const config = await loadConfigFromSource<ProvidersConfig>(
      'CUBICLER_PROVIDERS_LIST',
      'providers configuration'
    );

    // Validate configuration structure
    validateProvidersConfig(config);

    // Cache the result
    this.providersCache.set('config', config);

    const mcpCount = config.mcpServers?.length || 0;
    const restCount = config.restServers?.length || 0;
    console.log(
      `✅ [ProvidersRepository] Loaded ${mcpCount} MCP servers and ${restCount} REST servers`
    );

    return config;
  }

  /**
   * Clear the providers cache
   */
  clearCache(): void {
    this.providersCache.clear();
  }
}

// Export singleton instance
export default new ProviderRepository();
