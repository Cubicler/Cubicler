/**
 * Interface for services that provide server listing and tools
 */

export interface ServersProviding {
    /**
     * Get all available servers (both MCP and REST)
     */
    getAvailableServers(): Promise<import('../model/tools.js').AvailableServersResponse>;

    /**
     * Get tools from a specific server
     */
    getServerTools(serverIdentifier: string): Promise<import('../model/tools.js').ServerToolsResponse>;
}
