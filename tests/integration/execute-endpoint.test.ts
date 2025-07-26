import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import request from 'supertest';
import { app } from '../../src/index.js';

// Mock axios for the execution service to call external APIs
vi.mock('axios');
const mockAxios = axios as any;

// Create a manual mock for axios.isAxiosError
Object.defineProperty(axios, 'isAxiosError', {
  value: vi.fn().mockReturnValue(true),
  writable: true
});

describe('POST /execute/:functionName endpoint', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.CUBICLER_PROVIDERS_LIST = './tests/mocks/test-providers.yaml';
    process.env.PROVIDER_SPEC_CACHE_ENABLED = 'false'; // Disable cache for tests
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should execute weather_api.getWeather function successfully', async () => {
    // Mock the external API response
    mockAxios.mockResolvedValue({
      status: 200,
      data: {
        id: 'weather-123',
        city: 'New York',
        country: 'US',
        temperature: 22,
        conditions: 'Sunny',
        description: 'Clear blue sky'
      }
    });

    const response = await request(app)
      .post('/execute/weather_api.getWeather')
      .send({
        city: 'New York'
      })
      .expect(200);

    expect(response.body).toEqual({
      id: 'weather-123',
      city: 'New York',
      country: 'US',
      temperature: 22,
      conditions: 'Sunny',
      description: 'Clear blue sky'
    });

    // Verify the external API was called correctly
    expect(mockAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.weather.com/api/weather/New York/US',
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Client-Version': 'cubicler/1.0',
          'Authorization': 'Bearer {{env.API_KEY}}'
        }),
        data: { filters: ['now'] },
        timeout: 30000
      })
    );
  });

  it('should return 404 for missing function name', async () => {
    const response = await request(app)
      .post('/execute/')
      .send({})
      .expect(404); // Express returns 404 for missing route params

    // This test verifies the route pattern requires the functionName parameter
  });

  it('should return 500 for invalid function name format', async () => {
    const response = await request(app)
      .post('/execute/invalidFunctionName')
      .send({})
      .expect(500);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('Invalid function name format');
  });

  it('should return 500 for non-existent provider', async () => {
    const response = await request(app)
      .post('/execute/nonexistent_provider.someFunction')
      .send({})
      .expect(500);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain("Provider 'nonexistent_provider' not found");
  });

  it('should return 500 for non-existent function in valid provider', async () => {
    const response = await request(app)
      .post('/execute/weather_api.nonExistentFunction')
      .send({})
      .expect(500);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain("Function 'nonExistentFunction' not found in provider 'weather_api'");
  });

  it('should return 500 when external API call fails', async () => {
    // Mock failed external API response
    mockAxios.mockRejectedValue({
      response: {
        status: 503,
        statusText: 'Service Unavailable'
      }
    });

    const response = await request(app)
      .post('/execute/weather_api.getWeather')
      .send({
        city: 'New York'
      })
      .expect(500);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('Failed to call provider function: Service Unavailable');
  });

  it('should execute mock_service.getData function successfully', async () => {
    // Mock the external API response for mock service
    mockAxios.mockResolvedValue({
      status: 200,
      data: {
        id: 'mock-456',
        data: 'test data',
        timestamp: '2025-07-21T10:00:00Z'
      }
    });

    const response = await request(app)
      .post('/execute/mock_service.getData')
      .send({
        query: 'test query'
      })
      .expect(200);

    expect(response.body).toEqual({
      id: 'mock-456',
      data: 'test data',
      timestamp: '2025-07-21T10:00:00Z'
    });
  });
});
