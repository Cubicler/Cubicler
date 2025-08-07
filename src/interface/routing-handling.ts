import type { Application, Request, Response } from 'express';

/**
 * Interface for handling HTTP routing and endpoint management
 */
export interface RoutingHandling {
  /**
   * Configure all routes on the Express application
   * @param _app - Express application instance
   */
  configureRoutes(_app: Application): Promise<void>;
}

/**
 * Interface for JWT middleware management
 */
export interface AuthMiddlewareProviding {
  /**
   * Create JWT middleware for a specific endpoint if configured
   * @param _endpoint - The endpoint name to check for JWT configuration
   * @returns JWT middleware function or null if not configured
   */
  createEndpointJwtMiddleware(
    _endpoint: string
  ): Promise<((_req: Request, _res: Response, _next: () => void) => void) | null>;
}
