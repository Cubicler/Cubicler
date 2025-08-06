import { config } from 'dotenv';
import { ProvidersConfig } from '../model/providers.js';
import { AvailableServersResponse } from '../model/server.js';
import { Cache, createEnvCache } from '../utils/cache.js';
import { ProvidersConfigProviding } from '../interface/providers-config-providing.js';
import { loadConfigFromSource, validateProvidersConfig } from '../utils/config-helper.js';
import { generateServerHash, toSnakeCase } from '../utils/parameter-helper.js';

config();

/**
 * Server metadata with processed information
 */
interface ServerMetadata {
  identifier: string; // snake_case identifier (agents only know this one)
  name: string;
  description: string;
  url: string;
  hash: string; // 6-character hash for tool naming
  toolsCount: number;
  type: 'mcp' | 'rest';
  index: number; // position in combined list (MCP first, then REST)
}

/**
 * Providers repository for loading and caching providers configuration
 * Single source of truth for server metadata, handles conversion and caching
 */
class ProviderRepository implements ProvidersConfigProviding {
  // Cache for providers configuration
  private readonly providersCache: Cache<ProvidersConfig> = createEnvCache('PROVIDERS', 600); // 10 minutes default
  // Cache for processed server metadata
  private readonly metadataCache: Cache<ServerMetadata[]> = createEnvCache('SERVER_METADATA', 600);
  private lastConfigHash: string | null = null;

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
    this.metadataCache.clear();
    this.lastConfigHash = null;
  }

  /**
   * Get processed server metadata with snake_case identifiers and hashes
   * This is the single source of truth for all server information
   */
  async getServerMetadata(): Promise<ServerMetadata[]> {
    const config = await this.getProvidersConfig();
    const configHash = this.generateConfigHash(config);

    // Check if we need to update cached metadata
    if (this.lastConfigHash !== configHash) {
      console.log('🔄 [ProviderRepository] Config changed, updating server metadata...');
      const freshMetadata = await this.updateServerMetadata(config);
      this.lastConfigHash = configHash;
      return freshMetadata;
    }

    const cached = this.metadataCache.get('metadata');
    if (cached) {
      return cached;
    }

    // If cache is empty but config hasn't changed, regenerate metadata
    console.log('⚠️ [ProviderRepository] Cache miss, regenerating server metadata...');
    const freshMetadata = await this.updateServerMetadata(config);
    this.lastConfigHash = configHash;
    return freshMetadata;
  }

  /**
   * Get available servers in the format expected by the API
   */
  async getAvailableServers(): Promise<AvailableServersResponse> {
    const metadata = await this.getServerMetadata();

    const servers = metadata.map((server) => ({
      identifier: server.identifier, // Already snake_case
      name: server.name,
      description: server.description,
      toolsCount: server.toolsCount,
    }));

    return {
      total: servers.length,
      servers,
    };
  }

  /**
   * Get server metadata by identifier (snake_case only)
   */
  async getServerByIdentifier(serverIdentifier: string): Promise<ServerMetadata | null> {
    const metadata = await this.getServerMetadata();

    return metadata.find((server) => server.identifier === serverIdentifier) || null;
  }

  /**
   * Get server hash for tool naming
   */
  async getServerHash(serverIdentifier: string): Promise<string | null> {
    const server = await this.getServerByIdentifier(serverIdentifier);
    return server ? server.hash : null;
  }

  /**
   * Update server metadata cache based on current configuration
   */
  private async updateServerMetadata(config: ProvidersConfig): Promise<ServerMetadata[]> {
    const metadata: ServerMetadata[] = [];
    let index = 0;

    // Process MCP servers first
    if (config.mcpServers) {
      for (const mcpServer of config.mcpServers) {
        const identifier = toSnakeCase(mcpServer.identifier); // Store as snake_case
        const hash = generateServerHash(
          mcpServer.identifier,
          mcpServer.url || mcpServer.command || ''
        );

        metadata.push({
          identifier,
          name: mcpServer.name,
          description: mcpServer.description,
          url: mcpServer.url || mcpServer.command || '',
          hash,
          toolsCount: 0, // Will be updated when tools are loaded
          type: 'mcp',
          index,
        });
        index++;
      }
    }

    // Process REST servers next
    if (config.restServers) {
      for (const restServer of config.restServers) {
        const identifier = toSnakeCase(restServer.identifier); // Store as snake_case
        const hash = generateServerHash(restServer.identifier, restServer.url);

        metadata.push({
          identifier,
          name: restServer.name,
          description: restServer.description,
          url: restServer.url,
          hash,
          toolsCount: restServer.endPoints.length,
          type: 'rest',
          index,
        });
        index++;
      }
    }

    // Cache the processed metadata
    this.metadataCache.set('metadata', metadata);
    console.log(`✅ [ProviderRepository] Updated metadata for ${metadata.length} servers`);

    return metadata;
  }

  /**
   * Generate a hash of the configuration to detect changes
   */
  private generateConfigHash(config: ProvidersConfig): string {
    const configString = JSON.stringify(config, Object.keys(config).sort());
    // Simple hash function for change detection
    let hash = 0;
    for (let i = 0; i < configString.length; i++) {
      const char = configString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  /**
   * Update tool count for a specific server (used by MCP services after initialization)
   */
  async updateServerToolCount(serverIdentifier: string, toolsCount: number): Promise<void> {
    const metadata = await this.getServerMetadata();
    const server = metadata.find((s) => s.identifier === serverIdentifier);

    if (server) {
      server.toolsCount = toolsCount;
      // Update cache
      this.metadataCache.set('metadata', metadata);
    }
  }
}

// Export singleton instance
export default new ProviderRepository();
