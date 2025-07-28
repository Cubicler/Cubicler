/**
 * Interface for services that provide server listing
 */

export interface ServersProviding {
  /**
   * Get all available servers (both MCP and REST)
   */
  getAvailableServers(): Promise<import('../model/tools.js').AvailableServersResponse>;
}
