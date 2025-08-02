import { config } from 'dotenv';
import type { ServersProviding } from '../interface/servers-providing.js';
import type { ProvidersConfigProviding } from '../interface/providers-config-providing.js';
import { ToolsListProviding } from '../interface/tools-list-providing.js';
import { AvailableServersResponse } from '../model/server.js';

config();

/**
 * Provider Service for Cubicler
 * Handles both MCP servers and REST servers from providers.json configuration
 * Uses MCPService through dependency injection for better modularity
 */
class ProviderService implements ServersProviding {
  private readonly configProvider: ProvidersConfigProviding;
  private toolsProviders: ToolsListProviding[];

  /**
   * Creates a new ProviderService instance
   * @param configProvider - Provider configuration service for accessing server configurations
   * @param toolsProviders - Array of tools list providers for MCP and REST servers
   */
  constructor(configProvider: ProvidersConfigProviding, toolsProviders: ToolsListProviding[]) {
    this.configProvider = configProvider;
    this.toolsProviders = toolsProviders;
  }

  /**
   * Get all available servers (ServersProviding)
   * @returns Available servers response with total count and server details
   */
  async getAvailableServers(): Promise<AvailableServersResponse> {
    // Delegate to repository (single source of truth)
    return await this.configProvider.getAvailableServers();
  }

  /**
   * Get server hash for tool naming (ServersProviding)
   * @param serverIdentifier - The server identifier (snake_case)
   * @returns The server hash or null if not found
   */
  async getServerHash(serverIdentifier: string): Promise<string | null> {
    // Delegate to repository (single source of truth)
    return await this.configProvider.getServerHash(serverIdentifier);
  }
}

import providerMcpService from './provider-mcp-service.js';
import providerRestService from './provider-rest-service.js';
import configProvider from '../repository/provider-repository.js';

// Create the provider service instance
const providerServiceInstance = new ProviderService(configProvider, [
  providerMcpService,
  providerRestService,
]);

// Set up circular dependencies
providerMcpService.setServersProvider(providerServiceInstance);
providerRestService.setServersProvider(providerServiceInstance);

// Export the class for dependency injection and the configured instance for backward compatibility
export { ProviderService };
export default providerServiceInstance;
