import type { JSONObject } from './types.js';

/**
 * Server information for internal server management
 * Used by Cubicler to track available servers and their capabilities
 */
export interface ServerInfo extends JSONObject {
  identifier: string;
  name: string;
  description: string;
  toolsCount: number;
}

/**
 * Simplified server information for agent requests
 * Contains only the essential information agents need to know about available servers
 */
export interface AgentServerInfo extends JSONObject {
  identifier: string;
  name: string;
  description: string;
}

/**
 * Available servers response for cubicler_available_servers
 */
export interface AvailableServersResponse extends JSONObject {
  total: number;
  servers: ServerInfo[];
}
