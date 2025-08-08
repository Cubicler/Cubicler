import { readFileSync } from 'fs';
import { fetchWithDefaultTimeout } from './fetch-helper.js';
import {
  getConfigLoadTimeout,
  getConfigurationSource,
  substituteEnvVarsInObject,
} from './env-helper.js';
import { isRemoteUrl } from './source-helper.js';
import type {
  HttpMcpServerConfig,
  McpServerConfig,
  ProvidersConfig,
  RESTEndpoint,
  RESTServerConfig,
  StdioMcpServerConfig,
} from '../model/providers.js';
import type {
  AgentConfig,
  AgentsConfig,
  DirectOpenAIAgentConfig,
  HttpAgentConfig,
  SseAgentConfig,
  StdioAgentConfig,
} from '../model/agents.js';
import type { JSONObject } from '../model/types.js';

/**
 * Configuration loading helper utilities
 * Provides unified configuration loading for both providers and agents
 */

/**
 * Load configuration from source (file or URL)
 * @param envVar - Environment variable name containing the source
 * @param description - Description for error messages
 * @returns Promise that resolves to the configuration object
 */
export async function loadConfigFromSource<T>(envVar: string, description: string): Promise<T> {
  // Validate inputs early
  if (!envVar || typeof envVar !== 'string') {
    throw new Error('Environment variable name must be a non-empty string');
  }
  if (!description || typeof description !== 'string') {
    throw new Error('Description must be a non-empty string');
  }

  const source = getConfigurationSource(envVar, description);
  console.log(`📋 [ConfigHelper] Loading ${description} from: ${source}`);

  const config = isRemoteUrl(source)
    ? await loadConfigFromUrl(source, description)
    : loadConfigFromFile(source, description);

  return applyEnvironmentVariableSubstitution(config, description);
}

// ---------------- Providers Validation (keyed object spec) ----------------

export function validateProvidersConfig(config: unknown): asserts config is ProvidersConfig {
  validateBasicConfigStructure(config, 'providers');
  const typed = config as Partial<ProvidersConfig>;

  if (typed.mcpServers !== undefined) {
    if (
      !typed.mcpServers ||
      typeof typed.mcpServers !== 'object' ||
      Array.isArray(typed.mcpServers)
    ) {
      throw new Error('Invalid providers configuration: mcpServers must be an object');
    }
    for (const [id, server] of Object.entries(typed.mcpServers)) {
      validateMcpServer(id, server as McpServerConfig);
    }
  }

  if (typed.restServers !== undefined) {
    if (
      !typed.restServers ||
      typeof typed.restServers !== 'object' ||
      Array.isArray(typed.restServers)
    ) {
      throw new Error('Invalid providers configuration: restServers must be an object');
    }
    for (const [id, server] of Object.entries(typed.restServers)) {
      validateRestServer(id, server as RESTServerConfig);
    }
  }
}

function isStdioServer(server: McpServerConfig): server is StdioMcpServerConfig {
  return 'command' in server;
}

function isHttpLikeServer(server: McpServerConfig): server is HttpMcpServerConfig {
  return 'url' in server;
}

function validateMcpServer(id: string, server: McpServerConfig): void {
  validateIdentifierKey(id, 'MCP server');
  if (!server || typeof server !== 'object') {
    throw new Error(`Invalid MCP server '${id}': must be an object`);
  }
  if (!server.name || typeof server.name !== 'string') {
    throw new Error(`Invalid MCP server '${id}': missing or invalid name`);
  }
  if (!server.description || typeof server.description !== 'string') {
    throw new Error(`Invalid MCP server '${id}': missing or invalid description`);
  }
  if (isStdioServer(server)) {
    if (!server.command || typeof server.command !== 'string') {
      throw new Error(`Invalid MCP server '${id}': stdio transport requires command`);
    }
  } else if (isHttpLikeServer(server)) {
    if (!server.url || typeof server.url !== 'string') {
      throw new Error(`Invalid MCP server '${id}': http/sse transport requires url`);
    }
  } else {
    throw new Error(`Invalid MCP server '${id}': unsupported transport shape`);
  }
}

