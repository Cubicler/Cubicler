import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { substituteEnvVarsInObject } from '../../src/utils/env-helper.js';

describe('Environment Variable Object Substitution Debug', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should substitute environment variables in nested objects', () => {
    // Setup environment variables
    process.env.API_TOKEN = 'secret-token';
    process.env.SERVICE_URL = 'http://localhost:4000';

    const testObj = {
      mcpServers: [
        {
          identifier: 'test_service',
          name: 'Test Service',
          transport: 'http',
          config: {
            url: '{{env.SERVICE_URL}}/mcp',
            headers: {
              Authorization: 'Bearer {{env.API_TOKEN}}',
            },
          },
        },
      ],
    };

    const result = substituteEnvVarsInObject(testObj);

    console.log('Input:', JSON.stringify(testObj, null, 2));
    console.log('Output:', JSON.stringify(result, null, 2));

    expect(result).toEqual({
      mcpServers: [
        {
          identifier: 'test_service',
          name: 'Test Service',
          transport: 'http',
          config: {
            url: 'http://localhost:4000/mcp',
            headers: {
              Authorization: 'Bearer secret-token',
            },
          },
        },
      ],
    });
  });
});
