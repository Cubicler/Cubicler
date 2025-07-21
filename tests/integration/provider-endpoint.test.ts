import { jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/index.js';
import providerService from '../../src/core/provider-service.js';

describe('GET /provider/:providerName/spec endpoint', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.CUBICLER_PROVIDERS_LIST = './tests/mocks/test-providers.yaml';
    process.env.PROVIDER_SPEC_CACHE_ENABLED = 'false';
    
    // Clear caches to ensure clean state between tests
    providerService.clearCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    providerService.clearCache();
  });

  it('should return provider spec and context for weather_api', async () => {
    const response = await request(app)
      .get('/provider/weather_api/spec')
      .expect(200);

    expect(response.body).toHaveProperty('context');
    expect(response.body).toHaveProperty('functions');
    expect(response.body.context).toContain('Weather API Context');
    expect(response.body.functions).toHaveLength(1);
    expect(response.body.functions[0].name).toBe('weather_api.getWeather');
  });

  it('should return 500 for non-existent provider', async () => {
    const response = await request(app)
      .get('/provider/non_existent/spec')
      .expect(500);

    expect(response.body.error).toContain("Provider 'non_existent' not found");
  });

  it('should return 400 for missing provider name', async () => {
    const response = await request(app)
      .get('/provider//spec')
      .expect(404); // Express returns 404 for empty params
  });

  it('should return 500 when CUBICLER_PROVIDERS_LIST is not set', async () => {
    delete process.env.CUBICLER_PROVIDERS_LIST;
    
    // Clear cache to ensure the environment change takes effect
    providerService.clearCache();
    
    const response = await request(app)
      .get('/provider/weather_api/spec')
      .expect(500);

    expect(response.body.error).toContain('CUBICLER_PROVIDERS_LIST is not defined');
  });
});
