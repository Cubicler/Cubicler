export interface ParameterDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  items?: ParameterDefinition;
  properties?: Record<string, ParameterDefinition>;
}

export interface PayloadDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  items?: PayloadDefinition;
  properties?: Record<string, PayloadDefinition>;
}

export interface EndpointSpec {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  headers?: Record<string, string>;
  parameters?: Record<string, ParameterDefinition>;
  payload?: PayloadDefinition;
}

export interface ServiceDefinition {
  base_url: string;
  default_headers?: Record<string, string>;
  endpoints: Record<string, EndpointSpec>;
}

export interface FunctionDefinition {
  service: string;
  endpoint: string;
  description: string;
  override_parameters?: Record<string, JSONValue>;
  override_payload?: JSONValue;
}

export interface ProviderDefinition {
  version: number;
  services: Record<string, ServiceDefinition>;
  functions: Record<string, FunctionDefinition>;
}

export interface ProcessedEndpoint extends EndpointSpec {
  base_url: string;
  headers: Record<string, string>;
}

export interface FunctionSpec {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ParameterDefinition>;
    required?: string[];
  };
}

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

export type JSONPrimitive = string | number | boolean | null;

export type JSONValue = JSONPrimitive | JSONObject | JSONArray;

export interface JSONObject {
  [key: string]: JSONValue;
}

export interface JSONArray extends Array<JSONValue> {}

export type FunctionCallResult = JSONValue;

export interface FunctionCallParameters extends JSONObject {
  payload?: JSONValue;
}

export interface Agent {
  name: string;
  endpoints: string;
}

export interface Provider {
  name: string;
  description: string;
  spec_source: string; // URL to spec file
  context_source: string; // URL to context file
}

export interface AgentsList {
  version: number;
  kind: "agents";
  agents: Agent[];
}

export interface ProvidersList {
  version: number;
  kind: "providers";
  providers: Provider[];
}

export interface ProviderSpecResponse {
  context: string;
  functions: FunctionSpec[];
}

// Re-export Cache utilities for convenience
export { Cache, createEnvCache } from './cache.js';
