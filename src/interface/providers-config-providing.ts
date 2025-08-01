import type { ProvidersConfig } from '../cubicler';
import type { AvailableServersResponse } from '../model/tools.js';

/**
 * Protocol for providing provider configuration and server metadata
 */

export interface ProvidersConfigProviding {
  /**
   * Load providers configuration from source (file or URL)
   */
  getProvidersConfig(): Promise<ProvidersConfig>;

  /**
   * Clear any cached configuration data
   */
  clearCache(): void;

  /**
   * Get all available servers with processed metadata
   */
  getAvailableServers(): Promise<AvailableServersResponse>;

  /**
   * Get server hash for tool naming
   */
  getServerHash(serverIdentifier: string): Promise<string | null>;

  /**
   * Update tool count for a specific server (used by MCP services after initialization)
   */
  updateServerToolCount(serverIdentifier: string, toolsCount: number): Promise<void>;
}
