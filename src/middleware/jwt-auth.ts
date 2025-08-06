import type { NextFunction, Request, Response } from 'express';
import type { Algorithm, JwtPayload } from 'jsonwebtoken';
import jwtHelper from '../utils/jwt-helper.js';

/**
 * JWT authentication configuration for server
 */
export interface ServerJwtConfig {
  secret: string; // Secret key or public key for verification
  issuer?: string; // Expected issuer
  audience?: string; // Expected audience
  algorithms?: string[]; // Allowed algorithms
  required?: boolean; // Whether JWT is required (default: true)
}

/**
 * Extended Request interface with JWT payload
 */
export interface AuthenticatedRequest extends Request {
  jwt?: JwtPayload;
  user?: {
    id: string;
    [key: string]: unknown;
  };
}

/**
 * Create JWT authentication middleware
 * @param config - JWT configuration for verification
 * @returns Express middleware function
 */
export function createJwtMiddleware(config: ServerJwtConfig) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        if (config.required !== false) {
          return res.status(401).json({
            error: 'Authorization header is required',
            code: 'MISSING_AUTH_HEADER',
          });
        }
        return next();
      }

      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Authorization header must use Bearer scheme',
          code: 'INVALID_AUTH_SCHEME',
        });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      if (!token) {
        return res.status(401).json({
          error: 'JWT token is required',
          code: 'MISSING_TOKEN',
        });
      }

      // Verify the JWT token
      const payload = await jwtHelper.verifyToken(token, config.secret, {
        issuer: config.issuer,
        audience: config.audience,
        algorithms: config.algorithms as Algorithm[],
      });

      // Attach JWT payload to request
      req.jwt = payload;

      // Extract user information if available
      if (payload.sub) {
        req.user = {
          id: payload.sub,
          email: payload.email,
          name: payload.name,
          roles: payload.roles,
          ...payload,
        };
      }

      console.log(`✅ [JWT Auth] Token verified for user: ${req.user?.id || 'unknown'}`);
      next();
    } catch (error) {
      console.error(`❌ [JWT Auth] Token verification failed:`, error);

      let errorMessage = 'JWT token verification failed';
      let errorCode = 'TOKEN_VERIFICATION_FAILED';

      if (error instanceof Error) {
        if (error.message.includes('expired')) {
          errorMessage = 'JWT token has expired';
          errorCode = 'TOKEN_EXPIRED';
        } else if (error.message.includes('invalid')) {
          errorMessage = 'JWT token is invalid';
          errorCode = 'TOKEN_INVALID';
        } else if (error.message.includes('issuer')) {
          errorMessage = 'JWT token issuer mismatch';
          errorCode = 'ISSUER_MISMATCH';
        } else if (error.message.includes('audience')) {
          errorMessage = 'JWT token audience mismatch';
          errorCode = 'AUDIENCE_MISMATCH';
        }
      }

      return res.status(401).json({
        error: errorMessage,
        code: errorCode,
      });
    }
  };
}

/**
 * Optional JWT middleware - allows requests without JWT but verifies if present
 * @param config - JWT configuration for verification
 * @returns Express middleware function
 */
export function createOptionalJwtMiddleware(config: Omit<ServerJwtConfig, 'required'>) {
  return createJwtMiddleware({ ...config, required: false });
}

/**
 * Extract JWT token from Authorization header
 * @param authHeader - Authorization header value
 * @returns JWT token or null if not found
 */
export function extractJwtToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  return token || null;
}
