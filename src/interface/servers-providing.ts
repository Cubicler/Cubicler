/**
 * Interface for services that provide server listing
 */

export interface ServersProviding {
  /**
   * Get all available servers (both MCP and REST)
   */
  getAvailableServers(): Promise<import('../model/tools.js').AvailableServersResponse>;

  /**
   * Get server index by identifier for function naming
   * @param serverIdentifier - The server identifier
   * @returns The server index (0-based) or -1 if not found
   */
  getServerIndex(serverIdentifier: string): Promise<number>;

  /**
   * Get server identifier by index for function parsing
   * @param serverIndex - The server index (0-based)
   * @returns The server identifier or null if not found
   */
  getServerIdentifier(serverIndex: number): Promise<string | null>;
}
