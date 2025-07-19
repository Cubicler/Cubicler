// Service to load, store, validate, and serve the spec

import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import { config } from 'dotenv';
import { substituteEnvVars, substituteEnvVarsInObject } from '../utils/envHelper.js';
config();

async function _getSpec() {
    const specSource = process.env.CUBICLE_SPEC_SOURCE;
  if (!specSource) {
    throw new Error('CUBICLE_SPEC_SOURCE is not defined in environment variables');
  }

  if (specSource.startsWith('http')) {
    const response = await fetch(specSource);
    if (!response.ok) {
      throw new Error(`Failed to fetch spec: ${response.statusText}`);
    }
    const yamlText = await response.text();
    return load(yamlText);
  } else {
    const yamlText = readFileSync(specSource, 'utf-8');
    return load(yamlText);
  }
}

async function getFunctions() {
  const spec = await _getSpec();
  return Object.entries(spec.functions).map(([name, details]) => {
    const service = spec.services[details.service];
    const endpoint = service.endpoints[details.endpoint];

    const parameters = {
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

async function getFunction(functionName) {
  const spec = await _getSpec();
  const functionSpec = spec.functions[functionName];
  if (!functionSpec) {
    throw new Error(`Function ${functionName} not found in spec`);
  }
  return functionSpec;
}

async function getEndpoint(func) {
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

async function getOverrideParameters(functionName) {
  const spec = await _getSpec();
  const func = spec.functions[functionName];
  if (!func || !func.override_parameters) return {};
  
  return substituteEnvVarsInObject(func.override_parameters);
}

async function getOverridePayload(functionName) {
  const spec = await _getSpec();
  const func = spec.functions[functionName];
  if (!func || !func.override_payload) return undefined;
  
  return substituteEnvVarsInObject(func.override_payload);
}

export default { getFunctions, getFunction, getEndpoint, getOverrideParameters, getOverridePayload };
