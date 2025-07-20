/**
 * Helper function to substitute environment variables in strings
 * @param str - The string that may contain environment variable placeholders
 * @returns The string with environment variables substituted
 */
export function substituteEnvVars(str: string): string;
export function substituteEnvVars(str: any): any;
export function substituteEnvVars(str: any): any {
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
 * Helper function to substitute environment variables in an object
 * @param obj - The object containing values that may have environment variable placeholders
 * @returns A new object with environment variables substituted
 */
export function substituteEnvVarsInObject<T extends Record<string, any>>(obj: T): T;
export function substituteEnvVarsInObject(obj: undefined): undefined;
export function substituteEnvVarsInObject<T extends Record<string, any>>(obj: T | undefined): T | undefined;
export function substituteEnvVarsInObject<T extends Record<string, any>>(obj: T | undefined): T | undefined {
  if (!obj) return obj;
  
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = substituteEnvVars(value);
  }
  return result as T;
}
