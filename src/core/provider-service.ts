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

  /**
   * Get server index by identifier for function naming
   * Based on order of servers in providers.json (MCP servers first, then REST servers)
   * @param serverIdentifier - The server identifier
   * @returns The server index (0-based) or -1 if not found
   */
  async getServerIndex(serverIdentifier: string): Promise<number> {
    const config = await this.configProvider.getProvidersConfig();
    let index = 0;

    // Check MCP servers first
    if (config.mcpServers) {
      for (const server of config.mcpServers) {
        if (server.identifier === serverIdentifier) {
          return index;
        }
        index++;
      }
    }

    // Check REST servers next
    if (config.restServers) {
      for (const server of config.restServers) {
        if (server.identifier === serverIdentifier) {
          return index;
        }
        index++;
      }
    }

    return -1; // Not found
  }

  /**
   * Get server identifier by index for function parsing
   * Based on order of servers in providers.json (MCP servers first, then REST servers)
   * @param serverIndex - The server index (0-based)
   * @returns The server identifier or null if not found
   */
  async getServerIdentifier(serverIndex: number): Promise<string | null> {
    const config = await this.configProvider.getProvidersConfig();
    let currentIndex = 0;

    // Check MCP servers first
    if (config.mcpServers) {
      for (const server of config.mcpServers) {
        if (currentIndex === serverIndex) {
          return server.identifier;
        }
        currentIndex++;
      }
    }

    // Check REST servers next
    if (config.restServers) {
      for (const server of config.restServers) {
        if (currentIndex === serverIndex) {
          return server.identifier;
        }
        currentIndex++;
      }
    }

    return null; // Not found
  }
}

import providerMcpService from './provider-mcp-service.js';
import providerRestService from './provider-rest-service.js';
import configProvider from '../repository/provider-repository.js';

// Create the provider service instance
const providerServiceInstance = new ProviderService(configProvider, [providerMcpService, providerRestService]);

// Set up circular dependencies
providerMcpService.setServersProvider(providerServiceInstance);
providerRestService.setServersProvider(providerServiceInstance);

// Export the class for dependency injection and the configured instance for backward compatibility
export { ProviderService };
export default providerServiceInstance;
