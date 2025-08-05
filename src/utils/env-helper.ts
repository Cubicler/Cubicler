import type { JSONObject, JSONValue } from '../model/types.js';

/**
 * Expand environment variable references in config values
 * Supports ${VAR_NAME} syntax
 * @param value - The string that may contain environment variable placeholders
 * @returns The string with environment variables substituted
 * @throws Error if environment variable is not defined
 */
export function expandEnvVariable(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      throw new Error(`Environment variable ${varName} is not defined`);
    }
    return envValue;
  });
}

/**
 * Helper function to substitute environment variables in strings
 * Supports {{env.VARIABLE_NAME}} syntax
 * @param str - The string that may contain environment variable placeholders
 * @returns The string with environment variables substituted
 */
export function substituteEnvVars(_str: string): string;
export function substituteEnvVars(_str: JSONValue | undefined | null): JSONValue | undefined | null;
export function substituteEnvVars(str: JSONValue | undefined | null): JSONValue | undefined | null {
  if (typeof str !== 'string') {
    return str;
  }

  return str.replace(/\{\{env\.(\w+)\}\}/g, (match: string, envVar: string) => {
    const envValue = process.env[envVar];
    return envValue !== undefined ? envValue : match;
  });
}

/**
 * Helper function to get timeout value from environment variable with validation
 * @param envVar - The environment variable name
 * @param defaultValue - The default timeout value in milliseconds
 * @returns The timeout value in milliseconds
 * @throws Error if inputs are invalid
 */
export function getEnvTimeout(envVar: string, defaultValue: number): number {
  // Validate inputs early
  if (!envVar || typeof envVar !== 'string') {
    throw new Error('Environment variable name must be a non-empty string');
  }

  if (typeof defaultValue !== 'number' || defaultValue <= 0 || !isFinite(defaultValue)) {
    throw new Error('Default timeout value must be a positive finite number');
  }

  const value = process.env[envVar];
  if (!value) {
    return defaultValue;
  }

  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed <= 0) {
    console.warn(
      `⚠️ [EnvHelper] Invalid timeout value for ${envVar}: ${value}. Using default: ${defaultValue}ms`
    );
    return defaultValue;
  }

  return parsed;
}

/**
 * Helper function to get provider call timeout
 * @returns The provider call timeout in milliseconds (default: uses DEFAULT_CALL_TIMEOUT or 30 seconds)
 */
export function getProviderCallTimeout(): number {
  const defaultTimeout = getDefaultCallTimeout();
  return getEnvTimeout('PROVIDER_CALL_TIMEOUT', defaultTimeout);
}

/**
 * Helper function to get agent call timeout
 * @returns The agent call timeout in milliseconds (default: 3x DEFAULT_CALL_TIMEOUT)
 */
export function getAgentCallTimeout(): number {
  const defaultTimeout = getDefaultCallTimeout() * 3;
  return getEnvTimeout('AGENT_CALL_TIMEOUT', defaultTimeout);
}

/**
 * Helper function to get default call timeout (fallback for all other operations)
 * @returns The default call timeout in milliseconds (default: 30 seconds)
 */
export function getDefaultCallTimeout(): number {
  return getEnvTimeout('DEFAULT_CALL_TIMEOUT', 30000);
}

/**
 * Helper function to get configuration source URL with validation
 * @param envVar - The environment variable name
 * @param description - Description of what this configuration is for
 * @returns The configuration source (URL or file path)
 * @throws Error if the environment variable is not set or inputs are invalid
 */
export function getConfigurationSource(envVar: string, description: string): string {
  // Validate inputs early
  if (!envVar || typeof envVar !== 'string') {
    throw new Error('Environment variable name must be a non-empty string');
  }

  if (!description || typeof description !== 'string') {
    throw new Error('Description must be a non-empty string');
  }

  const source = process.env[envVar];
  if (!source || source.trim() === '') {
    throw new Error(
      `${envVar} environment variable is not defined. Please set it to a file path or URL for ${description}.`
    );
  }

  return source.trim();
}

/**
 * Helper function to get configuration loading timeout
 * @returns The configuration loading timeout in milliseconds (default: 10 seconds)
 */
export function getConfigLoadTimeout(): number {
  return getEnvTimeout('CUBICLER_CONFIG_TIMEOUT', 10000);
}

/**
 * Helper function to substitute environment variables in an object
 * @param obj - The object containing values that may have environment variable placeholders
 * @returns A new object with environment variables substituted
 * @throws Error if input is invalid
 */
export function substituteEnvVarsInObject<T extends JSONObject>(_obj: T): T;
export function substituteEnvVarsInObject(_obj: undefined): undefined;
export function substituteEnvVarsInObject<T extends JSONObject>(_obj: T | undefined): T | undefined;
export function substituteEnvVarsInObject<T extends JSONObject>(obj: T | undefined): T | undefined {
  if (!obj) {
    return obj;
  }

  if (typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error('Input must be a non-array object');
  }

  return processObjectProperties(obj);
}

/**
 * Process all properties of an object recursively
 * @param obj - Object to process
 * @returns New object with processed properties
 */
function processObjectProperties<T extends JSONObject>(obj: T): T {
  const result: JSONObject = {};

  for (const [key, value] of Object.entries(obj)) {
    result[key] = processValue(value);
  }

  return result as T;
}

/**
 * Process individual values recursively
 * @param value - Value to process
 * @returns Processed value
 */
function processValue(value: JSONValue): JSONValue {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return processArray(value);
  }

  if (typeof value === 'object') {
    return substituteEnvVarsInObject(value as JSONObject);
  }

  // Process primitive values (strings, numbers, booleans)
  const substituted = substituteEnvVars(value);
  return substituted !== undefined ? substituted : value;
}

/**
 * Process array values recursively
 * @param array - Array to process
 * @returns New array with processed values
 */
function processArray(array: JSONValue[]): JSONValue[] {
  return array.map((item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return substituteEnvVarsInObject(item as JSONObject);
    }

    const substituted = substituteEnvVars(item);
    return substituted !== undefined ? substituted : item;
  });
}
