import { ParsedFunctionName } from '../model/types';
import { AgentFunctionDefinition } from '../model/definitions';
import { ProviderDefinition } from '../model/definitions';

/**
 * Converts a provider definition to AI agent function specifications
 * This function flattens endpoint parameters and payload into function specs,
 * while hiding override parameters/payload from AI agents
 * 
 * @param spec - The provider definition containing services and functions
 * @param providerName - The name of the provider (used for function naming convention)
 * @returns Array of function specifications for AI agents
 */
export function convertToFunctionSpecs(spec: ProviderDefinition, providerName?: string): AgentFunctionDefinition[] {
  return Object.entries(spec.functions).map(([name, details]) => {
    const service = spec.services[details.service];
    if (!service) {
      throw new Error(`Service ${details.service} not found in spec`);
    }
    
    const endpoint = service.endpoints[details.endpoint];
    if (!endpoint) {
      throw new Error(`Endpoint ${details.endpoint} not found in service ${details.service}`);
    }

    const parameters: AgentFunctionDefinition['parameters'] = {
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

    // Use provider.function convention if providerName is provided
    const functionName = providerName ? `${providerName}.${name}` : name;

    return {
      name: functionName,
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
 * @param functionName - The name of the function to retrieve (can be with or without provider prefix)
 * @param providerName - The name of the provider (used for function naming convention)
 * @returns The function specification for AI agents
 * @throws Error if function is not found
 */
export function getFunctionByName(spec: ProviderDefinition, functionName: string, providerName?: string): AgentFunctionDefinition {
  const functions = convertToFunctionSpecs(spec, providerName);
  const targetFunction = functions.find(f => f.name === functionName);
  
  if (!targetFunction) {
    throw new Error(`Function '${functionName}' not found in provider definition`);
  }
  
  return targetFunction;
}

/**
 * Parses a function name to extract provider name and original function name
 * Uses dot notation: "provider.function"
 * 
 * @param functionName - The function name to parse
 * @returns Object with providerName and originalFunctionName
 */
export function parseFunctionName(functionName: string): ParsedFunctionName {
  const dotIndex = functionName.indexOf('.');
  if (dotIndex >= 0) {
    const providerName = functionName.substring(0, dotIndex);
    const originalFunctionName = functionName.substring(dotIndex + 1);
    const result: ParsedFunctionName = {
      originalFunctionName: originalFunctionName
    };
    if (providerName !== undefined) {
      result.providerName = providerName;
    }
    return result;
  }
  return {
    originalFunctionName: functionName
  };
}

/**
 * Parses a function name against known provider names to handle complex cases
 * This is more robust for providers with dots in their names
 * 
 * @param functionName - The function name to parse
 * @param availableProviders - List of known provider names
 * @returns Object with providerName and originalFunctionName
 */
export function parseProviderFunction(
  functionName: string, 
  availableProviders: string[]
): ParsedFunctionName {
  // Sort providers by length (longest first) to handle prefixes correctly
  const sortedProviders = [...availableProviders].sort((a, b) => b.length - a.length);
  
  for (const providerName of sortedProviders) {
    if (functionName.startsWith(providerName + '.')) {
      return {
        providerName: providerName,
        originalFunctionName: functionName.substring(providerName.length + 1)
      };
    }
  }
  
  // Fallback to simple parsing
  return parseFunctionName(functionName);
}
