import { jest } from '@jest/globals';
import specService from '../../src/core/specService';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

describe('specService', () => {
  // Read the actual mock spec file content to avoid redundancy
  const mockSpecContent = fs.readFileSync('./tests/mockSpec.yaml', 'utf-8');

  beforeAll(() => {
    process.env.CUBICLE_SPEC_SOURCE = './tests/mockSpec.yaml';
  });

  beforeEach(() => {
    jest.spyOn(fs, 'readFileSync').mockImplementation((path, encoding) => {
      if (path === './tests/mockSpec.yaml') {
        return mockSpecContent;
      }
      // For any other files, call the real readFileSync
      return jest.requireActual('fs').readFileSync(path, encoding);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should fetch the correct endpoint for a function', async () => {
    const func = await specService.getFunction('testFunction');
    const endpoint = await specService.getEndpoint(func);

    expect(endpoint).toEqual({
      method: 'GET',
      path: '/test/{id}',
      parameters: {
        id: {
          type: 'string',
        },
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

  it('should exclude override parameters from AI function spec', async () => {
    const functions = await specService.getFunctions();
    const testFunction = functions.find(f => f.name === 'testFunction');
    
    expect(testFunction).toBeDefined();
    expect(testFunction.description).toBe('Test function');
    
    // The AI should NOT see the 'id' parameter because it's overridden
    expect(testFunction.parameters.properties).not.toHaveProperty('id');
    
    // But it should see other parameters that aren't overridden
    // (Note: in our mock, 'id' is the only parameter and it's overridden, 
    // so properties should be empty)
    expect(Object.keys(testFunction.parameters.properties)).toEqual([]);
  });

  it('should substitute environment variables in headers', async () => {
    process.env.TEST_API_KEY = 'secret-test-key';
    
    // Update mock content to include env vars
    const mockSpecWithEnvVars = mockSpecContent.replace(
      'Authorization: "Bearer test_token"',
      'Authorization: "Bearer {{env.TEST_API_KEY}}"'
    );
    
    jest.spyOn(fs, 'readFileSync').mockImplementation((path, encoding) => {
      if (path === './tests/mockSpec.yaml') {
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
      if (path === './tests/mockSpec.yaml') {
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
      if (path === './tests/mockSpec.yaml') {
        return mockSpecWithEnvVars;
      }
      return jest.requireActual('fs').readFileSync(path, encoding);
    });

    const overrideValues = await specService.getOverrideParameters('testFunction');

    expect(overrideValues.id).toBe('env-override-value');
    
    delete process.env.OVERRIDE_VALUE;
  });
});
