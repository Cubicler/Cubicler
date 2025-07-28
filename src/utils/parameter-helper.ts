import { ToolCallParameters } from '../model/tools.js';
import type { JSONValue } from '../model/types.js';

/**
 * Parse function name in the format "server_identifier.function_name"
 * @param functionName - The full function name
 * @returns Object with server identifier and function name
 */
export function parseFunctionName(functionName: string): {
  serverIdentifier: string;
  functionName: string;
} {
  const parts = functionName.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(
      `Invalid function name format: ${functionName}. Expected format: server_identifier.function_name`
    );
  }

  return {
    serverIdentifier: parts[0],
    functionName: parts[1],
  };
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
