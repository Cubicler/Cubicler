import { config } from 'dotenv';
import type { ServersProviding } from '../interface/servers-providing.js';
import type { ProvidersConfigProviding } from '../interface/providers-config-providing.js';
import { ToolsListProviding } from '../interface/tools-list-providing.js';
import { AvailableServersResponse } from '../model/tools.js';

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
   * Get all available servers (both MCP and REST)
   * @returns Available servers response with total count and server details
   */
  async getAvailableServers(): Promise<AvailableServersResponse> {
    const config = await this.configProvider.getProvidersConfig();
    const servers: Array<{
      identifier: string;
      name: string;
      description: string;
      toolsCount: number;
    }> = [];

    // Add MCP servers with actual tool counts
    if (config.mcpServers) {
      for (const server of config.mcpServers) {
        let toolsCount = 0;

        // Try to get actual tool count from MCP provider
        try {
          const provider = this.toolsProviders.find(
            (provider) => provider.identifier === server.identifier
          );

          const tools = await provider?.toolsList();
          toolsCount = tools ? tools.length : 0;
        } catch (error) {
          console.warn(
            `⚠️ [ProviderService] Failed to get tool count for MCP server ${server.identifier}:`,
            error
          );
          // toolsCount remains 0 if we can't fetch tools
        }

        servers.push({
          identifier: server.identifier,
          name: server.name,
          description: server.description,
          toolsCount,
        });
      }
    }

    // Add REST servers
    if (config.restServers) {
      for (const server of config.restServers) {
        servers.push({
          identifier: server.identifier,
          name: server.name,
          description: server.description,
          toolsCount: server.endPoints.length,
        });
      }
    }

    return {
      total: servers.length,
      servers,
    };
  }
}

import providerMcpService from './provider-mcp-service.js';
import providerRestService from './provider-rest-service.js';
import configProvider from '../repository/provider-repository.js';

// Export the class for dependency injection and a default instance for backward compatibility
export { ProviderService };
export default new ProviderService(configProvider, [providerMcpService, providerRestService]);
