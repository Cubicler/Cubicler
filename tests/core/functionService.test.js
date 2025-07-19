import { jest } from '@jest/globals';
import functionService from '../../src/core/functionService';
import specService from '../../src/core/specService';
import dotenv from 'dotenv';

dotenv.config();

// Mock specService methods
jest.spyOn(specService, 'getFunction').mockResolvedValue({
  name: 'testFunction',
  endpoint: 'testEndpoint',
});

jest.spyOn(specService, 'getEndpoint').mockResolvedValue({
  base_url: 'https://api.example.com',
  path: '/test/{id}',
  method: 'GET',
  headers: {},
});

jest.spyOn(specService, 'getOverrideParameters').mockResolvedValue({});

describe('functionService', () => {
  beforeAll(() => {
    process.env.CUBICLE_SPEC_SOURCE = './tests/mockSpec.yaml';
  });

  beforeEach(() => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should call the correct endpoint with parameters', async () => {
    const result = await functionService.callFunction('testFunction', { id: '123' });

    expect(result).toEqual({ success: true });
    expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/test/123', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('should handle override parameters correctly', async () => {
    jest.spyOn(specService, 'getOverrideParameters').mockResolvedValue({
      name: 'overridden-value'
    });

    jest.spyOn(specService, 'getEndpoint').mockResolvedValue({
      base_url: 'https://api.example.com',
      path: '/test/{name}',
      method: 'GET',
      headers: {},
    });

    await functionService.callFunction('testFunction', { 
      name: 'original-value'  // This should be overridden
    });

    // The URL should use the override value, not the passed value
    expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/test/overridden-value', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
  });
});
