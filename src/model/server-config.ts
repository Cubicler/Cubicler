/**
 * Server configuration types for Cubicler
 */

/**
 * JWT authentication configuration for server endpoints
 */
export interface ServerJWTAuthConfig {
  secret: string;           // Secret key or public key for verification
  issuer?: string;          // Expected JWT issuer
  audience?: string;        // Expected JWT audience  
  algorithms?: string[];    // Allowed JWT algorithms (default: ['HS256', 'RS256'])
  required?: boolean;       // Whether JWT is required (default: true)
}

/**
 * Authentication configuration for server endpoints
 */
export interface ServerAuthConfig {
  jwt?: ServerJWTAuthConfig;
}

/**
 * Server endpoint configuration
 */
export interface ServerEndpointConfig {
  path: string;             // Endpoint path (e.g., '/dispatch', '/mcp')
  auth?: ServerAuthConfig;  // Authentication configuration for this endpoint
}

/**
 * Global server configuration
 */
export interface ServerConfig {
  port?: number;            // Server port (default: 1503)
  host?: string;           // Server host (default: '0.0.0.0')
  auth?: ServerAuthConfig; // Global authentication configuration
  endpoints?: {            // Per-endpoint configuration
    dispatch?: ServerEndpointConfig;
    mcp?: ServerEndpointConfig;
    [key: string]: ServerEndpointConfig | undefined;
  };
}

/**
 * Complete Cubicler configuration including server settings
 */
export interface CubiclerConfig {
  server?: ServerConfig;
  // Other config sections can be added here in the future
}