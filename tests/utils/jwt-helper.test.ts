import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { JWTHelper } from '../../src/utils/jwt-helper.js';
import type { JWTAuthConfig } from '../../src/model/agents.js';
import * as fetchHelper from '../../src/utils/fetch-helper.js';

// Mock the fetch helper
vi.mock('../../src/utils/fetch-helper.js');

describe('JWTHelper', () => {
  let jwtHelper: JWTHelper;
  const mockFetchWithDefaultTimeout = vi.mocked(fetchHelper.fetchWithDefaultTimeout);

  beforeEach(() => {
    vi.clearAllMocks();
    jwtHelper = new JWTHelper();
  });

  describe('getToken', () => {
    it('should return static token when provided', async () => {
      const config: JWTAuthConfig = {
        token: 'static-jwt-token',
      };

      const token = await jwtHelper.getToken(config);
      expect(token).toBe('static-jwt-token');
    });

    it('should fetch token from URL when tokenUrl is provided', async () => {
      const config: JWTAuthConfig = {
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'test-client',
        clientSecret: 'test-secret',
      };

      const mockTokenResponse = {
        status: 200,
        data: {
          access_token: 'oauth-jwt-token',
          expires_in: 3600,
        },
      };

      mockFetchWithDefaultTimeout.mockResolvedValue(mockTokenResponse as any);

      const token = await jwtHelper.getToken(config);
      expect(token).toBe('oauth-jwt-token');

      expect(mockFetchWithDefaultTimeout).toHaveBeenCalledWith(
        'https://auth.example.com/token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          data: 'grant_type=client_credentials&client_id=test-client&client_secret=test-secret',
        }
      );
    });

    it('should include audience in OAuth2 request when provided', async () => {
      const config: JWTAuthConfig = {
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        audience: 'api.example.com',
      };

      const mockTokenResponse = {
        status: 200,
        data: {
          access_token: 'oauth-jwt-token',
          expires_in: 3600,
        },
      };

      mockFetchWithDefaultTimeout.mockResolvedValue(mockTokenResponse as any);

      await jwtHelper.getToken(config);

      expect(mockFetchWithDefaultTimeout).toHaveBeenCalledWith(
        'https://auth.example.com/token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          data: 'grant_type=client_credentials&client_id=test-client&client_secret=test-secret&audience=api.example.com',
        }
      );
    });

    it('should cache and reuse valid tokens', async () => {
      const config: JWTAuthConfig = {
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        refreshThreshold: 5,
      };

      const mockTokenResponse = {
        status: 200,
        data: {
          access_token: 'cached-token',
          expires_in: 3600,
        },
      };

      mockFetchWithDefaultTimeout.mockResolvedValue(mockTokenResponse as any);

      // First call should fetch token
      const token1 = await jwtHelper.getToken(config);
      expect(token1).toBe('cached-token');
      expect(mockFetchWithDefaultTimeout).toHaveBeenCalledTimes(1);

      // Second call should use cached token
      const token2 = await jwtHelper.getToken(config);
      expect(token2).toBe('cached-token');
      expect(mockFetchWithDefaultTimeout).toHaveBeenCalledTimes(1);
    });

    it('should throw error when neither token nor tokenUrl is provided', async () => {
      const config: JWTAuthConfig = {};

      await expect(jwtHelper.getToken(config)).rejects.toThrow(
        'JWT configuration must provide either token or tokenUrl'
      );
    });

    it('should throw error when OAuth2 credentials are missing', async () => {
      const config: JWTAuthConfig = {
        tokenUrl: 'https://auth.example.com/token',
      };

      await expect(jwtHelper.getToken(config)).rejects.toThrow(
        'OAuth2 flow requires tokenUrl, clientId, and clientSecret'
      );
    });

    it('should throw error when token endpoint returns error', async () => {
      const config: JWTAuthConfig = {
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'test-client',
        clientSecret: 'test-secret',
      };

      mockFetchWithDefaultTimeout.mockResolvedValue({
        status: 400,
        data: { error: 'invalid_client' },
      } as any);

      await expect(jwtHelper.getToken(config)).rejects.toThrow(
        'Token endpoint responded with status 400'
      );
    });

    it('should throw error when token response is invalid', async () => {
      const config: JWTAuthConfig = {
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'test-client',
        clientSecret: 'test-secret',
      };

      mockFetchWithDefaultTimeout.mockResolvedValue({
        status: 200,
        data: { invalid: 'response' },
      } as any);

      await expect(jwtHelper.getToken(config)).rejects.toThrow(
        'Invalid token response: missing access_token or expires_in'
      );
    });

    it('should handle network errors', async () => {
      const config: JWTAuthConfig = {
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'test-client',
        clientSecret: 'test-secret',
      };

      const networkError = new Error('Network error');
      mockFetchWithDefaultTimeout.mockRejectedValue(networkError);

      await expect(jwtHelper.getToken(config)).rejects.toThrow(
        'Failed to fetch JWT token: Network error'
      );
    });
  });

  describe('clearCache', () => {
    it('should clear token cache', async () => {
      const config: JWTAuthConfig = {
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'test-client',
        clientSecret: 'test-secret',
      };

      const mockTokenResponse = {
        status: 200,
        data: {
          access_token: 'cached-token',
          expires_in: 3600,
        },
      };

      mockFetchWithDefaultTimeout.mockResolvedValue(mockTokenResponse as any);

      // First call should fetch and cache token
      await jwtHelper.getToken(config);
      expect(mockFetchWithDefaultTimeout).toHaveBeenCalledTimes(1);

      // Clear cache
      jwtHelper.clearCache();

      // Next call should fetch token again
      await jwtHelper.getToken(config);
      expect(mockFetchWithDefaultTimeout).toHaveBeenCalledTimes(2);
    });
  });

  describe('verifyToken', () => {
    const testSecret = 'test-secret';
    const testPayload = { sub: 'user123', exp: Math.floor(Date.now() / 1000) + 3600 };

    it('should verify valid JWT token', async () => {
      const token = jwt.sign(testPayload, testSecret);
      
      const result = await jwtHelper.verifyToken(token, testSecret);
      
      expect(result.sub).toBe('user123');
      expect(result.exp).toBe(testPayload.exp);
    });

    it('should verify token with specific issuer and audience', async () => {
      const payload = { ...testPayload, iss: 'test-issuer', aud: 'test-audience' };
      const token = jwt.sign(payload, testSecret);
      
      const result = await jwtHelper.verifyToken(token, testSecret, {
        issuer: 'test-issuer',
        audience: 'test-audience',
      });
      
      expect(result.iss).toBe('test-issuer');
      expect(result.aud).toBe('test-audience');
    });

    it('should throw error for invalid token', async () => {
      const invalidToken = 'invalid.jwt.token';
      
      await expect(jwtHelper.verifyToken(invalidToken, testSecret)).rejects.toThrow(
        'JWT verification failed'
      );
    });

    it('should throw error for expired token', async () => {
      const expiredPayload = { sub: 'user123', exp: Math.floor(Date.now() / 1000) - 3600 };
      const expiredToken = jwt.sign(expiredPayload, testSecret);
      
      await expect(jwtHelper.verifyToken(expiredToken, testSecret)).rejects.toThrow(
        'JWT verification failed: jwt expired'
      );
    });

    it('should throw error for wrong secret', async () => {
      const token = jwt.sign(testPayload, testSecret);
      
      await expect(jwtHelper.verifyToken(token, 'wrong-secret')).rejects.toThrow(
        'JWT verification failed'
      );
    });

    it('should throw error for issuer mismatch', async () => {
      const payload = { ...testPayload, iss: 'wrong-issuer' };
      const token = jwt.sign(payload, testSecret);
      
      await expect(jwtHelper.verifyToken(token, testSecret, {
        issuer: 'expected-issuer',
      })).rejects.toThrow('JWT verification failed');
    });

    it('should throw error for audience mismatch', async () => {
      const payload = { ...testPayload, aud: 'wrong-audience' };
      const token = jwt.sign(payload, testSecret);
      
      await expect(jwtHelper.verifyToken(token, testSecret, {
        audience: 'expected-audience',
      })).rejects.toThrow('JWT verification failed');
    });

    it('should throw error for empty token', async () => {
      await expect(jwtHelper.verifyToken('', testSecret)).rejects.toThrow(
        'JWT token must be a non-empty string'
      );
    });

    it('should throw error for empty secret', async () => {
      const token = jwt.sign(testPayload, testSecret);
      
      await expect(jwtHelper.verifyToken(token, '')).rejects.toThrow(
        'JWT secret must be a non-empty string'
      );
    });
  });

  describe('decodeToken', () => {
    const testSecret = 'test-secret';
    const testPayload = { sub: 'user123', exp: Math.floor(Date.now() / 1000) + 3600 };

    it('should decode valid JWT token without verification', () => {
      const token = jwt.sign(testPayload, testSecret);
      
      const result = jwtHelper.decodeToken(token);
      
      expect(result).toBeTruthy();
      expect(result!.sub).toBe('user123');
    });

    it('should decode expired token without verification', () => {
      const expiredPayload = { sub: 'user123', exp: Math.floor(Date.now() / 1000) - 3600 };
      const expiredToken = jwt.sign(expiredPayload, testSecret);
      
      const result = jwtHelper.decodeToken(expiredToken);
      
      expect(result).toBeTruthy();
      expect(result!.sub).toBe('user123');
    });

    it('should return null for invalid token', () => {
      const result = jwtHelper.decodeToken('invalid.token');
      
      expect(result).toBeNull();
    });

    it('should return null for empty token', () => {
      const result = jwtHelper.decodeToken('');
      
      expect(result).toBeNull();
    });
  });
});