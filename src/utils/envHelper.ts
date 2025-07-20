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