function validateRestServer(id: string, server: RESTServerConfig): void {
  validateIdentifierKey(id, 'REST server');
  if (!server || typeof server !== 'object') {
    throw new Error(`Invalid REST server '${id}': must be an object`);
  }
  if (!server.name || typeof server.name !== 'string') {
    throw new Error(`Invalid REST server '${id}': missing or invalid name`);
  }
  if (!server.description || typeof server.description !== 'string') {
    throw new Error(`Invalid REST server '${id}': missing or invalid description`);
  }
  if (!server.url || typeof server.url !== 'string') {
    throw new Error(`Invalid REST server '${id}': missing or invalid url`);
  }
  if (server.endpoints) {
    if (typeof server.endpoints !== 'object' || Array.isArray(server.endpoints)) {
      throw new Error(`Invalid REST server '${id}': endpoints must be an object`);
    }
    for (const [epId, ep] of Object.entries(server.endpoints)) {
      validateEndpoint(id, epId, ep as RESTEndpoint);
    }
  }
}

function validateEndpoint(serverId: string, endpointId: string, ep: RESTEndpoint): void {
  validateIdentifierKey(endpointId, `endpoint for server '${serverId}'`);
  if (!ep || typeof ep !== 'object') {
    throw new Error(
      `Invalid REST endpoint '${endpointId}' in server '${serverId}': must be an object`
    );
  }
  if (!ep.name || typeof ep.name !== 'string') {
    throw new Error(
      `Invalid REST endpoint '${endpointId}' in server '${serverId}': missing or invalid name`
    );
  }
  if (!ep.description || typeof ep.description !== 'string') {
    throw new Error(
      `Invalid REST endpoint '${endpointId}' in server '${serverId}': missing or invalid description`
    );
  }
  if (!ep.path || typeof ep.path !== 'string') {
    throw new Error(
      `Invalid REST endpoint '${endpointId}' in server '${serverId}': missing or invalid path`
    );
  }
  if (!ep.method || !['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(ep.method)) {
    throw new Error(
      `Invalid REST endpoint '${endpointId}' in server '${serverId}': invalid method`
    );
  }
  if (ep.response_transform && !Array.isArray(ep.response_transform)) {
    throw new Error(
      `Invalid REST endpoint '${endpointId}' in server '${serverId}': response_transform must be an array`
    );
  }
}

// ---------------- Agents Validation (keyed object spec) ----------------

export function validateAgentsConfig(config: unknown): asserts config is AgentsConfig {
  validateBasicConfigStructure(config, 'agents');
  const typed = config as Partial<AgentsConfig>;
  if (!typed.agents || typeof typed.agents !== 'object' || Array.isArray(typed.agents)) {
    throw new Error('Invalid agents configuration: agents must be an object');
  }
  const entries = Object.entries(typed.agents);
  if (entries.length === 0) {
    throw new Error('Invalid agents configuration: at least one agent must be configured');
  }
  for (const [id, agent] of entries) {
    validateIdentifierKey(id, 'agent');
    validateAgent(id, agent as AgentConfig);
  }
  validatePromptFields(typed as AgentsConfig);
}

function validateAgent(agentId: string, agent: AgentConfig): void {
  if (!agent || typeof agent !== 'object') {
    throw new Error(`Invalid agent '${agentId}': must be an object`);
  }
  const transport = (agent as AgentConfig).transport;
  if (!transport) {
    throw new Error(`Invalid agent '${agentId}': missing or invalid transport`);
  }
  if (!agent.name || typeof agent.name !== 'string') {
    throw new Error(`Invalid agent '${agentId}': missing or invalid name`);
  }
  if (!agent.description || typeof agent.description !== 'string') {
    throw new Error(`Invalid agent '${agentId}': missing or invalid description`);
  }

  switch (transport) {
    case 'http':
    case 'sse': {
      const httpAgent = agent as HttpAgentConfig | SseAgentConfig;
      if (!httpAgent.url || typeof httpAgent.url !== 'string') {
        throw new Error(`Invalid agent '${agentId}': ${transport} transport requires url field`);
      }
      break;
    }
    case 'stdio': {
      const stdioAgent = agent as StdioAgentConfig;
      if (!stdioAgent.command || typeof stdioAgent.command !== 'string') {
        throw new Error(`Invalid agent '${agentId}': stdio transport requires command field`);
      }
      break;
    }
    case 'direct': {
      const directAgent = agent as DirectOpenAIAgentConfig;
      if (!directAgent.provider || typeof directAgent.provider !== 'string') {
        throw new Error(`Invalid agent '${agentId}': direct transport requires provider field`);
      }
      if (
        directAgent.provider === 'openai' &&
        (!directAgent.apiKey || typeof directAgent.apiKey !== 'string')
      ) {
        throw new Error(
          `Invalid agent '${agentId}': OpenAI direct transport requires apiKey field`
        );
      }
      break;
    }
    default:
      throw new Error(`Invalid agent '${agentId}': unsupported transport type '${transport}'`);
  }
}

// ---------------- Shared Helpers ----------------

function validateBasicConfigStructure(config: unknown, configType: string): void {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`Invalid ${configType} configuration: must be a valid JSON object`);
  }
}

