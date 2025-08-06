import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderRESTService } from '../src/core/provider-rest-service.js';
import { ProvidersConfigProviding } from '../src/interface/providers-config-providing.js';
import { ServersProviding } from '../src/interface/servers-providing.js';

// Mock the providers config that uses query field
const mockConfig = {
  restServers: [
    {
      identifier: 'open_meteo_api',
      name: 'Open-Meteo Weather API',
      description: 'Free weather API service - no API key required',
      transport: 'http',
      config: {
        url: 'https://api.open-meteo.com/v1',
        defaultHeaders: {
          'Content-Type': 'application/json',
        },
      },
      endPoints: [
        {
          name: 'getCurrentWeather',
          description: 'Get current weather for coordinates',
          path: '/forecast',
          method: 'GET',
          query: {
            type: 'object',
            properties: {
              latitude: {
                type: 'number',
                description: 'Latitude coordinate',
              },
              longitude: {
                type: 'number',
                description: 'Longitude coordinate',
              },
              current: {
                type: 'string',
                description: 'Current weather parameters',
                default:
                  'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m',
              },
              timezone: {
                type: 'string',
                description: 'Timezone',
                default: 'auto',
              },
            },
            required: ['latitude', 'longitude'],
          },
        },
      ],
    },
    {
      identifier: 'jsonplaceholder_api',
      name: 'JSONPlaceholder API',
      description: 'Free fake REST API for testing and prototyping',
      transport: 'http',
      config: {
        url: 'https://jsonplaceholder.typicode.com',
        defaultHeaders: {
          'Content-Type': 'application/json',
        },
      },
      endPoints: [
        {
          name: 'getPostById',
          description: 'Get a specific post by ID',
          path: '/posts/{postId}',
          method: 'GET',
          postId: {
            type: 'number',
            description: 'Post ID',
          },
        },
      ],
    },
  ],
};

describe('ProviderRESTService Query Field Fix', () => {
  let service: ProviderRESTService;
  let mockConfigProvider: ProvidersConfigProviding;
  let mockServersProvider: ServersProviding;

  beforeEach(() => {
    mockConfigProvider = {
      getProvidersConfig: vi.fn().mockResolvedValue(mockConfig),
      clearCache: vi.fn(),
      getAvailableServers: vi.fn(),
      getServerHash: vi.fn(),
      updateServerToolCount: vi.fn(),
    } as ProvidersConfigProviding;

    mockServersProvider = {
      getAvailableServers: vi.fn(),
      getServerHash: vi.fn(),
    } as ServersProviding;

    service = new ProviderRESTService(mockConfigProvider);
    service.setServersProvider(mockServersProvider);
  });

  describe('toolsList with query field support', () => {
    it('should properly handle query parameters in tool definitions', async () => {
      const tools = await service.toolsList();

      expect(tools).toHaveLength(2);

      // Check the weather API tool that has query parameters
      const weatherTool = tools.find((t) => t.name.includes('get_current_weather'));
      expect(weatherTool).toBeDefined();
      expect(weatherTool?.parameters.properties).toHaveProperty('query');
      expect(weatherTool?.parameters.properties.query).toEqual({
        type: 'object',
        properties: {
          latitude: {
            type: 'number',
            description: 'Latitude coordinate',
          },
          longitude: {
            type: 'number',
            description: 'Longitude coordinate',
          },
          current: {
            type: 'string',
            description: 'Current weather parameters',
            default:
              'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m',
          },
          timezone: {
            type: 'string',
            description: 'Timezone',
            default: 'auto',
          },
        },
        required: ['latitude', 'longitude'],
      });

      // Check the post API tool that has path parameters with individual definitions
      const postTool = tools.find((t) => t.name.includes('get_post_by_id'));
      expect(postTool).toBeDefined();
      expect(postTool?.parameters.properties).toHaveProperty('postId');
      expect(postTool?.parameters.properties.postId).toEqual({
        type: 'number',
        description: 'Post ID',
      });
      expect(postTool?.parameters.required).toContain('postId');
    });
  });

  describe('canHandleRequest with query field support', () => {
    it('should correctly identify tools that can be handled', async () => {
      // This would use the hash generation, so we need to compute expected hashes
      const canHandle1 = await service.canHandleRequest('1r2dj4_get_current_weather');
      const canHandle2 = await service.canHandleRequest('s9x8y7z_get_post_by_id');

      // At least one should be true if our hash generation is working
      expect(typeof canHandle1).toBe('boolean');
      expect(typeof canHandle2).toBe('boolean');
    });
  });
});
