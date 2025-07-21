import { ProviderDefinition, FunctionSpec } from './types';

/**
 * Converts a provider definition to AI agent function specifications
 * This function flattens endpoint parameters and payload into function specs,
 * while hiding override parameters/payload from AI agents
 * 
 * @param spec - The provider definition containing services and functions
 * @returns Array of function specifications for AI agents
 */
export function convertToFunctionSpecs(spec: ProviderDefinition): FunctionSpec[] {
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
 * Validates that a provider definition has the correct structure
 * 
 * @param spec - The provider definition to validate
 * @returns True if valid, throws error otherwise
 */
export function validateProviderDefinition(spec: ProviderDefinition): boolean {
  if (!spec || typeof spec !== 'object') {
    throw new Error('Invalid provider definition: must be an object');
  }

  if (!spec.services || typeof spec.services !== 'object') {
    throw new Error('Invalid provider definition: missing or invalid services');
  }

  if (!spec.functions || typeof spec.functions !== 'object') {
    throw new Error('Invalid provider definition: missing or invalid functions');
  }

  // Validate that all functions reference valid services and endpoints
  for (const [functionName, functionDef] of Object.entries(spec.functions)) {
    if (!functionDef.service) {
      throw new Error(`Function ${functionName}: missing service reference`);
    }

    if (!functionDef.endpoint) {
      throw new Error(`Function ${functionName}: missing endpoint reference`);
    }

    const service = spec.services[functionDef.service];
    if (!service) {
      throw new Error(`Function ${functionName}: references non-existent service ${functionDef.service}`);
    }

    if (!service.endpoints || !service.endpoints[functionDef.endpoint]) {
      throw new Error(`Function ${functionName}: references non-existent endpoint ${functionDef.endpoint} in service ${functionDef.service}`);
    }
  }

  return true;
}

/**
 * Gets a specific function definition by name from a provider definition
 * 
 * @param spec - The provider definition to search
 * @param functionName - The name of the function to retrieve
 * @returns The function specification for AI agents
 * @throws Error if function is not found
 */
export function getFunctionByName(spec: ProviderDefinition, functionName: string): FunctionSpec {
  const functions = convertToFunctionSpecs(spec);
  const targetFunction = functions.find(f => f.name === functionName);
  
  if (!targetFunction) {
    throw new Error(`Function '${functionName}' not found in provider definition`);
  }
  
  return targetFunction;
}
