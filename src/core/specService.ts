import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import { config } from 'dotenv';
import { substituteEnvVars, substituteEnvVarsInObject } from '../utils/envHelper.js';
import type { 
  CubiclerSpec, 
  FunctionDefinition, 
  ProcessedEndpoint, 
  FunctionSpec,
  JSONValue
} from '../utils/types.js';

config();

/**
 * Internal function to load and parse the YAML spec
 * @returns Promise that resolves to the parsed spec
 * @throws Error if spec source is not defined or fetch/parse fails
 */
async function _getSpec(): Promise<CubiclerSpec> {
  const specSource = process.env.CUBICLER_SPEC_SOURCE;
  if (!specSource) {
    throw new Error('CUBICLER_SPEC_SOURCE is not defined in environment variables');
  }

  let yamlText: string;
  
  if (specSource.startsWith('http')) {
    const response = await fetch(specSource);
    if (!response.ok) {
      throw new Error(`Failed to fetch spec: ${response.statusText}`);
    }
    yamlText = await response.text();
  } else {
    yamlText = readFileSync(specSource, 'utf-8');
  }
  
  const spec = load(yamlText) as CubiclerSpec;
  if (!spec || typeof spec !== 'object') {
    throw new Error('Invalid YAML spec format');
  }
  
  return spec;
}

/**
 * Gets the list of functions formatted for AI agent function calling
 * @returns Promise that resolves to an array of function specs
 */
async function getFunctions(): Promise<FunctionSpec[]> {
  const spec = await _getSpec();
  
  return Object.entries(spec.functions).map(([name, details]) => {
    const service = spec.services[details.service];
    if (!service) {
      throw new Error(`Service ${details.service} not found in spec`);
    }
    
    const endpoint = service.endpoints[details.endpoint];
    if (!endpoint) {
      throw new Error(`Endpoint ${details.endpoint} not found in service ${details.service}`);
    }

    const parameters: FunctionSpec['parameters'] = {
      type: 'object',
      properties: { ...endpoint.parameters },
    };

    // Add payload as a flattened parameter named "payload"
    if (endpoint.payload) {
      parameters.properties.payload = endpoint.payload;
    }

    // Remove override parameters from AI function spec
    if (details.override_parameters) {
      Object.keys(details.override_parameters).forEach(key => {
        if (parameters.properties[key]) {
          delete parameters.properties[key];
        }
      });
    }

    // Remove override payload from AI function spec
    if (details.override_payload && parameters.properties.payload) {
      delete parameters.properties.payload;
    }

    return {
      name,
      description: details.description,
      parameters,
    };
  });
}

/**
 * Gets a specific function definition by name
 * @param functionName - The name of the function to retrieve
 * @returns Promise that resolves to the function spec
 * @throws Error if function is not found
 */
async function getFunction(functionName: string): Promise<FunctionDefinition> {
  const spec = await _getSpec();
  const functionSpec = spec.functions[functionName];
  if (!functionSpec) {
    throw new Error(`Function ${functionName} not found in spec`);
  }
  return functionSpec;
}

/**
 * Gets the processed endpoint configuration for a function
 * @param func - The function specification
 * @returns Promise that resolves to the processed endpoint with base URL and headers
 * @throws Error if service or endpoint is not found
 */
async function getEndpoint(func: FunctionDefinition): Promise<ProcessedEndpoint> {
  const spec = await _getSpec();
  const service = spec.services[func.service];
  if (!service) {
    throw new Error(`Service ${func.service} not found in spec`);
  }

  const endpoint = service.endpoints[func.endpoint];
  if (!endpoint) {
    throw new Error(`Endpoint ${func.endpoint} not found in service ${func.service}`);
  }

  const processedBaseUrl = substituteEnvVars(service.base_url);
  
  const mergedHeaders = {
    ...(service.default_headers || {}),
    ...(endpoint.headers || {}),
  };
  const processedHeaders = substituteEnvVarsInObject(mergedHeaders);

  return { 
    ...endpoint, 
    base_url: processedBaseUrl, 
    headers: processedHeaders 
  };
}

/**
 * Gets the override parameters for a function (parameters hidden from AI)
 * @param functionName - The name of the function
 * @returns Promise that resolves to the override parameters object
 */
async function getOverrideParameters(functionName: string): Promise<Record<string, JSONValue>> {
  const spec = await _getSpec();
  const func = spec.functions[functionName];
  if (!func || !func.override_parameters) return {};
  
  return substituteEnvVarsInObject(func.override_parameters);
}

/**
 * Gets the override payload for a function (payload hidden from AI)
 * @param functionName - The name of the function
 * @returns Promise that resolves to the override payload
 */
async function getOverridePayload(functionName: string): Promise<JSONValue | undefined> {
  const spec = await _getSpec();
  const func = spec.functions[functionName];
  if (!func || !func.override_payload) return undefined;
  
  // For payload, we need to handle different types
  if (typeof func.override_payload === 'object' && func.override_payload !== null && !Array.isArray(func.override_payload)) {
    return substituteEnvVarsInObject(func.override_payload);
  } else {
    return func.override_payload;
  }
}

export default { getFunctions, getFunction, getEndpoint, getOverrideParameters, getOverridePayload };
