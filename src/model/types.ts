import { AgentFunctionDefinition } from './definitions.js';

/**
 * System health status including individual service statuses
 */
export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    prompt?: {
      status: 'healthy' | 'unhealthy';
      error?: string;
    };
    spec?: {
      status: 'healthy' | 'unhealthy';
      error?: string;
    };
  };
}

/**
 * JSON primitive value types
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
 * Result type for function call execution - can be any JSON value
 */
export type FunctionCallResult = JSONValue;

/**
 * Parameters passed to function calls, extending JSON object with optional payload
 */
export interface FunctionCallParameters extends JSONObject {
  payload?: JSONValue;
}

/**
 * AI agent configuration with name and endpoints
 */
export interface Agent {
  name: string;
  endpoints: string;
}

/**
 * Provider configuration with name, description, and source URLs
 */
export interface Provider {
  name: string;
  description: string;
  spec_source: string; // URL to spec file
  context_source: string; // URL to context file
}

/**
 * List of available AI agents from agents.yaml configuration
 */
export interface AgentsList {
  version: number;
  kind: "agents";
  agents: Agent[];
}

/**
 * List of available providers from providers.yaml configuration
 */
export interface ProvidersList {
  version: number;
  kind: "providers";
  providers: Provider[];
}

/**
 * Response format for provider spec endpoints containing context and functions
 */
export interface ProviderSpecResponse {
  context: string;
  functions: AgentFunctionDefinition[];
}

/**
 * Result of parsing a function name to extract provider and function parts
 * Used by parseFunctionName and parseProviderFunction utilities
 */
export interface ParsedFunctionName {
  providerName?: string;
  originalFunctionName: string;
}

// Re-export Cache utilities for convenience
export { Cache, createEnvCache } from '../utils/cache.js';
