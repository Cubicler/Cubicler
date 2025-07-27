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
 * Helper function to get boolean value from environment variable
 * @param envVar - The environment variable name
 * @param defaultValue - The default value if environment variable is not set
 * @returns The boolean value
 */
export function getEnvBoolean(envVar: string, defaultValue: boolean = false): boolean {
  const value = process.env[envVar];
  if (!value) return defaultValue;

  const lowerValue = value.toLowerCase();
  return lowerValue === 'true' || lowerValue === '1';
}

/**
 * Helper function to check if strict parameter validation is enabled
 * @returns true if strict parameter validation is enabled
 */
export function isStrictParamsEnabled(): boolean {
  return getEnvBoolean('CUBICLER_STRICT_PARAMS', false);
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
    const substituted = substituteEnvVars(value);
    if (substituted !== undefined) {
      // Keep null values but filter out undefined
      result[key] = substituted;
    }
  }
  return result as T;
}
