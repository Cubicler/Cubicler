import type { ServerConfig } from '../model/server-config.js';
import type { JSONObject } from '../model/types.js';

/**
 * Interface for providing server configuration services
 */
export interface ServerConfigProviding {
  /**
   * Load server configuration from environment or file
   * @returns Promise that resolves to server configuration
   */
  loadConfig(): Promise<ServerConfig>;

  /**
   * Get current server configuration
   * @returns Server configuration or null if not loaded
   */
  getConfig(): ServerConfig | null;

  /**
   * Get JWT configuration for a specific endpoint
   * @param _endpoint - Endpoint name (e.g., 'dispatch', 'mcp')
   * @returns JWT configuration or null if not configured
   */
  getEndpointJwtConfig(_endpoint: string): JSONObject | null;

  /**
   * Check if JWT authentication is enabled for an endpoint
   * @param _endpoint - Endpoint name
   * @returns True if JWT is configured for the endpoint
   */
  isJwtEnabled(_endpoint: string): boolean;

  /**
   * Clear cached configuration (for testing)
   */
  clearCache(): void;
}
