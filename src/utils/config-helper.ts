import { readFileSync } from 'fs';
import { fetchWithDefaultTimeout } from './fetch-helper.js';
import {
  getConfigLoadTimeout,
  getConfigurationSource,
  substituteEnvVarsInObject,
} from './env-helper.js';
import { isRemoteUrl } from './source-helper.js';
import type { ProvidersConfig } from '../model/providers.js';
import type { AgentsConfig } from '../model/agents.js';
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
  const source = getConfigurationSource(envVar, description);

  console.log(`📋 [ConfigHelper] Loading ${description} from: ${source}`);

  let config: T;

  if (isRemoteUrl(source)) {
    // Load from URL
    try {
      console.log(`🌐 [ConfigHelper] Fetching from remote URL...`);
      const response = await fetchWithDefaultTimeout(source, {
        timeout: getConfigLoadTimeout(),
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Cubicler/2.0',
        },
      });

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Validate that we received valid JSON
      if (!response.data || typeof response.data !== 'object') {
        throw new Error('Remote URL returned invalid JSON data');
      }

      config = response.data;
      console.log(`✅ [ConfigHelper] Successfully loaded ${description} from remote URL`);
    } catch (error) {
      console.error(`❌ [ConfigHelper] Failed to fetch from URL:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to load ${description} from URL "${source}": ${errorMessage}`);
    }
  } else {
    // Load from file
    try {
      console.log(`📁 [ConfigHelper] Loading from local file...`);
      const jsonText = readFileSync(source, 'utf-8');
      config = JSON.parse(jsonText);
      console.log(`✅ [ConfigHelper] Successfully loaded ${description} from local file`);
    } catch (error) {
      console.error(`❌ [ConfigHelper] Failed to load from file:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to load ${description} from file "${source}": ${errorMessage}`);
    }
  }

  // Apply environment variable substitution to the loaded configuration
  const configWithEnvVars = substituteEnvVarsInObject(config as JSONObject);
  if (configWithEnvVars) {
    console.log(`🔄 [ConfigHelper] Applied environment variable substitution to ${description}`);
    return configWithEnvVars as T;
  }

  return config;
}

