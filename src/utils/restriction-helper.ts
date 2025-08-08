import type { AgentConfig } from '../model/agents.js';
import type { ServerInfo } from '../model/server.js';
import type { ToolDefinition } from '../model/tools.js';
import type { ServersProviding } from '../interface/servers-providing.js';
import { parseFunctionName } from './parameter-helper.js';

/**
 * Helper functions for handling agent tool and server restrictions
 */

/**
 * Check if a server is allowed for the given agent
 * @param agent - Agent configuration with potential restrictions
 * @param serverIdentifier - Server identifier to check
 * @returns true if server is allowed, false otherwise
 */
export function isServerAllowed(agent: AgentConfig, serverIdentifier: string): boolean {
  // Step 1: Apply allowedServers filter (if defined)
  if (agent.allowedServers && agent.allowedServers.length > 0) {
    if (!agent.allowedServers.includes(serverIdentifier)) {
      return false;
    }
  }

  // Step 2: Remove restrictedServers (if defined)
  if (agent.restrictedServers && agent.restrictedServers.includes(serverIdentifier)) {
    return false;
  }

  return true;
}

/**
 * Check if a tool is allowed for the given agent
 * @param agent - Agent configuration with potential restrictions
 * @param toolName - Tool name to check (format: "{hash}_{snake_case_function}" for external tools or internal tool name)
 * @param serversProvider - Server provider to resolve server identifiers from hashes
 * @returns true if tool is allowed, false otherwise
 */
export async function isToolAllowed(
  agent: AgentConfig,
  toolName: string,
  serversProvider: ServersProviding
): Promise<boolean> {
  // For internal tools (cubicler_*), they're always allowed unless explicitly restricted
  if (toolName.startsWith('cubicler_')) {
    // Internal tool - only check restrictedTools (internal tools can't be in allowed lists)
    if (agent.restrictedTools && agent.restrictedTools.includes(toolName)) {
      return false;
    }
    return true;
  }

  // External tool with {hash}_{function} format
  let serverIdentifier: string;
  let originalToolName: string;

  try {
    const parsed = parseFunctionName(toolName);
    const serverHash = parsed.serverHash;
    originalToolName = parsed.functionName;

    // Find server identifier from hash using the mandatory servers provider

    // Get all servers and find one with matching hash
    const serversResponse = await serversProvider.getAvailableServers();
    let matchingServer: ServerInfo | undefined;

    for (const server of serversResponse.servers) {
      try {
        const hash = await serversProvider.getServerHash(server.identifier);
        if (hash === serverHash) {
          matchingServer = server;
          break;
        }
      } catch {
        // Skip if can't get hash
        continue;
      }
    }

    if (!matchingServer) {
      return false; // Unknown server
    }

    serverIdentifier = matchingServer.identifier;
  } catch {
    // Invalid tool name format or parsing error
    return false;
  }

  // Step 1: Check if server is allowed
  if (!isServerAllowed(agent, serverIdentifier)) {
    return false;
  }

  // For checking restrictions, we need to convert back to config format {server}.{tool}
  const configFormatTool = `${serverIdentifier}.${originalToolName}`;

  // Step 2: Apply allowedTools filter (if defined)
  if (agent.allowedTools && agent.allowedTools.length > 0) {
    if (!agent.allowedTools.includes(configFormatTool)) {
      return false;
    }
  }

  // Step 3: Remove restrictedTools (if defined)
  if (agent.restrictedTools && agent.restrictedTools.includes(configFormatTool)) {
    return false;
  }

  return true;
}

/**
 * Filter servers based on agent restrictions
 * @param agent - Agent configuration with potential restrictions
 * @param servers - Array of server info objects
 * @returns Filtered array of allowed servers
 */
export function filterAllowedServers(agent: AgentConfig, servers: ServerInfo[]): ServerInfo[] {
  return servers.filter((server) => isServerAllowed(agent, server.identifier));
}

/**
 * Filter tools based on agent restrictions
 * @param agent - Agent configuration with potential restrictions
 * @param tools - Array of tool definitions
 * @param serversProvider - Server provider to resolve server identifiers from hashes
 * @returns Filtered array of allowed tools
 */
export async function filterAllowedTools(
  agent: AgentConfig,
  tools: ToolDefinition[],
  serversProvider: ServersProviding
): Promise<ToolDefinition[]> {
  const results = await Promise.all(
    tools.map(async (tool) => ({
      tool,
      allowed: await isToolAllowed(agent, tool.name, serversProvider),
    }))
  );

  return results.filter((result) => result.allowed).map((result) => result.tool);
}

/**
 * Validate if an agent can execute a specific tool
 * Throws an error if tool is not allowed
 * @param agent - Agent configuration with potential restrictions
 * @param toolName - Tool name to validate
 * @param serversProvider - Server provider to resolve server identifiers from hashes
 * @throws Error if tool is restricted
 */
export async function validateToolAccess(
  agent: AgentConfig,
  toolName: string,
  serversProvider: ServersProviding
): Promise<void> {
  if (!(await isToolAllowed(agent, toolName, serversProvider))) {
    throw new Error('Access denied: insufficient permissions for requested operation');
  }
}
