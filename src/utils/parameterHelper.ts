import type { ParameterDefinition, PayloadDefinition } from './types.js';
import { isStrictParamsEnabled } from './envHelper.js';

/**
 * Validates and converts a parameter value based on its type definition
 * @param value - The parameter value to validate/convert
 * @param parameterDefinition - The parameter definition from YAML spec
 * @param parameterName - The name of the parameter (for error messages)
 * @returns The validated and converted value
 */
export function validateAndConvertParameter(
  value: any, 
  parameterDefinition: ParameterDefinition, 
  parameterName: string
): any {
  if (value === undefined || value === null) {
    if (parameterDefinition.required) {
      throw new Error(`Required parameter '${parameterName}' is missing`);
    }
    return value;
  }

  const { type } = parameterDefinition;

  switch (type) {
    case 'string':
      return String(value);
    
    case 'number':
      const numValue = Number(value);
      if (isNaN(numValue)) {
        throw new Error(`Parameter '${parameterName}' must be a valid number, got '${value}'`);
      }
      return numValue;
    
    case 'boolean':
      if (typeof value === 'boolean') {
        return value;
      }
      if (typeof value === 'string') {
        const lowerValue = value.toLowerCase();
        if (lowerValue === 'true' || lowerValue === '1') return true;
        if (lowerValue === 'false' || lowerValue === '0') return false;
      }
      if (typeof value === 'number') {
        return Boolean(value);
      }
      throw new Error(`Parameter '${parameterName}' must be a valid boolean, got '${value}'`);
    
    case 'array':
      if (!Array.isArray(value)) {
        throw new Error(`Parameter '${parameterName}' must be an array, got '${typeof value}'`);
      }
      return value;
    
    case 'object':
      if (typeof value !== 'object' || Array.isArray(value) || value === null) {
        throw new Error(`Parameter '${parameterName}' must be an object, got '${value === null ? 'null' : typeof value}'`);
      }
      return value;
    
    default:
      throw new Error(`Unsupported parameter type '${type}' for parameter '${parameterName}'`);
  }
}

/**
 * Validates and converts all parameters in an object based on their definitions
 * @param parameters - The parameters object to validate/convert
 * @param parameterDefinitions - The parameter definitions from YAML spec
 * @returns The validated and converted parameters object
 */
export function validateAndConvertParameters(
  parameters: Record<string, any>,
  parameterDefinitions: Record<string, ParameterDefinition> | undefined
): Record<string, any> {
  if (!parameters || typeof parameters !== 'object') {
    return {};
  }

  if (!parameterDefinitions || typeof parameterDefinitions !== 'object') {
    return parameters; // No definitions available, return as-is
  }

  const convertedParameters: Record<string, any> = {};

  // Convert provided parameters
  for (const [paramName, paramValue] of Object.entries(parameters)) {
    const paramDef = parameterDefinitions[paramName];
    if (paramDef) {
      convertedParameters[paramName] = validateAndConvertParameter(paramValue, paramDef, paramName);
    } else {
      // Parameter not defined in spec
      if (isStrictParamsEnabled()) {
        throw new Error(`Unknown parameter '${paramName}' is not allowed in strict mode`);
      } else {
        // Just warn in non-strict mode
        console.warn(`Parameter '${paramName}' is not defined in the spec`);
        convertedParameters[paramName] = paramValue;
      }
    }
  }

  // Check for missing required parameters
  for (const [paramName, paramDef] of Object.entries(parameterDefinitions)) {
    if (paramDef.required && !(paramName in parameters)) {
      throw new Error(`Required parameter '${paramName}' is missing`);
    }
  }

  return convertedParameters;
}

/**
 * Validates and converts payload based on payload definition
 * @param payload - The payload to validate/convert
 * @param payloadDefinition - The payload definition from YAML spec
 * @returns The validated and converted payload
 */
export function validateAndConvertPayload(
  payload: any,
  payloadDefinition: PayloadDefinition | undefined
): any {
  if (!payloadDefinition) {
    return payload;
  }

  if (payload === undefined || payload === null) {
    if (payloadDefinition.required) {
      throw new Error(`Required payload is missing`);
    }
    return payload;
  }

  // If strict mode is enabled and payload has properties defined, validate against them
  if (isStrictParamsEnabled() && payloadDefinition.type === 'object' && payloadDefinition.properties && typeof payload === 'object' && !Array.isArray(payload)) {
    for (const propName of Object.keys(payload)) {
      if (!(propName in payloadDefinition.properties)) {
        throw new Error(`Unknown payload property '${propName}' is not allowed in strict mode`);
      }
    }
  }

  return validateAndConvertParameter(payload, payloadDefinition, 'payload');
}

/**
 * Converts parameters to appropriate format for URL query strings
 * For object/array types, converts to minified JSON and escapes it
 * @param parameters - The parameters to convert
 * @returns Parameters converted to string format suitable for URLSearchParams
 */
export function convertParametersForQuery(parameters: Record<string, any>): Record<string, string> {
  const queryParams: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(parameters)) {
    if (value === undefined || value === null) {
      continue; // Skip null/undefined values
    }
    
    if (typeof value === 'boolean') {
      queryParams[key] = value.toString();
    } else if (typeof value === 'number') {
      queryParams[key] = value.toString();
    } else if (Array.isArray(value) || (typeof value === 'object')) {
      // For arrays and objects, convert to minified JSON
      queryParams[key] = JSON.stringify(value);
    } else {
      queryParams[key] = String(value);
    }
  }
  
  return queryParams;
}
