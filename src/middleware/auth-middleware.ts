import type { Request, Response } from 'express';
import type { ServerConfigProviding } from '../interface/server-config-providing.js';
import { type ServerJwtConfig, createJwtMiddleware } from './jwt-middleware.js';

/**
 * Create JWT middleware for a specific endpoint if configured
 * @param serverConfigService - Service providing server configuration
 * @param endpoint - The endpoint name to check for JWT configuration
 * @returns JWT middleware function or null if not configured
 */
export async function createEndpointJwtMiddleware(
  serverConfigService: ServerConfigProviding,
  endpoint: string
): Promise<((_req: Request, _res: Response, _next: () => void) => void) | null> {
  const jwtConfig = serverConfigService.getEndpointJwtConfig(endpoint);
  if (!jwtConfig) {
    return null;
  }

  // Validate that the config has the required secret property
  if (!jwtConfig.secret || typeof jwtConfig.secret !== 'string') {
    throw new Error(
      `❌ [JWT Auth] Invalid JWT configuration for endpoint '${endpoint}': missing or invalid 'secret' property`
    );
  }

  console.log(`🔐 [Server] JWT authentication enabled for /${endpoint} endpoint`);
  return createJwtMiddleware(jwtConfig as unknown as ServerJwtConfig);
}
