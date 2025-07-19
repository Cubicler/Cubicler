import { jest } from '@jest/globals';
import functionService from '../../src/core/functionService';
import specService from '../../src/core/specService';
import dotenv from 'dotenv';

dotenv.config();

describe('functionService', () => {
  beforeAll(() => {
    process.env.CUBICLER_SPEC_SOURCE = './tests/mocks/mockSpec.yaml';
  });

  beforeEach(() => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) }));
    
    // Reset mocks to default values for each test
    jest.spyOn(specService, 'getFunction').mockResolvedValue({
      service: 'test_service',
      endpoint: 'test_endpoint',
    });

    jest.spyOn(specService, 'getEndpoint').mockResolvedValue({
      base_url: 'https://api.example.com',
      path: '/test/{id}',
      method: 'POST',
      headers: {},
      parameters: {
        id: { type: 'string' }
      },
      payload: {
        type: 'object',
        properties: {
          filter: { type: 'array' }
        }
      }
    });

    jest.spyOn(specService, 'getOverrideParameters').mockResolvedValue({});
    jest.spyOn(specService, 'getOverridePayload').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call the correct endpoint with parameters and payload', async () => {
    const result = await functionService.callFunction('testFunction', { 
      id: '123',
      payload: { filter: ['item1', 'item2'] }
    });

    expect(result).toEqual({ success: true });
    expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/test/123', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter: ['item1', 'item2'] })
    });
  });

  it('should handle URL parameters with type conversion', async () => {
    jest.spyOn(specService, 'getEndpoint').mockResolvedValue({
      base_url: 'https://api.example.com',
      path: '/test/{id}',
      method: 'GET',
      headers: {},
      parameters: {
        id: { type: 'number' },
        active: { type: 'boolean' },
        tags: { type: 'array' }
      }
    });

    await functionService.callFunction('testFunction', { 
      id: '123',     // Should convert to number for path
      active: 'true', // Should convert to boolean, then to string for query
      tags: ['tag1', 'tag2'] // Should convert to JSON string for query
    });

    // Path parameter should be converted and query params should be properly formatted
    expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/test/123?active=true&tags=%5B%22tag1%22%2C%22tag2%22%5D', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
  });

  it('should handle override parameters correctly', async () => {
    jest.spyOn(specService, 'getOverrideParameters').mockResolvedValue({
      id: 'overridden-value'
    });

    jest.spyOn(specService, 'getEndpoint').mockResolvedValue({
      base_url: 'https://api.example.com',
      path: '/test/{id}',
      method: 'GET',
      headers: {},
      parameters: {
        id: { type: 'string' }
      }
    });

    await functionService.callFunction('testFunction', { 
      id: 'original-value'  // This should be overridden
    });

    // The URL should use the override value, not the passed value
    expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/test/overridden-value', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('should handle override payload correctly', async () => {
    // Set up specific mocks for this test
    jest.spyOn(specService, 'getEndpoint').mockResolvedValue({
      base_url: 'https://api.example.com',
      path: '/test/{id}',
      method: 'POST',
      headers: {},
      parameters: {
        id: { type: 'string' }
      },
      payload: {
        type: 'object',
        properties: {
          filter: { type: 'array' }
        }
      }
    });

    jest.spyOn(specService, 'getOverridePayload').mockResolvedValue({
      defaultFilter: 'override',
      priority: 1
    });

    const result = await functionService.callFunction('testFunction', { 
      id: '123',
      payload: { filter: ['user-item'] }
    });

    expect(result).toEqual({ success: true });
    // Payload should be merged with override (override takes precedence)
    expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/test/123', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        filter: ['user-item'],
        defaultFilter: 'override',
        priority: 1
      })
    });
  });

  it('should handle payload-only override', async () => {
    // Set up specific mocks for this test
    jest.spyOn(specService, 'getEndpoint').mockResolvedValue({
      base_url: 'https://api.example.com',
      path: '/test/{id}',
      method: 'POST',
      headers: {},
      parameters: {
        id: { type: 'string' }
      },
      payload: {
        type: 'object',
        properties: {
          filter: { type: 'array' }
        }
      }
    });

    jest.spyOn(specService, 'getOverridePayload').mockResolvedValue({
      filter: ['override-item']
    });

    await functionService.callFunction('testFunction', { 
      id: '123'
      // No payload provided by user
    });

    // Should use override payload
    expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/test/123', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter: ['override-item'] })
    });
  });

  it('should handle requests without payload when none defined', async () => {
    jest.spyOn(specService, 'getEndpoint').mockResolvedValue({
      base_url: 'https://api.example.com',
      path: '/test/{id}',
      method: 'GET',
      headers: {},
      parameters: {
        id: { type: 'string' }
      }
      // No payload defined
    });

    await functionService.callFunction('testFunction', { id: '123' });

    expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/test/123', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
      // No body should be included
    });
  });

  it('should throw error for invalid parameter types', async () => {
    jest.spyOn(specService, 'getEndpoint').mockResolvedValue({
      base_url: 'https://api.example.com',
      path: '/test',
      method: 'GET',
      headers: {},
      parameters: {
        count: { type: 'number' }
      }
    });

    await expect(functionService.callFunction('testFunction', { 
      count: 'not-a-number'
    })).rejects.toThrow("Parameter 'count' must be a valid number, got 'not-a-number'");
  });
});
