// Utility functions for parameter type validation and conversion

/**
 * Validates and converts a parameter value based on its type definition
 * @param {any} value - The parameter value to validate/convert
 * @param {object} parameterDefinition - The parameter definition from YAML spec
 * @param {string} parameterName - The name of the parameter (for error messages)
 * @returns {any} - The validated and converted value
 */
function validateAndConvertParameter(value, parameterDefinition, parameterName) {
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
 * @param {object} parameters - The parameters object to validate/convert
 * @param {object} parameterDefinitions - The parameter definitions from YAML spec
 * @returns {object} - The validated and converted parameters object
 */
function validateAndConvertParameters(parameters, parameterDefinitions) {
  if (!parameters || typeof parameters !== 'object') {
    return {};
  }

  if (!parameterDefinitions || typeof parameterDefinitions !== 'object') {
    return parameters; // No definitions available, return as-is
  }

  const convertedParameters = {};

  // Convert provided parameters
  for (const [paramName, paramValue] of Object.entries(parameters)) {
    const paramDef = parameterDefinitions[paramName];
    if (paramDef) {
      convertedParameters[paramName] = validateAndConvertParameter(paramValue, paramDef, paramName);
    } else {
      // Parameter not defined in spec, keep as-is but warn
      console.warn(`Parameter '${paramName}' is not defined in the spec`);
      convertedParameters[paramName] = paramValue;
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
 * @param {any} payload - The payload to validate/convert
 * @param {object} payloadDefinition - The payload definition from YAML spec
 * @returns {any} - The validated and converted payload
 */
function validateAndConvertPayload(payload, payloadDefinition) {
  if (!payloadDefinition) {
    return payload;
  }

  if (payload === undefined || payload === null) {
    if (payloadDefinition.required) {
      throw new Error(`Required payload is missing`);
    }
    return payload;
  }

  return validateAndConvertParameter(payload, payloadDefinition, 'payload');
}

/**
 * Converts parameters to appropriate format for URL query strings
 * For object/array types, converts to minified JSON and escapes it
 * @param {object} parameters - The parameters to convert
 * @returns {object} - Parameters converted to string format suitable for URLSearchParams
 */
function convertParametersForQuery(parameters) {
  const queryParams = {};
  
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

export { 
  validateAndConvertParameter, 
  validateAndConvertParameters,
  validateAndConvertPayload,
  convertParametersForQuery 
};
