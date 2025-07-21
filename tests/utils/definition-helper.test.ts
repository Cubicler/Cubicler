import { convertToFunctionSpecs, validateProviderDefinition, getFunctionByName } from '../../src/utils/definition-helper.js';
import type { ProviderDefinition } from '../../src/utils/types.js';

describe('Definition Helper', () => {
  const mockProviderDefinition: ProviderDefinition = {
    version: 1,
    services: {
      api_service: {
        base_url: "https://api.example.com",
        endpoints: {
          get_data: {
            method: "GET",
            path: "/data",
            parameters: {
              limit: {
                type: "number"
              }
            },
            payload: {
              type: "object",
              properties: {
                query: {
                  type: "string"
                }
              }
            }
          },
          post_data: {
            method: "POST", 
            path: "/data",
            parameters: {
              id: {
                type: "string"
              }
            }
          }
        }
      }
    },
    functions: {
      search_data: {
        description: "Search for data using the API",
        service: "api_service",
        endpoint: "get_data",
        override_parameters: {
          limit: 10
        }
      },
      create_data: {
        description: "Create new data via API",
        service: "api_service", 
        endpoint: "post_data"
      }
    }
  };

  describe('convertToFunctionSpecs', () => {
    it('should convert provider definition to function specs', () => {
      const result = convertToFunctionSpecs(mockProviderDefinition);
      
      expect(result).toHaveLength(2);
      
      const searchFunc = result.find(f => f.name === 'search_data');
      const createFunc = result.find(f => f.name === 'create_data');
      
      expect(searchFunc).toBeDefined();
      expect(searchFunc!.name).toBe('search_data');
      expect(searchFunc!.description).toBe('Search for data using the API');
      expect(searchFunc!.parameters.properties).toHaveProperty('payload');
      expect(searchFunc!.parameters.properties).not.toHaveProperty('limit'); // Override parameter should be hidden
      
      expect(createFunc).toBeDefined();
      expect(createFunc!.name).toBe('create_data');
      expect(createFunc!.description).toBe('Create new data via API');
      expect(createFunc!.parameters.properties).toHaveProperty('id');
    });

    it('should handle payload in function specs', () => {
      const result = convertToFunctionSpecs(mockProviderDefinition);
      const searchFunction = result.find(f => f.name === 'search_data');
      
      expect(searchFunction?.parameters.properties.payload).toEqual({
        type: "object",
        properties: {
          query: {
            type: "string"
          }
        }
      });
    });

    it('should throw error for non-existent service', () => {
      const invalidSpec = {
        ...mockProviderDefinition,
        functions: {
          invalid_function: {
            description: "Invalid function",
            service: "non_existent_service",
            endpoint: "some_endpoint"
          }
        }
      };

      expect(() => convertToFunctionSpecs(invalidSpec)).toThrow('Service non_existent_service not found in spec');
    });

    it('should throw error for non-existent endpoint', () => {
      const invalidSpec = {
        ...mockProviderDefinition,
        functions: {
          invalid_function: {
            description: "Invalid function",
            service: "api_service",
            endpoint: "non_existent_endpoint"
          }
        }
      };

      expect(() => convertToFunctionSpecs(invalidSpec)).toThrow('Endpoint non_existent_endpoint not found in service api_service');
    });
  });

  describe('validateProviderDefinition', () => {
    it('should validate correct provider definition', () => {
      expect(() => validateProviderDefinition(mockProviderDefinition)).not.toThrow();
      expect(validateProviderDefinition(mockProviderDefinition)).toBe(true);
    });

    it('should throw error for invalid object', () => {
      expect(() => validateProviderDefinition(null as any)).toThrow('Invalid provider definition: must be an object');
      expect(() => validateProviderDefinition("invalid" as any)).toThrow('Invalid provider definition: must be an object');
    });

    it('should throw error for missing services', () => {
      const invalidSpec = { ...mockProviderDefinition };
      delete (invalidSpec as any).services;
      
      expect(() => validateProviderDefinition(invalidSpec)).toThrow('Invalid provider definition: missing or invalid services');
    });

    it('should throw error for missing functions', () => {
      const invalidSpec = { ...mockProviderDefinition };
      delete (invalidSpec as any).functions;
      
      expect(() => validateProviderDefinition(invalidSpec)).toThrow('Invalid provider definition: missing or invalid functions');
    });

    it('should throw error for function with missing service reference', () => {
      const invalidSpec = {
        ...mockProviderDefinition,
        functions: {
          invalid_function: {
            description: "Invalid function",
            endpoint: "some_endpoint"
          }
        }
      };

      expect(() => validateProviderDefinition(invalidSpec as any)).toThrow('Function invalid_function: missing service reference');
    });

    it('should throw error for function with missing endpoint reference', () => {
      const invalidSpec = {
        ...mockProviderDefinition,
        functions: {
          invalid_function: {
            description: "Invalid function",
            service: "api_service"
          }
        }
      };

      expect(() => validateProviderDefinition(invalidSpec as any)).toThrow('Function invalid_function: missing endpoint reference');
    });

    it('should throw error for function referencing non-existent service', () => {
      const invalidSpec = {
        ...mockProviderDefinition,
        functions: {
          invalid_function: {
            description: "Invalid function",
            service: "non_existent_service",
            endpoint: "some_endpoint"
          }
        }
      };

      expect(() => validateProviderDefinition(invalidSpec)).toThrow('Function invalid_function: references non-existent service non_existent_service');
    });

    it('should throw error for function referencing non-existent endpoint', () => {
      const invalidSpec = {
        ...mockProviderDefinition,
        functions: {
          invalid_function: {
            description: "Invalid function",
            service: "api_service",
            endpoint: "non_existent_endpoint"
          }
        }
      };

      expect(() => validateProviderDefinition(invalidSpec)).toThrow('Function invalid_function: references non-existent endpoint non_existent_endpoint in service api_service');
    });
  });

  describe('getFunctionByName', () => {
    it('should return specific function spec by name', () => {
      const result = getFunctionByName(mockProviderDefinition, 'search_data');
      
      expect(result.name).toBe('search_data');
      expect(result.description).toBe('Search for data using the API');
      expect(result.parameters.properties).toHaveProperty('payload');
      expect(result.parameters.properties).not.toHaveProperty('limit'); // Override parameter should be hidden
    });

    it('should throw error for non-existent function', () => {
      expect(() => getFunctionByName(mockProviderDefinition, 'non_existent_function')).toThrow("Function 'non_existent_function' not found in provider definition");
    });
  });
});
