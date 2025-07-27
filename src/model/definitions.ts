import { JSONValue } from './types';

/**
 * Defines the structure and validation rules for a parameter in an API endpoint
 */
export interface ParameterDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  items?: ParameterDefinition;
  properties?: Record<string, ParameterDefinition>;
}
/**
 * Defines the structure and validation rules for request payloads in API endpoints
 */

export interface PayloadDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  items?: PayloadDefinition;
  properties?: Record<string, PayloadDefinition>;
}
/**
 * Defines an API endpoint with its HTTP method, path, headers, parameters and payload
 */

export interface EndpointDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  headers?: Record<string, string>;
  parameters?: Record<string, ParameterDefinition>;
  payload?: PayloadDefinition;
}
/**
 * Defines a service with its base URL, default headers, and collection of endpoints
 */

export interface ServiceDefinition {
  base_url: string;
  default_headers?: Record<string, string>;
  endpoints: Record<string, EndpointDefinition>;
}
/**
 * Defines a function that maps to a specific service endpoint with optional parameter/payload overrides
 */

export interface FunctionDefinition {
  service: string;
  endpoint: string;
  description: string;
  override_parameters?: Record<string, JSONValue>;
  override_payload?: JSONValue;
}
/**
 * Complete provider definition containing services and functions
 * This is the main configuration structure loaded from YAML spec files
 */

export interface ProviderDefinition {
  version: number;
  services: Record<string, ServiceDefinition>;
  functions: Record<string, FunctionDefinition>;
}
/**
 * Processed endpoint with resolved base URL and headers for execution
 */

export interface FullEndpointDefinition extends EndpointDefinition {
  base_url: string;
  headers: Record<string, string>;
} /**
 * Function specification for AI agents - contains flattened parameters from endpoint definition
 */

export interface AgentFunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ParameterDefinition>;
    required?: string[];
  };
}
