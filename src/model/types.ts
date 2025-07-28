/**
 * Base JSON type that can be serialized/deserialized
 */
export type JSONPrimitive = string | number | boolean | null;

/**
 * Any valid JSON value including objects and arrays
 */
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;

/**
 * JSON object with string keys and JSON values
 */
export interface JSONObject {
  [key: string]: JSONValue;
}

/**
 * JSON array containing JSON values
 */
export interface JSONArray extends Array<JSONValue> {}

/**
 * System health status with service checks
 */
export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  service?: string;
  version?: string;
  services: {
    agents?: {
      status: 'healthy' | 'unhealthy';
      error?: string;
      count?: number;
      agents?: string[];
    };
    providers?: {
      status: 'healthy' | 'unhealthy';
      error?: string;
      count?: number;
      servers?: string[];
    };
    mcp?: {
      status: 'healthy' | 'unhealthy';
      error?: string;
    };
  };
}

// ===== Provider types are now in providers.ts =====
// Import provider types: MCPServer, RESTServer, RESTEndpoint, ProvidersConfig
// from './providers.js'

// ===== MCP Protocol =====

/**
 * MCP protocol request/response types
 * Following MCP specification
 */
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: JSONObject;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: JSONValue;
  error?: {
    code: number;
    message: string;
    data?: JSONValue;
  };
}

// ===== Cache utilities (re-export from existing) =====
export { Cache, createEnvCache } from '../utils/cache.js';
