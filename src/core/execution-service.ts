import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import providerService from './provider-service.js';
import { 
  validateAndConvertParameters, 
  validateAndConvertPayload, 
  convertParametersForQuery 
} from '../utils/parameter-helper.js';
import { parseFunctionName, parseProviderFunction } from '../utils/definition-helper.js';
import { substituteEnvVars, substituteEnvVarsInObject } from '../utils/env-helper.js';
import { fetchWithProviderTimeout } from '../utils/fetch-helper.js';
import type { 
  FunctionCallParameters, 
  FunctionCallResult, 
  ParsedFunctionName} from '../model/types.js';
import type {
  ProviderDefinition,
  FunctionDefinition, ServiceDefinition,
  EndpointDefinition
} from '../model/definitions.js';

/**
 * Executes a provider function by name using the providerName_functionName convention
 * @param functionName - The full function name (e.g., "weather_api.getWeather")
 * @param parameters - The parameters to pass to the function
 * @returns Promise that resolves to the function call result
 * @throws Error if function is not found or call fails
 */
async function executeFunction(
  functionName: string, 
  parameters: FunctionCallParameters
): Promise<FunctionCallResult> {
  const availableProviders = await providerService.getProviders();
  const providerNames = availableProviders.map(p => p.name);
  
  const { providerName, originalFunctionName } = parseProviderFunction(functionName, providerNames);
  
  if (!providerName) {
    throw new Error(`Invalid function name format. Expected 'provider.function', got '${functionName}'`);
  }

  const provider = availableProviders.find(p => p.name === providerName);
  
  if (!provider) {
    throw new Error(`Provider '${providerName}' not found`);
  }

  const providerDefinition = await loadProviderDefinition(provider.spec_source);
  
  const functionDef = providerDefinition.functions[originalFunctionName];
  if (!functionDef) {
    throw new Error(`Function '${originalFunctionName}' not found in provider '${providerName}'`);
  }

  const service = providerDefinition.services[functionDef.service];
  if (!service) {
    throw new Error(`Service '${functionDef.service}' not found in provider '${providerName}'`);
  }

  const endpoint = service.endpoints[functionDef.endpoint];
  if (!endpoint) {
    throw new Error(`Endpoint '${functionDef.endpoint}' not found in service '${functionDef.service}'`);
  }

  const processedEndpoint = processEndpoint(service, endpoint);

  return await callProviderFunction(functionDef, processedEndpoint, parameters);
}

/**
 * Load and parse a provider definition from URL or file
 */
async function loadProviderDefinition(specUrl: string): Promise<ProviderDefinition> {
  let yamlText: string;
  
  if (specUrl.startsWith('http')) {
    try {
      const response = await fetchWithProviderTimeout(specUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch provider spec: ${response.statusText}`);
      }
      yamlText = await response.text();
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new Error(`Provider spec fetch timeout: ${error.message}`);
      }
      throw error;
    }
  } else {
    yamlText = readFileSync(specUrl, 'utf-8');
  }
  
  const spec = load(yamlText) as ProviderDefinition;
  if (!spec || typeof spec !== 'object') {
    throw new Error('Invalid provider spec YAML format');
  }
  
  return spec;
}

/**
 * Process endpoint configuration (substitute env vars, merge headers)
 */
function processEndpoint(service: ServiceDefinition, endpoint: EndpointDefinition) {
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
 * Execute the actual provider function call
 */
async function callProviderFunction(
  functionDef: FunctionDefinition,
  endpointDef: EndpointDefinition & { base_url: string; headers: Record<string, string> },
  parameters: FunctionCallParameters
): Promise<FunctionCallResult> {
  const overrideParameters = functionDef.override_parameters || {};
  const overridePayload = functionDef.override_payload;
  
  let url = `${endpointDef.base_url}${endpointDef.path}`;
  
  const { payload, ...urlParameters } = parameters;
  
  const validatedUrlParameters = validateAndConvertParameters(urlParameters, endpointDef.parameters);
  const validatedOverrideParameters = validateAndConvertParameters(overrideParameters, endpointDef.parameters);
  
  // Merge URL parameters with overrides (overrides take precedence)
  const allUrlParameters = { ...validatedUrlParameters, ...validatedOverrideParameters };
  
  let finalPayload = payload;
  if (endpointDef.payload) {
    if (payload !== undefined) {
      finalPayload = validateAndConvertPayload(payload, endpointDef.payload);
    }
    
    if (overridePayload !== undefined) {
      if (endpointDef.payload?.type === 'object' && 
          typeof finalPayload === 'object' && finalPayload !== null && !Array.isArray(finalPayload) &&
          typeof overridePayload === 'object' && overridePayload !== null && !Array.isArray(overridePayload)) {
        finalPayload = { ...finalPayload, ...overridePayload };
      } else {
        finalPayload = overridePayload;
      }
    }
  }
  
  // Replace path parameters
  const pathParams: string[] = [];
  url = url.replace(/{(\w+)}/g, (match: string, paramName: string) => {
    if (allUrlParameters[paramName] !== undefined) {
      pathParams.push(paramName);
      return String(allUrlParameters[paramName]);
    }
    return match;
  });
  
  // Remaining parameters (not used in path) go to query params
  const queryParameters = { ...allUrlParameters };
  pathParams.forEach(param => delete queryParameters[param]);

  const method = endpointDef.method;

  const requestOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...endpointDef.headers,
    },
  };

  // Handle query parameters for URL
  if (Object.keys(queryParameters).length > 0) {
    const queryParams = convertParametersForQuery(queryParameters);
    const queryString = new URLSearchParams(queryParams).toString();
    if (queryString) {
      url = `${url}?${queryString}`;
    }
  }

  // Handle payload for request body
  if (finalPayload !== undefined && finalPayload !== null) {
    requestOptions.body = JSON.stringify(finalPayload);
  }

  try {
    const response = await fetchWithProviderTimeout(url, requestOptions);
    
    if (!response.ok) {
      throw new Error(`Failed to call provider function: ${response.statusText}`);
    }

    return await response.json() as FunctionCallResult;
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      throw new Error(`Provider call timeout: ${error.message}`);
    }
    throw error;
  }
}

export default { executeFunction };
