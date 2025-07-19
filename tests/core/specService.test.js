import { jest } from '@jest/globals';
import specService from '../../src/core/specService';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

describe('specService', () => {
  // Read the actual mock spec file content to avoid redundancy
  const mockSpecContent = fs.readFileSync('./tests/mocks/mockSpec.yaml', 'utf-8');
  
  // Read additional mock spec files
  const complicatedMockSpec = fs.readFileSync('./tests/mocks/complicatedMockSpec.yaml', 'utf-8');
  const mockSpecWithPayload = fs.readFileSync('./tests/mocks/mockSpecWithPayload.yaml', 'utf-8');
  const mockSpecWithBoth = fs.readFileSync('./tests/mocks/mockSpecWithBoth.yaml', 'utf-8');
  const mockSpecNoPayloadOverride = fs.readFileSync('./tests/mocks/mockSpecNoPayloadOverride.yaml', 'utf-8');

  beforeAll(() => {
    process.env.CUBICLER_SPEC_SOURCE = './tests/mocks/mockSpec.yaml';
  });

  beforeEach(() => {
    jest.spyOn(fs, 'readFileSync').mockImplementation((path, encoding) => {
      if (path === './tests/mocks/mockSpec.yaml') {
        return mockSpecContent;
      }
      // For any other files, call the real readFileSync
      return jest.requireActual('fs').readFileSync(path, encoding);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should fetch the correct endpoint for a function with payload', async () => {
    jest.spyOn(fs, 'readFileSync').mockImplementation((path, encoding) => {
      if (path === './tests/mocks/mockSpec.yaml') {
        return complicatedMockSpec;
      }
      return jest.requireActual('fs').readFileSync(path, encoding);
    });

    const func = await specService.getFunction('testFunction');
    const endpoint = await specService.getEndpoint(func);

    expect(endpoint).toEqual({
      method: 'POST',
      path: '/test/{id}',
      parameters: {
        id: { type: 'string' }
      },
      payload: {
        type: 'object',
        properties: {
          filter: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      },
      base_url: 'https://api.example.com',
      headers: {
        'Authorization': 'Bearer test_token',
        'X-Custom-Header': 'CustomValue',
      },
    });
  });

  it('should fetch the override parameters for a function', async () => {
    const overrideValues = await specService.getOverrideParameters('testFunction');
    expect(overrideValues).toEqual({ id: '123' });
  });

  it('should fetch the override payload for a function', async () => {
    jest.spyOn(fs, 'readFileSync').mockImplementation((path, encoding) => {
      if (path === './tests/mocks/mockSpec.yaml') {
        return mockSpecWithPayload;
      }
      return jest.requireActual('fs').readFileSync(path, encoding);
    });

    const overridePayload = await specService.getOverridePayload('testFunction');
    expect(overridePayload).toEqual({ 
      filter: ['default-filter'],
      priority: 1
    });
  });

  it('should return undefined for functions without override payload', async () => {
    const overridePayload = await specService.getOverridePayload('testFunction');
    expect(overridePayload).toBeUndefined();
  });

  it('should exclude override parameters and payload from AI function spec', async () => {
    jest.spyOn(fs, 'readFileSync').mockImplementation((path, encoding) => {
      if (path === './tests/mocks/mockSpec.yaml') {
        return mockSpecWithBoth;
      }
      return jest.requireActual('fs').readFileSync(path, encoding);
    });

    const functions = await specService.getFunctions();
    const testFunction = functions.find(f => f.name === 'testFunction');
    
    expect(testFunction).toBeDefined();
    expect(testFunction.description).toBe('Test function');
    
    // Should not include overridden parameter 'id'
    expect(testFunction.parameters.properties).not.toHaveProperty('id');
    // Should include non-overridden parameter 'count'
    expect(testFunction.parameters.properties).toHaveProperty('count');
    // Should not include payload since it's overridden
    expect(testFunction.parameters.properties).not.toHaveProperty('payload');
  });

  it('should include payload in function spec when not overridden', async () => {
    jest.spyOn(fs, 'readFileSync').mockImplementation((path, encoding) => {
      if (path === './tests/mocks/mockSpec.yaml') {
        return mockSpecNoPayloadOverride;
      }
      return jest.requireActual('fs').readFileSync(path, encoding);
    });

    const functions = await specService.getFunctions();
    const testFunction = functions.find(f => f.name === 'testFunction');
    
    expect(testFunction).toBeDefined();
    // Should include payload since it's not overridden
    expect(testFunction.parameters.properties).toHaveProperty('payload');
    expect(testFunction.parameters.properties.payload).toEqual({
      type: 'object',
      properties: {
        filter: { type: 'array' }
      }
    });
  });

  it('should substitute environment variables in headers', async () => {
    process.env.TEST_API_KEY = 'secret-test-key';
    
    // Update mock content to include env vars
    const mockSpecWithEnvVars = mockSpecContent.replace(
      'Authorization: "Bearer test_token"',
      'Authorization: "Bearer {{env.TEST_API_KEY}}"'
    );
    
    jest.spyOn(fs, 'readFileSync').mockImplementation((path, encoding) => {
      if (path === './tests/mocks/mockSpec.yaml') {
        return mockSpecWithEnvVars;
      }
      return jest.requireActual('fs').readFileSync(path, encoding);
    });

    const func = await specService.getFunction('testFunction');
    const endpoint = await specService.getEndpoint(func);

    expect(endpoint.headers['Authorization']).toBe('Bearer secret-test-key');
    
    delete process.env.TEST_API_KEY;
  });

  it('should substitute environment variables in base_url', async () => {
    process.env.API_BASE_URL = 'https://custom-api.example.com';
    
    // Update mock content to include env vars in base_url
    const mockSpecWithEnvVars = mockSpecContent.replace(
      'base_url: https://api.example.com',
      'base_url: "{{env.API_BASE_URL}}"'
    );
    
    jest.spyOn(fs, 'readFileSync').mockImplementation((path, encoding) => {
      if (path === './tests/mocks/mockSpec.yaml') {
        return mockSpecWithEnvVars;
      }
      return jest.requireActual('fs').readFileSync(path, encoding);
    });

    const func = await specService.getFunction('testFunction');
    const endpoint = await specService.getEndpoint(func);

    expect(endpoint.base_url).toBe('https://custom-api.example.com');
    
    delete process.env.API_BASE_URL;
  });

  it('should substitute environment variables in override parameters', async () => {
    process.env.OVERRIDE_VALUE = 'env-override-value';
    
    // Update mock content to include env vars in override_parameters
    const mockSpecWithEnvVars = mockSpecContent.replace(
      'id: "123"',
      'id: "{{env.OVERRIDE_VALUE}}"'
    );
    
    jest.spyOn(fs, 'readFileSync').mockImplementation((path, encoding) => {
      if (path === './tests/mocks/mockSpec.yaml') {
        return mockSpecWithEnvVars;
      }
      return jest.requireActual('fs').readFileSync(path, encoding);
    });

    const overrideValues = await specService.getOverrideParameters('testFunction');

    expect(overrideValues.id).toBe('env-override-value');
    
    delete process.env.OVERRIDE_VALUE;
  });
});
