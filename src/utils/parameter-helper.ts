import { createHash } from 'crypto';
import { ToolCallParameters } from '../model/tools.js';
import type { JSONValue } from '../model/types.js';

/**
 * Convert any naming convention to snake_case
 * Handles: camelCase, PascalCase, kebab-case, spaced case, mixed cases
 * @param str - The string to convert
 * @returns snake_case string
 * @throws Error if input is invalid
 */
export function toSnakeCase(str: string): string {
  if (typeof str !== 'string') {
    throw new Error('Input must be a string');
  }

  if (str === '') {
    return '';
  }

  return normalizeToSnakeCase(str);
}

/**
 * Generate a collision-resistant hash for server identification
 * Uses SHA-256 hash with base36 encoding for compact representation
 * @param serverIdentifier - Server identifier from configuration
 * @param serverUrl - Server URL from configuration
 * @returns 6-character base36 encoded hash
 * @throws Error if inputs are invalid
 */
export function generateServerHash(serverIdentifier: string, serverUrl: string): string {
  validateServerIdentifier(serverIdentifier);
  validateServerUrl(serverUrl);

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
 * @throws Error if inputs are invalid
 */
export function generateFunctionName(
  serverIdentifier: string,
  serverUrl: string,
  functionName: string
): string {
  if (!functionName || typeof functionName !== 'string') {
    throw new Error('Function name must be a non-empty string');
  }

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
  if (!functionName || typeof functionName !== 'string') {
    throw new Error('Invalid function name format: Function name must be a non-empty string');
  }

  const parsed = parseNameComponents(functionName);
  if (!parsed) {
    throw new Error(
      `Invalid function name format: ${functionName}. Expected format: {hash}_{snake_case_function}`
    );
  }

  return parsed;
}

/**
 * Generate internal Cubicler function name
 * @param functionName - Function name (will be converted to snake_case)
 * @returns Function name in format "cubicler_{snake_case_function}"
 * @throws Error if input is invalid
 */
export function generateInternalFunctionName(functionName: string): string {
  if (!functionName || typeof functionName !== 'string') {
    throw new Error('Function name must be a non-empty string');
  }

  const snakeCaseFunction = toSnakeCase(functionName);
  return `cubicler_${snakeCaseFunction}`;
}

/**
 * Extract path parameters from a path template and parameter values
 * @param pathTemplate - Path with {paramName} placeholders
 * @param parameters - Parameter values
 * @returns Object with extracted path parameters and remaining parameters
 * @throws Error if inputs are invalid
 */
export function extractPathParameters(
  pathTemplate: string,
  parameters: ToolCallParameters
): { pathParams: Record<string, string>; remainingParams: Record<string, JSONValue> } {
  if (!pathTemplate || typeof pathTemplate !== 'string') {
    throw new Error('Path template must be a non-empty string');
  }

  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    throw new Error('Parameters must be a non-array object');
  }

  const pathParams: Record<string, string> = {};
  const remainingParams: Record<string, JSONValue> = { ...parameters };

  // Find all {paramName} patterns in the path
  const pathParamMatches = pathTemplate.match(/\{(\w+)\}/g);

  if (pathParamMatches) {
    extractMatchedParameters(pathParamMatches, parameters, pathParams, remainingParams);
  }

  return { pathParams, remainingParams };
}

/**
 * Replace path parameters in a URL template
 * @param pathTemplate - URL template with {param} placeholders
 * @param pathParams - Object with parameter values
 * @returns URL with parameters replaced
 * @throws Error if inputs are invalid
 */
