import { readFileSync } from 'fs';
import { fetchWithDefaultTimeout } from './fetch-helper';
import {
  getConfigLoadTimeout,
  getConfigurationSource,
  substituteEnvVarsInObject,
} from './env-helper';
import { isRemoteUrl } from './source-helper';
import type { ProvidersConfig } from '../model/providers';
import type { AgentsConfig } from '../model/agents';
import type { JSONObject } from '../model/types';

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

/**
 * Validate providers configuration structure
 * @param config - The configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateProvidersConfig(config: unknown): asserts config is ProvidersConfig {
  validateBasicConfigStructure(config, 'providers');

  const typedConfig = config as ProvidersConfig;

  if (typedConfig.mcpServers !== undefined) {
    validateMcpServersArray(typedConfig.mcpServers);
  }

  if (typedConfig.restServers !== undefined) {
    validateRestServersArray(typedConfig.restServers);
  }

  validateAtLeastOneServerExists(typedConfig);
}

/**
 * Validate agents configuration structure
 * @param config - The configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateAgentsConfig(config: unknown): asserts config is AgentsConfig {
  validateBasicConfigStructure(config, 'agents');

  const typedConfig = config as AgentsConfig;
  validateAgentsArray(typedConfig.agents);
  validatePromptFields(typedConfig);
}

/**
 * Load configuration from remote URL
 * @param url - URL to fetch from
 * @param description - Description for error messages
 * @returns Promise that resolves to the configuration object
 */
