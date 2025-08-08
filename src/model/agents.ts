/**
 * Agent-specific type definitions for Cubicler
 */

/**
 * Base agent configuration (native format)
 */
export interface BaseAgentConfig {
  name: string;
  description: string;
  prompt?: string; // optional agent-specific prompt
  allowedServers?: string[]; // optional list of allowed server identifiers
  allowedTools?: string[]; // optional list of allowed tool names (format: "server.tool")
  restrictedServers?: string[]; // optional list of restricted server identifiers
  restrictedTools?: string[]; // optional list of restricted tool names (format: "server.tool")
}

/**
 * Agent authentication configuration (reuse from providers)
 */
export type AgentAuthConfig = import('./providers.js').ProviderJwtAuthConfig;

/**
 * HTTP agent configuration (native format)
 */
export interface HttpAgentConfig extends BaseAgentConfig {
  transport: 'http';
  url: string;
  headers?: Record<string, string>;
  auth?: {
    type: 'jwt';
    config: AgentAuthConfig;
  };
}

/**
 * SSE agent configuration (native format)
 */
export interface SseAgentConfig extends BaseAgentConfig {
  transport: 'sse';
  url: string;
  headers?: Record<string, string>;
  auth?: {
    type: 'jwt';
    config: AgentAuthConfig;
  };
}

/**
 * STDIO agent configuration (native format)
 */
export interface StdioAgentConfig extends BaseAgentConfig {
  transport: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

/**
 * Direct agent configuration for OpenAI (native format)
 */
export interface DirectOpenAIAgentConfig extends BaseAgentConfig {
  transport: 'direct';
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
 * Direct agent configuration (extensible for other providers)
 */
export type DirectAgentConfig = DirectOpenAIAgentConfig;

/**
 * Union type for all agent configurations (native format)
 */
export type AgentConfig = HttpAgentConfig | SseAgentConfig | StdioAgentConfig | DirectAgentConfig;

/**
 * Agents collection (native format - keyed by identifier)
 */
export type AgentsCollection = Record<string, AgentConfig>;

/**
 * Agents configuration (native format)
 */
export interface AgentsConfig {
  basePrompt?: string; // optional base prompt
  defaultPrompt?: string; // optional default prompt
  agents: AgentsCollection;
}

/**
 * @deprecated Legacy agent configuration for backward compatibility
 * Use AgentConfig with agentId separately instead
 */
export interface LegacyAgent {
  identifier: string;
  name: string;
  description: string;
  transport: 'http' | 'sse' | 'stdio' | 'direct';
  config: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- legacy compatibility
  prompt?: string;
  allowedServers?: string[];
  allowedTools?: string[];
  restrictedServers?: string[];
  restrictedTools?: string[];
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
