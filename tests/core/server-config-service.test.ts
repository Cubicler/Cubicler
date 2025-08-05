import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServerConfigService } from '../../src/core/server-config-service.js';
import type { CubiclerConfig } from '../../src/model/server-config.js';
import * as configHelper from '../../src/utils/config-helper.js';

// Mock the config helper
vi.mock('../../src/utils/config-helper.js');

describe('ServerConfigService', () => {
  let configService: ServerConfigService;
  const mockConfigHelper = vi.mocked(configHelper);

  beforeEach(() => {
    vi.clearAllMocks();
    configService = new ServerConfigService();
    configService.clearCache();
    
    // Clear environment variables
    delete process.env.CUBICLER_PORT;
    delete process.env.CUBICLER_HOST;
    delete process.env.CUBICLER_SERVER_CONFIG;
  });

  describe('loadConfig', () => {
    it('should load default configuration when no config source specified', async () => {
      const config = await configService.loadConfig();

      expect(config).toEqual({
        port: 1503,
        host: '0.0.0.0',
      });
    });

    it('should use environment variables for default configuration', async () => {
      process.env.CUBICLER_PORT = '8080';
      process.env.CUBICLER_HOST = '127.0.0.1';

      const config = await configService.loadConfig();

      expect(config).toEqual({
        port: 8080,
        host: '127.0.0.1',
      });
    });

    it('should load configuration from file when CUBICLER_SERVER_CONFIG is set', async () => {
      process.env.CUBICLER_SERVER_CONFIG = 'config.yaml';
      
      const mockConfig: CubiclerConfig = {
        server: {
          port: 9000,
          host: 'localhost',
          auth: {
            jwt: {
              secret: 'test-secret',
              issuer: 'test-issuer',
            },
          },
          endpoints: {
            dispatch: {
              path: '/dispatch',
              auth: {
                jwt: {
                  secret: 'dispatch-secret',
                  audience: 'dispatch-api',
                },
              },
            },
          },
        },
      };

      mockConfigHelper.loadConfigFromSource.mockResolvedValue(mockConfig);

      const config = await configService.loadConfig();

      expect(mockConfigHelper.loadConfigFromSource).toHaveBeenCalledWith('CUBICLER_SERVER_CONFIG', 'server configuration');
      expect(config).toEqual({
        port: 9000,
        host: 'localhost',
        auth: {
          jwt: {
            secret: 'test-secret',
            issuer: 'test-issuer',
          },
        },
        endpoints: {
          dispatch: {
            path: '/dispatch',
            auth: {
              jwt: {
                secret: 'dispatch-secret',
                audience: 'dispatch-api',
              },
            },
          },
        },
      });
    });

    it('should merge file config with default config', async () => {
      process.env.CUBICLER_PORT = '7000';
      process.env.CUBICLER_SERVER_CONFIG = 'config.yaml';
      
      const mockConfig: CubiclerConfig = {
        server: {
          auth: {
            jwt: {
              secret: 'test-secret',
            },
          },
        },
      };

      mockConfigHelper.loadConfigFromSource.mockResolvedValue(mockConfig);

      const config = await configService.loadConfig();

      expect(config).toEqual({
        port: 7000, // From environment variable
        host: '0.0.0.0', // Default
        auth: {
          jwt: {
            secret: 'test-secret', // From file
          },
        },
      });
    });

    it('should fall back to default config when file loading fails', async () => {
      process.env.CUBICLER_SERVER_CONFIG = 'non-existent-config.yaml';
      
      mockConfigHelper.loadConfigFromSource.mockRejectedValue(new Error('File not found'));

      const config = await configService.loadConfig();

      expect(config).toEqual({
        port: 1503,
        host: '0.0.0.0',
      });
    });

    it('should cache configuration after first load', async () => {
      const config1 = await configService.loadConfig();
      const config2 = await configService.loadConfig();

      expect(config1).toBe(config2); // Same reference
      expect(mockConfigHelper.loadConfigFromSource).not.toHaveBeenCalled();
    });
  });

  describe('getConfig', () => {
    it('should return null when config is not loaded', () => {
      const config = configService.getConfig();
      expect(config).toBeNull();
    });

    it('should return cached config after loading', async () => {
      await configService.loadConfig();
      const config = configService.getConfig();
      
      expect(config).toBeTruthy();
      expect(config?.port).toBe(1503);
    });
  });

  describe('getEndpointJWTConfig', () => {
    it('should return null when no config is loaded', () => {
      const jwtConfig = configService.getEndpointJWTConfig('dispatch');
      expect(jwtConfig).toBeNull();
    });

    it('should return endpoint-specific JWT config', async () => {
      process.env.CUBICLER_SERVER_CONFIG = 'config.yaml';
      
      const mockConfig: CubiclerConfig = {
        server: {
          auth: {
            jwt: {
              secret: 'global-secret',
            },
          },
          endpoints: {
            dispatch: {
              path: '/dispatch',
              auth: {
                jwt: {
                  secret: 'dispatch-secret',
                  audience: 'dispatch-api',
                },
              },
            },
          },
        },
      };

      mockConfigHelper.loadConfigFromSource.mockResolvedValue(mockConfig);
      await configService.loadConfig();

      const jwtConfig = configService.getEndpointJWTConfig('dispatch');
      
      expect(jwtConfig).toEqual({
        secret: 'dispatch-secret',
        audience: 'dispatch-api',
      });
    });

    it('should fall back to global JWT config when endpoint-specific not found', async () => {
      process.env.CUBICLER_SERVER_CONFIG = 'config.yaml';
      
      const mockConfig: CubiclerConfig = {
        server: {
          auth: {
            jwt: {
              secret: 'global-secret',
              issuer: 'global-issuer',
            },
          },
        },
      };

      mockConfigHelper.loadConfigFromSource.mockResolvedValue(mockConfig);
      await configService.loadConfig();

      const jwtConfig = configService.getEndpointJWTConfig('mcp');
      
      expect(jwtConfig).toEqual({
        secret: 'global-secret',
        issuer: 'global-issuer',
      });
    });

    it('should return null when no JWT config is found', async () => {
      await configService.loadConfig();

      const jwtConfig = configService.getEndpointJWTConfig('dispatch');
      
      expect(jwtConfig).toBeNull();
    });
  });

  describe('isJWTEnabled', () => {
    it('should return false when no JWT config exists', async () => {
      await configService.loadConfig();

      const isEnabled = configService.isJWTEnabled('dispatch');
      
      expect(isEnabled).toBe(false);
    });

    it('should return true when endpoint-specific JWT config exists', async () => {
      process.env.CUBICLER_SERVER_CONFIG = 'config.yaml';
      
      const mockConfig: CubiclerConfig = {
        server: {
          endpoints: {
            dispatch: {
              path: '/dispatch',
              auth: {
                jwt: {
                  secret: 'dispatch-secret',
                },
              },
            },
          },
        },
      };

      mockConfigHelper.loadConfigFromSource.mockResolvedValue(mockConfig);
      await configService.loadConfig();

      const isEnabled = configService.isJWTEnabled('dispatch');
      
      expect(isEnabled).toBe(true);
    });

    it('should return true when global JWT config exists', async () => {
      process.env.CUBICLER_SERVER_CONFIG = 'config.yaml';
      
      const mockConfig: CubiclerConfig = {
        server: {
          auth: {
            jwt: {
              secret: 'global-secret',
            },
          },
        },
      };

      mockConfigHelper.loadConfigFromSource.mockResolvedValue(mockConfig);
      await configService.loadConfig();

      const isEnabled = configService.isJWTEnabled('mcp');
      
      expect(isEnabled).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('should clear cached configuration', async () => {
      await configService.loadConfig();
      expect(configService.getConfig()).toBeTruthy();

      configService.clearCache();
      expect(configService.getConfig()).toBeNull();
    });
  });
});