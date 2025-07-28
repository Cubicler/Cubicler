import { ToolDefinition } from '../model/tools';

/**
 * Interface for services that can provide a list of tools
 */

export interface ToolsListProviding {
  /**
   * Unique identifier for this service instance
   */
  readonly identifier: string;

  /**
   * Get list of tools/functions this service provides
   */
  toolsList(): Promise<ToolDefinition[]>;
}
