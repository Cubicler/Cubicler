import type { ServerConfig, CubiclerConfig } from '../model/server-config.js';
import { loadConfigFromSource } from '../utils/config-helper.js';

/**
 * Service for loading and managing server configuration
 */
export class ServerConfigService {
  private config: ServerConfig | null = null;

  /**
   * Load server configuration from environment or file
   * @returns Promise that resolves to server configuration
   */
  async loadConfig(): Promise<ServerConfig> {
    if (this.config) {
      return this.config;
    }

    const defaultConfig: ServerConfig = {
      port: parseInt(process.env.CUBICLER_PORT || '1503'),
      host: process.env.CUBICLER_HOST || '0.0.0.0',
    };

    // Check if server config is specified via environment variable
    const configSource = process.env.CUBICLER_CONFIG;
    
    if (!configSource) {
      console.log(`📋 [ServerConfig] Using default configuration`);
      this.config = defaultConfig;
      return this.config;
    }

    try {
      const cubiclerConfig = await loadConfigFromSource<CubiclerConfig>('CUBICLER_CONFIG', 'Cubicler configuration');
      
      this.config = {
        ...defaultConfig,
        ...cubiclerConfig.server,
      };

      console.log(`✅ [ServerConfig] Configuration loaded successfully`);
      return this.config;
    } catch (error) {
      console.warn(`⚠️ [ServerConfig] Failed to load config from ${configSource}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log(`📋 [ServerConfig] Falling back to default configuration`);
      
      this.config = defaultConfig;
      return this.config;
    }
  }

  /**
   * Get current server configuration
   * @returns Server configuration or null if not loaded
   */
  getConfig(): ServerConfig | null {
    return this.config;
  }

  /**
   * Get JWT configuration for a specific endpoint
   * @param endpoint - Endpoint name (e.g., 'dispatch', 'mcp')
   * @returns JWT configuration or null if not configured
   */
  getEndpointJWTConfig(endpoint: string) {
    const config = this.getConfig();
    if (!config) return null;

    // Check endpoint-specific config first
    const endpointConfig = config.endpoints?.[endpoint];
    if (endpointConfig?.auth?.jwt) {
      return endpointConfig.auth.jwt;
    }

    // Fall back to global auth config
    if (config.auth?.jwt) {
      return config.auth.jwt;
    }

    return null;
  }

  /**
   * Check if JWT authentication is enabled for an endpoint
   * @param endpoint - Endpoint name
   * @returns True if JWT is configured for the endpoint
   */
  isJWTEnabled(endpoint: string): boolean {
    return this.getEndpointJWTConfig(endpoint) !== null;
  }

  /**
   * Clear cached configuration (for testing)
   */
  clearCache(): void {
    this.config = null;
  }
}

export default new ServerConfigService();