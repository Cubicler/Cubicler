import jwt from 'jsonwebtoken';
import type { JWTPayload, Algorithm } from 'jsonwebtoken';
import type { JWTAuthConfig } from '../model/agents.js';
import { fetchWithDefaultTimeout } from './fetch-helper.js';

/**
 * JWT token with metadata
 */
export interface JWTToken {
  token: string;
  expiresAt: Date;
}

/**
 * JWT helper class for handling authentication tokens
 */
export class JWTHelper {
  private tokenCache = new Map<string, JWTToken>();

  /**
   * Get JWT token for authentication
   * @param config - JWT configuration
   * @returns Promise that resolves to JWT token
   * @throws Error if token cannot be obtained
   */
  async getToken(config: JWTAuthConfig): Promise<string> {
    if (config.token) {
      return config.token;
    }

    if (config.tokenUrl) {
      return this.getTokenFromUrl(config);
    }

    throw new Error('JWT configuration must provide either token or tokenUrl');
  }

  /**
   * Get token from OAuth2 endpoint
   * @param config - JWT configuration with OAuth2 details
   * @returns Promise that resolves to JWT token
   * @throws Error if token request fails
   */
  private async getTokenFromUrl(config: JWTAuthConfig): Promise<string> {
    if (!config.tokenUrl) {
      throw new Error('Token URL is required for OAuth2 flow');
    }

    const cacheKey = this.getCacheKey(config);
    const cachedToken = this.tokenCache.get(cacheKey);

    if (cachedToken && this.isTokenValid(cachedToken, config.refreshThreshold || 5)) {
      return cachedToken.token;
    }

    const newToken = await this.fetchNewToken(config);
    this.tokenCache.set(cacheKey, newToken);
    return newToken.token;
  }

  /**
   * Fetch new token from OAuth2 endpoint
   * @param config - JWT configuration
   * @returns Promise that resolves to JWT token with metadata
   * @throws Error if token request fails
   */
  private async fetchNewToken(config: JWTAuthConfig): Promise<JWTToken> {
    if (!config.tokenUrl || !config.clientId || !config.clientSecret) {
      throw new Error('OAuth2 flow requires tokenUrl, clientId, and clientSecret');
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });

    if (config.audience) {
      body.append('audience', config.audience);
    }

    try {
      const response = await fetchWithDefaultTimeout(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: body.toString(),
      });

      this.validateTokenResponse(response);
      const tokenData = response.data;

      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

      return {
        token: tokenData.access_token,
        expiresAt,
      };
    } catch (error) {
      throw new Error(`Failed to fetch JWT token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate token response from OAuth2 endpoint
   * @param response - HTTP response
   * @throws Error if response is invalid
   */
  private validateTokenResponse(response: { status: number; data: any }): void {
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Token endpoint responded with status ${response.status}`);
    }

    if (!response.data?.access_token || !response.data?.expires_in) {
      throw new Error('Invalid token response: missing access_token or expires_in');
    }
  }

  /**
   * Check if token is still valid
   * @param token - JWT token with metadata
   * @param refreshThresholdMinutes - Minutes before expiry to consider invalid
   * @returns True if token is valid
   */
  private isTokenValid(token: JWTToken, refreshThresholdMinutes: number): boolean {
    const now = new Date();
    const refreshTime = new Date(token.expiresAt);
    refreshTime.setMinutes(refreshTime.getMinutes() - refreshThresholdMinutes);
    
    return now < refreshTime;
  }

  /**
   * Generate cache key for token
   * @param config - JWT configuration
   * @returns Cache key string
   */
  private getCacheKey(config: JWTAuthConfig): string {
    return `${config.tokenUrl}:${config.clientId}:${config.audience || 'default'}`;
  }

  /**
   * Clear token cache
   */
  clearCache(): void {
    this.tokenCache.clear();
  }

  /**
   * Verify JWT token
   * @param token - JWT token to verify
   * @param secret - Secret key or public key for verification
   * @param options - JWT verification options
   * @returns Promise that resolves to JWT payload
   * @throws Error if token is invalid or verification fails
   */
  async verifyToken(
    token: string,
    secret: string,
    options: {
      issuer?: string;
      audience?: string;
      algorithms?: Algorithm[];
    } = {}
  ): Promise<JWTPayload> {
    if (!token || typeof token !== 'string') {
      throw new Error('JWT token must be a non-empty string');
    }

    if (!secret || typeof secret !== 'string') {
      throw new Error('JWT secret must be a non-empty string');
    }

    try {
      const payload = jwt.verify(token, secret, {
        algorithms: options.algorithms || ['HS256', 'RS256'] as Algorithm[],
        issuer: options.issuer,
        audience: options.audience,
      });

      if (typeof payload === 'string') {
        throw new Error('Invalid JWT payload format');
      }

      return payload as JWTPayload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error(`JWT verification failed: ${error.message}`);
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('JWT token has expired');
      }
      if (error instanceof jwt.NotBeforeError) {
        throw new Error('JWT token is not active yet');
      }
      throw error;
    }
  }

  /**
   * Decode JWT token without verification (for debugging/inspection)
   * @param token - JWT token to decode
   * @returns JWT payload or null if invalid
   */
  decodeToken(token: string): JWTPayload | null {
    try {
      const payload = jwt.decode(token);
      return typeof payload === 'object' && payload !== null ? payload : null;
    } catch {
      return null;
    }
  }
}

export default new JWTHelper();