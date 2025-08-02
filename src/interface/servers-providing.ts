/**
 * Interface for services that provide server listing
 */

export interface ServersProviding {
  /**
   * Get all available servers (both MCP and REST)
   */
  getAvailableServers(): Promise<import('../model/server.js').AvailableServersResponse>;

  /**
   * Get server hash for tool naming
   * @param serverIdentifier - The server identifier (snake_case)
   * @returns The server hash or null if not found
   */
  // eslint-disable-next-line no-unused-vars
  getServerHash(serverIdentifier: string): Promise<string | null>;
}