/**
 * Validate providers configuration structure
 * @param config - The configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateProvidersConfig(config: unknown): asserts config is ProvidersConfig {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Invalid providers configuration: must be a valid JSON object');
  }

  const typedConfig = config as ProvidersConfig;

  // Validate mcpServers array if present
  if (typedConfig.mcpServers !== undefined) {
    if (!Array.isArray(typedConfig.mcpServers)) {
      throw new Error('Invalid providers configuration: mcpServers must be an array');
    }

    for (let i = 0; i < typedConfig.mcpServers.length; i++) {
      const server = typedConfig.mcpServers[i];
      if (!server || typeof server !== 'object' || Array.isArray(server)) {
        throw new Error(`Invalid MCP server at index ${i}: must be an object`);
      }

      if (!server.identifier || typeof server.identifier !== 'string') {
        throw new Error(`Invalid MCP server at index ${i}: missing or invalid identifier`);
      }
      if (!server.url || typeof server.url !== 'string') {
        throw new Error(`Invalid MCP server at index ${i}: missing or invalid url`);
      }

      // Validate identifier format (alphanumeric, hyphens, underscores - no spaces, max 32 chars)
      if (!/^[a-zA-Z0-9_-]+$/.test(server.identifier)) {
        throw new Error(
          `Invalid MCP server at index ${i}: identifier "${server.identifier}" must contain only letters, numbers, hyphens, or underscores (no spaces)`
        );
      }
      if (server.identifier.length > 32) {
        throw new Error(
          `Invalid MCP server at index ${i}: identifier "${server.identifier}" must be 32 characters or less (current: ${server.identifier.length})`
        );
      }
    }
  }

  // Validate restServers array if present
  if (typedConfig.restServers !== undefined) {
    if (!Array.isArray(typedConfig.restServers)) {
      throw new Error('Invalid providers configuration: restServers must be an array');
    }

    for (let i = 0; i < typedConfig.restServers.length; i++) {
      const server = typedConfig.restServers[i];
      if (!server || typeof server !== 'object' || Array.isArray(server)) {
        throw new Error(`Invalid REST server at index ${i}: must be an object`);
      }

      if (!server.identifier || typeof server.identifier !== 'string') {
        throw new Error(`Invalid REST server at index ${i}: missing or invalid identifier`);
      }
      if (!server.url || typeof server.url !== 'string') {
        throw new Error(`Invalid REST server at index ${i}: missing or invalid url`);
      }

      // Validate identifier format (alphanumeric, hyphens, underscores - no spaces, max 32 chars)
      if (!/^[a-zA-Z0-9_-]+$/.test(server.identifier)) {
        throw new Error(
          `Invalid REST server at index ${i}: identifier "${server.identifier}" must contain only letters, numbers, hyphens, or underscores (no spaces)`
        );
      }
      if (server.identifier.length > 32) {
        throw new Error(
          `Invalid REST server at index ${i}: identifier "${server.identifier}" must be 32 characters or less (current: ${server.identifier.length})`
        );
      }
    }
  }

  // Ensure at least one server type is provided if arrays exist
  const hasMcpServers = Array.isArray(typedConfig.mcpServers) && typedConfig.mcpServers.length > 0;
  const hasRestServers =
    Array.isArray(typedConfig.restServers) && typedConfig.restServers.length > 0;

  if (!hasMcpServers && !hasRestServers) {
    console.warn('⚠️ [ConfigHelper] No servers configured in providers list');
  }
}

/**
 * Validate agents configuration structure
 * @param config - The configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateAgentsConfig(config: unknown): asserts config is AgentsConfig {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Invalid agents configuration: must be a valid JSON object');
  }

  const typedConfig = config as AgentsConfig;

  if (!Array.isArray(typedConfig.agents)) {
    throw new Error('Invalid agents configuration: agents must be an array');
  }

  if (typedConfig.agents.length === 0) {
    throw new Error('Invalid agents configuration: at least one agent must be configured');
  }

  // Validate each agent
  for (let i = 0; i < typedConfig.agents.length; i++) {
    const agent = typedConfig.agents[i];

    if (!agent || typeof agent !== 'object' || Array.isArray(agent)) {
      throw new Error(`Invalid agent at index ${i}: must be an object`);
    }

    if (!agent.identifier || typeof agent.identifier !== 'string') {
      throw new Error(`Invalid agent at index ${i}: missing or invalid identifier`);
    }

    if (!agent.url || typeof agent.url !== 'string') {
      throw new Error(`Invalid agent at index ${i}: missing or invalid url`);
    }

    if (!agent.name || typeof agent.name !== 'string') {
      throw new Error(`Invalid agent at index ${i}: missing or invalid name`);
    }

    // Validate identifier format (alphanumeric, hyphens, underscores - no spaces, max 32 chars)
    if (!/^[a-zA-Z0-9_-]+$/.test(agent.identifier)) {
      throw new Error(
        `Invalid agent at index ${i}: identifier "${agent.identifier}" must contain only letters, numbers, hyphens, or underscores (no spaces)`
      );
    }
    if (agent.identifier.length > 32) {
      throw new Error(
        `Invalid agent at index ${i}: identifier "${agent.identifier}" must be 32 characters or less (current: ${agent.identifier.length})`
      );
    }
  }

  // Check for duplicate identifiers
  const identifiers = typedConfig.agents.map((agent) => agent.identifier);
  const duplicates = identifiers.filter((id, index) => identifiers.indexOf(id) !== index);
  if (duplicates.length > 0) {
    throw new Error(`Duplicate agent identifiers found: ${duplicates.join(', ')}`);
  }

  // Validate prompt fields if present
  if (typedConfig.basePrompt !== undefined && typeof typedConfig.basePrompt !== 'string') {
    throw new Error('Invalid agents configuration: basePrompt must be a string');
  }

  if (typedConfig.defaultPrompt !== undefined && typeof typedConfig.defaultPrompt !== 'string') {
    throw new Error('Invalid agents configuration: defaultPrompt must be a string');
  }
}
