import type { JSONObject, JSONValue } from '../model/types.js';

/**
 * Helper function to substitute environment variables in strings
 * @param str - The string that may contain environment variable placeholders
 * @returns The string with environment variables substituted
 */
export function substituteEnvVars(_str: string): string;
export function substituteEnvVars(_str: JSONValue | undefined | null): JSONValue | undefined | null;
export function substituteEnvVars(str: JSONValue | undefined | null): JSONValue | undefined | null {
  if (typeof str !== 'string') return str;
  return str.replace(/\{\{env\.(\w+)\}\}/g, (match: string, envVar: string) => {
    return process.env[envVar] || match;
  });
}

/**
 * Helper function to get timeout value from environment variable
 * @param envVar - The environment variable name
 * @param defaultValue - The default timeout value in milliseconds
 * @returns The timeout value in milliseconds
 */
export function getEnvTimeout(envVar: string, defaultValue: number): number {
  const value = process.env[envVar];
  if (!value) return defaultValue;

  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed <= 0) {
    console.warn(`Invalid timeout value for ${envVar}: ${value}. Using default: ${defaultValue}ms`);
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
 * @throws Error if the environment variable is not set
 */
export function getConfigurationSource(envVar: string, description: string): string {
  const source = process.env[envVar];
  if (!source || source.trim() === '') {
    throw new Error(
      `${envVar} environment variable is not defined. Please set it to a file path or URL for ${description}.`
    );
  }
  return source.trim();
}

/**
 * Helper function to validate if a string is a valid URL
 * @param str - The string to validate
 * @returns true if the string is a valid URL
 */
export function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
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
 */
export function substituteEnvVarsInObject<T extends JSONObject>(_obj: T): T;
export function substituteEnvVarsInObject(_obj: undefined): undefined;
export function substituteEnvVarsInObject<T extends JSONObject>(_obj: T | undefined): T | undefined;
export function substituteEnvVarsInObject<T extends JSONObject>(obj: T | undefined): T | undefined {
  if (!obj) return obj;

  const result: JSONObject = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      result[key] = value;
    } else if (Array.isArray(value)) {
      // Recursively process arrays
      result[key] = value.map((item) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          return substituteEnvVarsInObject(item as JSONObject);
        }
        const substituted = substituteEnvVars(item);
        return substituted !== undefined ? substituted : item;
      });
    } else if (typeof value === 'object') {
      // Recursively process nested objects
      result[key] = substituteEnvVarsInObject(value as JSONObject);
    } else {
      // Process primitive values (strings, numbers, booleans)
      const substituted = substituteEnvVars(value);
      result[key] = substituted !== undefined ? substituted : value;
    }
  }
  return result as T;
}
