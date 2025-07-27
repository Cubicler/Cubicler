import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

// Mock provider service completely
const mockProviderService = {
  getProviders: vi.fn(),
  getProviderSpec: vi.fn(),
  loadProviders: vi.fn(),
};

// Mock axios
const mockAxios = Object.assign(vi.fn(), {
  isAxiosError: vi.fn().mockReturnValue(true),
});

vi.mock('axios', () => ({
  default: mockAxios,
  isAxiosError: mockAxios.isAxiosError,
}));

vi.mock('../../src/core/provider-service.js', () => ({
  default: mockProviderService,
}));

describe('Execution Service', () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.clearAllMocks();

    // Mock provider list
    mockProviderService.getProviders.mockResolvedValue([
      {
        name: 'weather_api',
        description: 'Weather API',
        spec_source: './tests/mocks/provider-weather-spec.yaml',
      },
      {
        name: 'mock_service',
        description: 'Mock Service',
        spec_source: './tests/mocks/provider-mock-spec.yaml',
      },
    ]);

    // Mock provider spec
    mockProviderService.getProviderSpec.mockResolvedValue({
      spec: {
        services: {
          weather_api: {
            base_url: 'https://api.weather.com',
            endpoints: {
              get_weather: {
                method: 'POST',
                path: '/api/weather/{city}/{country}',
                headers: { 'X-Client-Version': 'cubicler/1.0' },
                parameters: { city: { type: 'string' }, country: { type: 'string' } },
                payload: {
                  type: 'object',
                  properties: { filters: { type: 'array', items: { type: 'string' } } },
                },
              },
            },
          },
        },
        functions: {
          getWeather: {
            service: 'weather_api',
            endpoint: 'get_weather',
            description: 'Get weather information by city and country',
            override_parameters: { country: 'US' },
            override_payload: { filters: ['now'] },
          },
        },
      },
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('executeFunction', () => {
    it('should execute provider function successfully', async () => {
      // Mock successful API response
      mockAxios.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        data: {
          id: '123',
          city: 'New York',
          country: 'US',
          temperature: 20,
          conditions: 'Sunny',
          description: 'Clear sky',
        },
      });

      const { default: executionService } = await import('../../src/core/execution-service.js');
      const result = await executionService.executeFunction('weather_api.getWeather', {
        city: 'New York',
      });

      expect(result).toEqual({
        id: '123',
        city: 'New York',
        country: 'US',
        temperature: 20,
        conditions: 'Sunny',
        description: 'Clear sky',
      });
    });

    it('should throw error for invalid function name format', async () => {
      const { default: executionService } = await import('../../src/core/execution-service.js');
      await expect(executionService.executeFunction('invalidname', {})).rejects.toThrow(
        "Invalid function name format. Expected 'provider.function', got 'invalidname'"
      );
    });

    it('should throw error when API call fails', async () => {
      // Mock failed API response using axios error
      const error = {
        isAxiosError: true,
        response: {
          status: 500,
          statusText: 'Internal Server Error',
        },
      };
      mockAxios.mockRejectedValue(error);

      const { default: executionService } = await import('../../src/core/execution-service.js');
      await expect(
        executionService.executeFunction('weather_api.getWeather', {
          city: 'New York',
        })
      ).rejects.toThrow('Failed to call provider function: Internal Server Error');
    });
  });
});
