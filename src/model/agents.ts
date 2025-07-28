/**
 * Agent-specific type definitions for Cubicler
 */

/**
 * Agent configuration from agents.json
 */
export interface Agent {
  identifier: string; // lowercase, no spaces, only - or _
  name: string;
  transport: 'http' | 'stdio'; // start with http
  url: string;
  description: string;
  prompt?: string; // optional agent-specific prompt
}

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