function validateIdentifierKey(identifier: string, context: string): void {
  if (!identifier || typeof identifier !== 'string') {
    throw new Error(`Invalid ${context}: identifier must be a non-empty string`);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(identifier)) {
    throw new Error(
      `Invalid ${context}: identifier "${identifier}" must contain only letters, numbers, hyphens, or underscores (no spaces)`
    );
  }
  if (identifier.length > 32) {
    throw new Error(
      `Invalid ${context}: identifier "${identifier}" must be 32 characters or less (current: ${identifier.length})`
    );
  }
}

function validatePromptFields(config: AgentsConfig): void {
  if (config.basePrompt !== undefined && typeof config.basePrompt !== 'string') {
    throw new Error('Invalid agents configuration: basePrompt must be a string');
  }
  if (config.defaultPrompt !== undefined && typeof config.defaultPrompt !== 'string') {
    throw new Error('Invalid agents configuration: defaultPrompt must be a string');
  }
}

// ---------------- Loading Helpers ----------------

async function loadConfigFromUrl(url: string, description: string): Promise<unknown> {
  console.log(`🌐 [ConfigHelper] Fetching from remote URL...`);
  try {
    const response = await fetchWithDefaultTimeout(url, {
      timeout: getConfigLoadTimeout(),
      headers: { Accept: 'application/json', 'User-Agent': 'Cubicler/2.0' },
    });
    validateHttpResponse(response);
    validateJsonData(response.data);
    console.log(`✅ [ConfigHelper] Successfully loaded ${description} from remote URL`);
    return response.data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to load ${description} from URL "${url}": ${errorMessage}`);
  }
}

function loadConfigFromFile(filePath: string, description: string): unknown {
  console.log(`📁 [ConfigHelper] Loading from local file...`);
  try {
    const jsonText = readFileSync(filePath, 'utf-8');
    const config = JSON.parse(jsonText);
    console.log(`✅ [ConfigHelper] Successfully loaded ${description} from local file`);
    return config;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to load ${description} from file "${filePath}": ${errorMessage}`);
  }
}

function validateHttpResponse(response: { status: number; statusText: string }): void {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
}

function validateJsonData(data: unknown): void {
  if (!data || typeof data !== 'object') {
    throw new Error('Remote URL returned invalid JSON data');
  }
}

function applyEnvironmentVariableSubstitution<T>(config: unknown, description: string): T {
  const configWithEnvVars = substituteEnvVarsInObject(config as JSONObject);
  if (configWithEnvVars) {
    console.log(`🔄 [ConfigHelper] Applied environment variable substitution to ${description}`);
    return configWithEnvVars as T;
  }
  return config as T;
}
