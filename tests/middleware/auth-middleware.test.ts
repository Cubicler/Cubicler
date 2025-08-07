import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createEndpointJwtMiddleware } from '../../src/middleware/auth-middleware.js';
import { createJwtMiddleware } from '../../src/middleware/jwt-middleware.js';
import type { ServerConfigProviding } from '../../src/interface/server-config-providing.js';

// Mock the jwt-middleware module
vi.mock('../../src/middleware/jwt-middleware.js', () => ({
  createJwtMiddleware: vi.fn(),
}));

describe('Auth Middleware', () => {
  let mockServerConfigService: ServerConfigProviding;
  let mockJwtMiddleware: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    mockServerConfigService = {
      loadConfig: vi.fn(),
      getConfig: vi.fn(),
      getEndpointJwtConfig: vi.fn(),
      isJwtEnabled: vi.fn(),
      clearCache: vi.fn(),
    };

    mockJwtMiddleware = vi.fn();
    vi.mocked(createJwtMiddleware).mockReturnValue(mockJwtMiddleware);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createEndpointJwtMiddleware', () => {
    it('should return null when no JWT config is found for endpoint', async () => {
      vi.mocked(mockServerConfigService.getEndpointJwtConfig).mockReturnValue(null);

      const result = await createEndpointJwtMiddleware(mockServerConfigService, 'dispatch');

      expect(result).toBeNull();
      expect(mockServerConfigService.getEndpointJwtConfig).toHaveBeenCalledWith('dispatch');
      expect(createJwtMiddleware).not.toHaveBeenCalled();
    });

    it('should return JWT middleware when valid config is found', async () => {
      const jwtConfig = {
        secret: 'test-secret-key',
        audience: 'test-audience',
        issuer: 'test-issuer',
      };

      vi.mocked(mockServerConfigService.getEndpointJwtConfig).mockReturnValue(jwtConfig);

      const result = await createEndpointJwtMiddleware(mockServerConfigService, 'dispatch');

      expect(result).toBe(mockJwtMiddleware);
      expect(mockServerConfigService.getEndpointJwtConfig).toHaveBeenCalledWith('dispatch');
      expect(createJwtMiddleware).toHaveBeenCalledWith(jwtConfig);
    });

    it('should throw error when JWT config is missing secret', async () => {
      const invalidConfig = {
        audience: 'test-audience',
        issuer: 'test-issuer',
        // missing secret
      };

      vi.mocked(mockServerConfigService.getEndpointJwtConfig).mockReturnValue(invalidConfig);

      await expect(createEndpointJwtMiddleware(mockServerConfigService, 'mcp')).rejects.toThrow(
        `❌ [JWT Auth] Invalid JWT configuration for endpoint 'mcp': missing or invalid 'secret' property`
      );

      expect(mockServerConfigService.getEndpointJwtConfig).toHaveBeenCalledWith('mcp');
      expect(createJwtMiddleware).not.toHaveBeenCalled();
    });

    it('should throw error when JWT config has invalid secret type', async () => {
      const invalidConfig = {
        secret: 123, // should be string
        audience: 'test-audience',
      };

      vi.mocked(mockServerConfigService.getEndpointJwtConfig).mockReturnValue(invalidConfig);

      await expect(createEndpointJwtMiddleware(mockServerConfigService, 'webhook')).rejects.toThrow(
        `❌ [JWT Auth] Invalid JWT configuration for endpoint 'webhook': missing or invalid 'secret' property`
      );
    });

    it('should throw error when JWT config has empty secret', async () => {
      const invalidConfig = {
        secret: '', // empty string
        audience: 'test-audience',
      };

      vi.mocked(mockServerConfigService.getEndpointJwtConfig).mockReturnValue(invalidConfig);

      await expect(createEndpointJwtMiddleware(mockServerConfigService, 'sse')).rejects.toThrow(
        `❌ [JWT Auth] Invalid JWT configuration for endpoint 'sse': missing or invalid 'secret' property`
      );
    });

    it('should handle different endpoint names correctly', async () => {
      const endpoints = ['dispatch', 'mcp', 'webhook', 'sse'];

      for (const endpoint of endpoints) {
        const jwtConfig = {
          secret: `${endpoint}-secret`,
          audience: `${endpoint}-audience`,
        };

        vi.mocked(mockServerConfigService.getEndpointJwtConfig).mockReturnValue(jwtConfig);

        const result = await createEndpointJwtMiddleware(mockServerConfigService, endpoint);

        expect(result).toBe(mockJwtMiddleware);
        expect(mockServerConfigService.getEndpointJwtConfig).toHaveBeenCalledWith(endpoint);
        expect(createJwtMiddleware).toHaveBeenCalledWith(jwtConfig);
      }
    });

    it('should handle JWT config with additional valid properties', async () => {
      const jwtConfig = {
        secret: 'test-secret',
        audience: 'test-audience',
        issuer: 'test-issuer',
        algorithm: 'HS256',
        expiresIn: '1h',
      };

      vi.mocked(mockServerConfigService.getEndpointJwtConfig).mockReturnValue(jwtConfig);

      const result = await createEndpointJwtMiddleware(mockServerConfigService, 'dispatch');

      expect(result).toBe(mockJwtMiddleware);
      expect(createJwtMiddleware).toHaveBeenCalledWith(jwtConfig);
    });
  });
});