async function loadConfigFromUrl(url: string, description: string): Promise<unknown> {
  console.log(`🌐 [ConfigHelper] Fetching from remote URL...`);

  try {
    const response = await fetchWithDefaultTimeout(url, {
      timeout: getConfigLoadTimeout(),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Cubicler/2.0',
      },
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

/**
 * Load configuration from local file
 * @param filePath - Path to file
 * @param description - Description for error messages
 * @returns The parsed configuration object
 */
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

/**
 * Validate HTTP response status
 * @param response - HTTP response to validate
 * @throws Error if response status indicates failure
 */
function validateHttpResponse(response: { status: number; statusText: string }): void {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
}

/**
 * Validate that data is valid JSON object
 * @param data - Data to validate
 * @throws Error if data is invalid
 */
function validateJsonData(data: unknown): void {
  if (!data || typeof data !== 'object') {
    throw new Error('Remote URL returned invalid JSON data');
  }
}

/**
 * Apply environment variable substitution to configuration
 * @param config - Configuration object to process
 * @param description - Description for logging
 * @returns Configuration with environment variables substituted
 */
function applyEnvironmentVariableSubstitution<T>(config: unknown, description: string): T {
  const configWithEnvVars = substituteEnvVarsInObject(config as JSONObject);
  if (configWithEnvVars) {
    console.log(`🔄 [ConfigHelper] Applied environment variable substitution to ${description}`);
    return configWithEnvVars as T;
  }
  return config as T;
}

/**
 * Validate basic configuration structure
 * @param config - Configuration to validate
 * @param configType - Type of configuration for error messages
 * @throws Error if basic structure is invalid
 */
function validateBasicConfigStructure(config: unknown, configType: string): void {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`Invalid ${configType} configuration: must be a valid JSON object`);
  }
}

/**
 * Validate MCP servers array
 * @param mcpServers - Array of MCP servers to validate
 * @throws Error if array or any server is invalid
 */
function validateMcpServersArray(mcpServers: unknown): void {
  if (!Array.isArray(mcpServers)) {
    throw new Error('Invalid providers configuration: mcpServers must be an array');
  }

  mcpServers.forEach((server, index) => {
    validateMcpServer(server, index);
  });
}

/**
 * Validate individual MCP server configuration
 * @param server - Server configuration to validate
 * @param index - Array index for error messages
 * @throws Error if server configuration is invalid
 */
function validateMcpServer(server: unknown, index: number): void {
  if (!server || typeof server !== 'object' || Array.isArray(server)) {
    throw new Error(`Invalid MCP server at index ${index}: must be an object`);
  }

  const typedServer = server as { identifier?: unknown; url?: unknown };

  validateServerIdentifier(typedServer.identifier, index, 'MCP');
  validateServerUrl(typedServer.url, index, 'MCP');
}

/**
 * Validate REST servers array
 * @param restServers - Array of REST servers to validate
 * @throws Error if array or any server is invalid
 */
function validateRestServersArray(restServers: unknown): void {
  if (!Array.isArray(restServers)) {
    throw new Error('Invalid providers configuration: restServers must be an array');
  }

  restServers.forEach((server, index) => {
    validateRestServer(server, index);
  });
}

/**
 * Validate individual REST server configuration
 * @param server - Server configuration to validate
 * @param index - Array index for error messages
 * @throws Error if server configuration is invalid
 */
function validateRestServer(server: unknown, index: number): void {
  if (!server || typeof server !== 'object' || Array.isArray(server)) {
    throw new Error(`Invalid REST server at index ${index}: must be an object`);
  }

  const typedServer = server as { identifier?: unknown; url?: unknown };

  validateServerIdentifier(typedServer.identifier, index, 'REST');
  validateServerUrl(typedServer.url, index, 'REST');
}

/**
 * Validate server identifier
 * @param identifier - Identifier to validate
 * @param index - Array index for error messages
 * @param serverType - Type of server (MCP/REST) for error messages
 * @throws Error if identifier is invalid
 */
function validateServerIdentifier(identifier: unknown, index: number, serverType: string): void {
  if (!identifier || typeof identifier !== 'string') {
    throw new Error(
      `Invalid ${serverType} server at index ${index}: missing or invalid identifier`
    );
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(identifier)) {
    throw new Error(
      `Invalid ${serverType} server at index ${index}: identifier "${identifier}" must contain only letters, numbers, hyphens, or underscores (no spaces)`
    );
  }

  if (identifier.length > 32) {
    throw new Error(
      `Invalid ${serverType} server at index ${index}: identifier "${identifier}" must be 32 characters or less (current: ${identifier.length})`
    );
  }
}

/**
 * Validate server URL
 * @param url - URL to validate
 * @param index - Array index for error messages
 * @param serverType - Type of server (MCP/REST) for error messages
 * @throws Error if URL is invalid
 */
function validateServerUrl(url: unknown, index: number, serverType: string): void {
  if (!url || typeof url !== 'string') {
    throw new Error(`Invalid ${serverType} server at index ${index}: missing or invalid url`);
  }
}

/**
 * Validate that at least one server type exists
 * @param config - Configuration to check
 */
function validateAtLeastOneServerExists(config: ProvidersConfig): void {
  const hasMcpServers = Array.isArray(config.mcpServers) && config.mcpServers.length > 0;
  const hasRestServers = Array.isArray(config.restServers) && config.restServers.length > 0;

  if (!hasMcpServers && !hasRestServers) {
    console.warn('⚠️ [ConfigHelper] No servers configured in providers list');
  }
}

/**
 * Validate agents array structure and content
 * @param agents - Array of agents to validate
 * @throws Error if array is invalid
 */
function validateAgentsArray(agents: unknown): void {
  if (!Array.isArray(agents)) {
    throw new Error('Invalid agents configuration: agents must be an array');
  }

  if (agents.length === 0) {
    throw new Error('Invalid agents configuration: at least one agent must be configured');
  }

  agents.forEach((agent, index) => {
    validateAgent(agent, index);
  });

  validateNoDuplicateAgentIdentifiers(agents);
}

/**
 * Validate individual agent configuration
 * @param agent - Agent configuration to validate
 * @param index - Array index for error messages
 * @throws Error if agent configuration is invalid
 */
function validateAgent(agent: unknown, index: number): void {
  if (!agent || typeof agent !== 'object' || Array.isArray(agent)) {
    throw new Error(`Invalid agent at index ${index}: must be an object`);
  }

  const typedAgent = agent as {
    identifier?: unknown;
    url?: unknown;
    name?: unknown;
  };

  validateAgentRequiredFields(typedAgent, index);
  validateAgentIdentifierFormat(typedAgent.identifier as string, index);
}

/**
 * Validate required fields for an agent
 * @param agent - Agent to validate
 * @param index - Array index for error messages
 * @throws Error if required fields are missing or invalid
 */
function validateAgentRequiredFields(
  agent: { identifier?: unknown; url?: unknown; name?: unknown },
  index: number
): void {
  if (!agent.identifier || typeof agent.identifier !== 'string') {
    throw new Error(`Invalid agent at index ${index}: missing or invalid identifier`);
  }

  if (!agent.url || typeof agent.url !== 'string') {
    throw new Error(`Invalid agent at index ${index}: missing or invalid url`);
  }

  if (!agent.name || typeof agent.name !== 'string') {
    throw new Error(`Invalid agent at index ${index}: missing or invalid name`);
  }
}

/**
 * Validate agent identifier format
 * @param identifier - Identifier to validate
 * @param index - Array index for error messages
 * @throws Error if identifier format is invalid
 */
function validateAgentIdentifierFormat(identifier: string, index: number): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(identifier)) {
    throw new Error(
      `Invalid agent at index ${index}: identifier "${identifier}" must contain only letters, numbers, hyphens, or underscores (no spaces)`
    );
  }

  if (identifier.length > 32) {
    throw new Error(
      `Invalid agent at index ${index}: identifier "${identifier}" must be 32 characters or less (current: ${identifier.length})`
    );
  }
}

/**
 * Validate that no duplicate agent identifiers exist
 * @param agents - Array of agents to check
 * @throws Error if duplicates are found
 */
function validateNoDuplicateAgentIdentifiers(agents: unknown[]): void {
  const identifiers = agents
    .map((agent) => (agent as { identifier: string }).identifier)
    .filter(Boolean);

  const duplicates = identifiers.filter((id, index) => identifiers.indexOf(id) !== index);

  if (duplicates.length > 0) {
    throw new Error(`Duplicate agent identifiers found: ${duplicates.join(', ')}`);
  }
}

/**
 * Validate prompt fields in agents configuration
 * @param config - Configuration to validate
 * @throws Error if prompt fields are invalid
 */
function validatePromptFields(config: AgentsConfig): void {
  if (config.basePrompt !== undefined && typeof config.basePrompt !== 'string') {
    throw new Error('Invalid agents configuration: basePrompt must be a string');
  }

  if (config.defaultPrompt !== undefined && typeof config.defaultPrompt !== 'string') {
    throw new Error('Invalid agents configuration: defaultPrompt must be a string');
  }
}