export function replacePathParameters(
  pathTemplate: string,
  pathParams: Record<string, string>
): string {
  if (!pathTemplate || typeof pathTemplate !== 'string') {
    throw new Error('Path template must be a non-empty string');
  }

  if (!pathParams || typeof pathParams !== 'object' || Array.isArray(pathParams)) {
    throw new Error('Path parameters must be a non-array object');
  }

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
 * @throws Error if input is invalid
 */
export function convertToQueryParams(params: Record<string, JSONValue>): Record<string, string> {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new Error('Parameters must be a non-array object');
  }

  const queryParams: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    const converted = convertSingleValue(value);
    if (converted !== null) {
      queryParams[key] = converted;
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
 * @throws Error if inputs are invalid
 */
export function buildUrl(
  baseUrl: string,
  pathTemplate: string,
  pathParams: Record<string, string>,
  queryParams: Record<string, string>
): string {
  validateBuildUrlInputs(baseUrl, pathTemplate, pathParams, queryParams);

  try {
    // Replace path parameters
    const path = replacePathParameters(pathTemplate, pathParams);

    // Build base URL by combining base URL and path properly
    const baseUrlObj = new URL(baseUrl);
    const combinedPath = combineUrlPaths(baseUrlObj.pathname, path);
    baseUrlObj.pathname = combinedPath;

    // Add query parameters
    addQueryParametersToUrl(baseUrlObj, queryParams);

    return baseUrlObj.toString();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to build URL: ${errorMessage}`);
  }
}

/**
 * Normalize string to snake_case format
 * @param str - String to normalize
 * @returns Normalized snake_case string
 */
function normalizeToSnakeCase(str: string): string {
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
 * Validate server identifier
 * @param identifier - Identifier to validate
 * @throws Error if identifier is invalid
 */
function validateServerIdentifier(identifier: string): void {
  if (!identifier || typeof identifier !== 'string') {
    throw new Error('Server identifier must be a non-empty string');
  }
}

/**
 * Validate server URL
 * @param url - URL to validate
 * @throws Error if URL is invalid
 */
function validateServerUrl(url: string): void {
  if (!url || typeof url !== 'string') {
    throw new Error('Server URL must be a non-empty string');
  }
}

/**
 * Parse function name components
 * @param functionName - Function name to parse
 * @returns Parsed components or null if invalid
 */
function parseNameComponents(
  functionName: string
): { serverHash: string; functionName: string } | null {
  // Hash can be 1-7 base36 characters (from 32-bit number), function should be snake_case
  const match = functionName.match(/^([a-z0-9]{1,7})_(.+)$/);

  if (!match || !match[1] || !match[2]) {
    return null;
  }

  // Validate that the function name part looks like snake_case
  const functionPart = match[2];
  if (!/^[a-z0-9_]+$/.test(functionPart)) {
    return null;
  }

  return {
    serverHash: match[1],
    functionName: functionPart,
  };
}

/**
 * Extract matched parameters from path template
 * @param matches - Array of matched parameter patterns
 * @param parameters - Source parameters
 * @param pathParams - Target path parameters object
 * @param remainingParams - Target remaining parameters object
 */
function extractMatchedParameters(
  matches: string[],
  parameters: ToolCallParameters,
  pathParams: Record<string, string>,
  remainingParams: Record<string, JSONValue>
): void {
  for (const match of matches) {
    const paramName = match.slice(1, -1); // Remove { and }

    if (paramName in parameters) {
      pathParams[paramName] = String(parameters[paramName]);
      delete remainingParams[paramName];
    }
  }
}

/**
 * Convert a single value to query parameter string
 * @param value - Value to convert
 * @returns Converted string or null if value should be skipped
 */
function convertSingleValue(value: JSONValue): string | null {
  if (value === null || value === undefined) {
    return null; // Skip null/undefined values
  }

  if (Array.isArray(value)) {
    return convertArrayValue(value);
  }

  if (typeof value === 'object') {
    // Object - JSON stringify
    return JSON.stringify(value);
  }

  // Primitive - convert to string
  return String(value);
}

/**
 * Convert array value to query parameter string
 * @param array - Array to convert
 * @returns Converted string
 */
function convertArrayValue(array: JSONValue[]): string {
  if (array.length > 0 && typeof array[0] === 'object' && array[0] !== null) {
    // Array of objects - JSON stringify
    return JSON.stringify(array);
  }

  // Array of primitives - comma-separated
  return array.map((v) => String(v)).join(',');
}

/**
 * Validate inputs for buildUrl function
 * @param baseUrl - Base URL to validate
 * @param pathTemplate - Path template to validate
 * @param pathParams - Path parameters to validate
 * @param queryParams - Query parameters to validate
 * @throws Error if any input is invalid
 */
function validateBuildUrlInputs(
  baseUrl: string,
  pathTemplate: string,
  pathParams: Record<string, string>,
  queryParams: Record<string, string>
): void {
  if (!baseUrl || typeof baseUrl !== 'string') {
    throw new Error('Base URL must be a non-empty string');
  }

  if (!pathTemplate || typeof pathTemplate !== 'string') {
    throw new Error('Path template must be a non-empty string');
  }

  if (!pathParams || typeof pathParams !== 'object' || Array.isArray(pathParams)) {
    throw new Error('Path parameters must be a non-array object');
  }

  if (!queryParams || typeof queryParams !== 'object' || Array.isArray(queryParams)) {
    throw new Error('Query parameters must be a non-array object');
  }
}

/**
 * Combine URL paths properly
 * @param basePath - Base path from URL
 * @param additionalPath - Additional path to append
 * @returns Combined path
 */
function combineUrlPaths(basePath: string, additionalPath: string): string {
  const cleanBasePath = basePath.replace(/\/$/, '');
  return cleanBasePath + additionalPath;
}

/**
 * Add query parameters to URL object
 * @param urlObj - URL object to modify
 * @param queryParams - Query parameters to add
 */
function addQueryParametersToUrl(urlObj: URL, queryParams: Record<string, string>): void {
  for (const [key, value] of Object.entries(queryParams)) {
    urlObj.searchParams.set(key, value);
  }
}
