import { createHash } from 'crypto';
import { ToolCallParameters } from '../model/tools.js';
import type { JSONValue } from '../model/types.js';

/**
 * Convert any naming convention to snake_case
 * Handles: camelCase, PascalCase, kebab-case, spaced case, mixed cases
 * @param str - The string to convert
 * @returns snake_case string
 */
export function toSnakeCase(str: string): string {
  if (!str || typeof str !== 'string') {
    return str || '';
  }
  return (
    str
      // Handle spaced case
      .replace(/\s+/g, '_')
      // Handle kebab-case
      .replace(/-/g, '_')
      // Handle camelCase and PascalCase
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      // Handle consecutive uppercase letters (like XMLHttpRequest)
      .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
      .toLowerCase()
      // Clean up multiple underscores
      .replace(/_+/g, '_')
      // Remove leading/trailing underscores
      .replace(/^_|_$/g, '')
  );
}

/**
 * Generate a collision-resistant hash for server identification
 * Uses SHA-256 hash with base36 encoding for compact representation
 * @param serverIdentifier - Server identifier from configuration
 * @param serverUrl - Server URL from configuration
 * @returns 6-character base36 encoded hash
 */
export function generateServerHash(serverIdentifier: string, serverUrl: string): string {
  // Create deterministic input by combining identifier and URL
  const input = `${serverIdentifier}:${serverUrl}`;

  // Generate SHA-256 hash
  const hash = createHash('sha256').update(input).digest('hex');

  // Convert first 32 bits (8 hex chars) to base36 for compact representation
  const hashNum = parseInt(hash.substring(0, 8), 16);
  const base36Hash = hashNum.toString(36);

  // Pad to 6 characters with leading zeros if needed
  return base36Hash.padStart(6, '0');
}

/**
 * Generate function name using server hash and snake_case pattern
 * @param serverIdentifier - Server identifier from configuration
 * @param serverUrl - Server URL from configuration
 * @param functionName - Function name (will be converted to snake_case)
 * @returns Function name in format "{hash}_{snake_case_function}"
 */
export function generateFunctionName(
  serverIdentifier: string,
  serverUrl: string,
  functionName: string
): string {
  const serverHash = generateServerHash(serverIdentifier, serverUrl);
  const snakeCaseFunction = toSnakeCase(functionName);
  return `${serverHash}_${snakeCaseFunction}`;
}

/**
 * Parse a function name to extract server hash and function name
 * @param functionName - The function name in format {hash}_{snake_case_function}
 * @returns Object with serverHash and functionName
 * @throws Error if function name format is invalid
 */
export function parseFunctionName(functionName: string): {
  serverHash: string;
  functionName: string;
} {
  // Hash can be 1-7 base36 characters (from 32-bit number), function should be snake_case
  const match = functionName.match(/^([a-z0-9]{1,7})(_[a-z0-9]+)+$/);
  if (!match || !match[1] || !match[2]) {
    throw new Error(
      `Invalid function name format: ${functionName}. Expected format: {hash}_{snake_case_function}`
    );
  }

  const serverHash = match[1];
  const snakeCaseFunction = match[2];

  return {
    serverHash,
    functionName: snakeCaseFunction,
  };
}

/**
 * Generate internal Cubicler function name
 * @param functionName - Function name (will be converted to snake_case)
 * @returns Function name in format "cubicler_{snake_case_function}"
 */
export function generateInternalFunctionName(functionName: string): string {
  const snakeCaseFunction = toSnakeCase(functionName);
  return `cubicler_${snakeCaseFunction}`;
}

/**
 * Extract path parameters from a path template and parameter values
 * @param pathTemplate - Path with {paramName} placeholders
 * @param parameters - Parameter values
 * @returns Object with extracted path parameters and remaining parameters
 */
export function extractPathParameters(
  path: string,
  parameters: ToolCallParameters
): { pathParams: Record<string, string>; remainingParams: Record<string, JSONValue> } {
  const pathParams: Record<string, string> = {};
  const remainingParams: Record<string, JSONValue> = { ...parameters };

  // Find all {paramName} patterns in the path
  const pathParamMatches = path.match(/\{(\w+)\}/g);

  if (pathParamMatches) {
    for (const match of pathParamMatches) {
      const paramName = match.slice(1, -1); // Remove { and }

      if (paramName in parameters) {
        pathParams[paramName] = String(parameters[paramName]);
        delete remainingParams[paramName];
      }
    }
  }

  return { pathParams, remainingParams };
}

/**
 * Replace path parameters in a URL template
 * @param pathTemplate - URL template with {param} placeholders
 * @param pathParams - Object with parameter values
 * @returns URL with parameters replaced
 */
export function replacePathParameters(
  pathTemplate: string,
  pathParams: Record<string, string>
): string {
  let result = pathTemplate;

  for (const [paramName, paramValue] of Object.entries(pathParams)) {
    result = result.replace(`{${paramName}}`, encodeURIComponent(paramValue));
  }

  return result;
}

/**
 * Convert parameters to query string format
 * @param params - Parameters to convert
 * @returns Query string parameters
 */
export function convertToQueryParams(params: Record<string, JSONValue>): Record<string, string> {
  const queryParams: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) {
      continue; // Skip null/undefined values
    }

    if (Array.isArray(value)) {
      // Handle arrays
      if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
        // Array of objects - JSON stringify
        queryParams[key] = JSON.stringify(value);
      } else {
        // Array of primitives - comma-separated
        queryParams[key] = value.map((v) => String(v)).join(',');
      }
    } else if (typeof value === 'object') {
      // Object - JSON stringify
      queryParams[key] = JSON.stringify(value);
    } else {
      // Primitive - convert to string
      queryParams[key] = String(value);
    }
  }

  return queryParams;
}

/**
 * Build complete URL with path and query parameters
 * @param baseUrl - Base URL
 * @param pathTemplate - Path template with {param} placeholders
 * @param pathParams - Path parameters
 * @param queryParams - Query parameters
 * @returns Complete URL
 */
export function buildUrl(
  baseUrl: string,
  pathTemplate: string,
  pathParams: Record<string, string>,
  queryParams: Record<string, string>
): string {
  // Replace path parameters
  const path = replacePathParameters(pathTemplate, pathParams);

  // Build base URL by combining base URL and path properly
  const baseUrlObj = new URL(baseUrl);
  const combinedPath = baseUrlObj.pathname.replace(/\/$/, '') + path;
  baseUrlObj.pathname = combinedPath;

  // Add query parameters
  for (const [key, value] of Object.entries(queryParams)) {
    baseUrlObj.searchParams.set(key, value);
  }

  return baseUrlObj.toString();
}
