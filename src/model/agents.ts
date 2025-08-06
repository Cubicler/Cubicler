/**
 * Agent-specific type definitions for Cubicler
 */

/**
 * Base agent configuration
 */
export interface BaseAgent {
  identifier: string; // lowercase, no spaces, only - or _
  name: string;
  description: string;
  prompt?: string; // optional agent-specific prompt
  allowedServers?: string[]; // optional list of allowed server identifiers
  allowedTools?: string[]; // optional list of allowed tool names (format: "server.tool")
  restrictedServers?: string[]; // optional list of restricted server identifiers
  restrictedTools?: string[]; // optional list of restricted tool names (format: "server.tool")
}

/**
 * JWT authentication configuration
 */
export interface JwtAuthConfig {
  token?: string; // Static token
  tokenUrl?: string; // URL to fetch token
  clientId?: string; // For OAuth2 client credentials
  clientSecret?: string; // For OAuth2 client credentials
  audience?: string; // JWT audience claim
  refreshThreshold?: number; // Minutes before expiry to refresh (default: 5)
}

/**
 * HTTP transport configuration
 */
export interface HttpTransportConfig {
  url: string;
  auth?: {
    type: 'jwt';
    config: JwtAuthConfig;
  };
}

/**
 * SSE transport configuration
 */
export interface SseTransportConfig {
  auth?: {
    type: 'jwt';
    config: JwtAuthConfig;
  };
}

/**
 * Stdio transport configuration
 */
export interface StdioTransportConfig {
  url: string; // command to execute
}

/**
 * Direct transport configuration for OpenAI
 */
export interface DirectOpenAIConfig {
  provider: 'openai';
  apiKey: string;
  model?:
    | 'gpt-4o'
    | 'gpt-4o-mini'
    | 'gpt-4'
    | 'gpt-4-turbo'
    | 'gpt-4-turbo-preview'
    | 'gpt-4-0125-preview'
    | 'gpt-4-1106-preview'
    | 'gpt-4-vision-preview'
    | 'gpt-3.5-turbo'
    | 'gpt-3.5-turbo-0125'
    | 'gpt-3.5-turbo-1106'
    | 'gpt-3.5-turbo-16k';
  summarizerModel?:
    | 'gpt-4o'
    | 'gpt-4o-mini'
    | 'gpt-4'
    | 'gpt-4-turbo'
    | 'gpt-4-turbo-preview'
    | 'gpt-4-0125-preview'
    | 'gpt-4-1106-preview'
    | 'gpt-4-vision-preview'
    | 'gpt-3.5-turbo'
    | 'gpt-3.5-turbo-0125'
    | 'gpt-3.5-turbo-1106'
    | 'gpt-3.5-turbo-16k';
  temperature?: number;
  sessionMaxTokens?: number;
  organization?: string;
  project?: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
}

/**
 * Direct transport configuration (extensible for other providers)
 */
export type DirectTransportConfig = DirectOpenAIConfig;

/**
 * Agent configuration with HTTP transport
 */
export interface HttpAgent extends BaseAgent {
  transport: 'http';
  config: HttpTransportConfig;
}

/**
 * Agent configuration with SSE transport
 */
export interface SseAgent extends BaseAgent {
  transport: 'sse';
  config: SseTransportConfig;
}

/**
 * Agent configuration with stdio transport
 */
export interface StdioAgent extends BaseAgent {
  transport: 'stdio';
  config: StdioTransportConfig;
}

/**
 * Agent configuration with direct transport
 */
export interface DirectAgent extends BaseAgent {
  transport: 'direct';
  config: DirectTransportConfig;
}

/**
 * Union type for all agent configurations
 */
export type Agent = HttpAgent | SseAgent | StdioAgent | DirectAgent;

/**
 * Agents configuration (JSON format)
 */
export interface AgentsConfig {
  basePrompt?: string; // optional base prompt
  defaultPrompt?: string; // optional default prompt
  agents: Agent[];
}

/**
 * Agent information response (without sensitive details like URL)
 * Used for public API responses and dispatch metadata
 */
export interface AgentInfo {
  identifier: string;
  name: string;
  description: string;
}
