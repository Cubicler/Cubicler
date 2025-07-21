import { jest } from '@jest/globals';
import providerService from '../../src/core/provider-service.js';

describe('Provider Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    
    process.env.CUBICLER_PROVIDERS_LIST = './tests/mocks/test-providers.yaml';
    process.env.PROVIDER_SPEC_CACHE_ENABLED = 'false'; // Disable cache for tests
    
    providerService.clearCache();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getProviderSpec', () => {
    it('should return spec and context for weather_api provider', async () => {
      const result = await providerService.getProviderSpec('weather_api');
      
      expect(result).toHaveProperty('context');
      expect(result).toHaveProperty('functions');
      expect(result.context).toContain('Weather API Context');
      expect(result.context).toContain('getWeather');
      
      expect(result.functions).toHaveLength(1);
      const weatherFunction = result.functions[0];
      expect(weatherFunction).toBeDefined();
      expect(weatherFunction).toMatchObject({
        name: 'weather_api.getWeather',
        description: 'Get weather information by city and country',
        parameters: {
          type: 'object',
          properties: expect.objectContaining({
            city: { type: 'string' }
            // Note: country should be excluded due to override_parameters
            // Note: payload should be excluded due to override_payload
          })
        }
      });
      
      // Verify override parameters are hidden
      if (weatherFunction?.parameters?.properties) {
        expect(weatherFunction.parameters.properties).not.toHaveProperty('country');
        expect(weatherFunction.parameters.properties).not.toHaveProperty('payload');
      }
    });

    it('should return spec and context for mock_service provider', async () => {
      const result = await providerService.getProviderSpec('mock_service');
      
      expect(result).toHaveProperty('context');
      expect(result).toHaveProperty('functions');
      expect(result.context).toContain('Mock Service Context');
      
      expect(result.functions).toHaveLength(1);
      const mockFunction = result.functions[0];
      expect(mockFunction).toMatchObject({
        name: 'mock_service.getData',
        description: 'Get mock data by ID',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        }
      });
    });

    it('should throw error for non-existent provider', async () => {
      await expect(providerService.getProviderSpec('non_existent'))
        .rejects.toThrow("Provider 'non_existent' not found in providers list");
    });

    it('should throw error when CUBICLER_PROVIDERS_LIST is not set', async () => {
      delete process.env.CUBICLER_PROVIDERS_LIST;
      
      await expect(providerService.getProviderSpec('weather_api'))
        .rejects.toThrow('CUBICLER_PROVIDERS_LIST is not defined in environment variables');
    });
  });

  describe('getProviders', () => {
    it('should return list of all providers', async () => {
      const providers = await providerService.getProviders();
      
      expect(providers).toHaveLength(2);
      expect(providers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'weather_api',
            description: 'A provider for Weather API'
          }),
          expect.objectContaining({
            name: 'mock_service',
            description: 'A mock service for testing'
          })
        ])
      );
    });
  });

  describe('caching', () => {
    beforeEach(() => {
      process.env.PROVIDER_SPEC_CACHE_ENABLED = 'true';
      process.env.PROVIDER_SPEC_CACHE_TIMEOUT = '1000'; // 1 second for testing
      providerService.clearCache();
    });

    it('should cache provider specs', async () => {
      // First call
      const result1 = await providerService.getProviderSpec('weather_api');
      
      // Second call should return cached result
      const result2 = await providerService.getProviderSpec('weather_api');
      
      expect(result1).toEqual(result2);
    });

    it('should respect cache timeout', async () => {
      // Set very short timeout
      process.env.PROVIDER_SPEC_CACHE_TIMEOUT = '1';
      
      const result1 = await providerService.getProviderSpec('weather_api');
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result2 = await providerService.getProviderSpec('weather_api');
      
      expect(result1).toEqual(result2); // Content should be same, but re-fetched
    });
  });
});
