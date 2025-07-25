import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import { config } from 'dotenv';
import { Cache, createEnvCache } from '../utils/cache.js';
import { fetchWithDefaultTimeout } from '../utils/fetch-helper.js';
import type { AgentsList } from '../model/types.js';

config();

const agentsCache: Cache<AgentsList> = createEnvCache('AGENTS_LIST', 600); // 10 minutes default

/**
 * Get list of available agents
 * @returns Array of agent names
 * @throws Error if no agents are available
 */
async function getAvailableAgents(): Promise<string[]> {
  const agents = await retrieveAgentsList();
  
  if (!agents.agents || agents.agents.length === 0) {
    throw new Error('No agents available in the agents list');
  }
  
  return agents.agents.map(agent => agent.name);
}

/**
 * Fetch and parse agents list from configured source (no caching)
 * @returns Complete AgentsList object
 * @throws Error if fetch fails or format is invalid
 */
async function fetchAgentsList(): Promise<AgentsList> {
  const agentsSource = process.env.CUBICLER_AGENTS_LIST;
  if (!agentsSource) {
    throw new Error('CUBICLER_AGENTS_LIST is not defined in environment variables');
  }

  let yamlText: string;
  
  if (agentsSource.startsWith('http')) {
    const response = await fetchWithDefaultTimeout(agentsSource);
    if (!response.ok) {
      throw new Error(`Failed to fetch agents list: ${response.statusText}`);
    }
    yamlText = await response.text();
  } else {
    yamlText = readFileSync(agentsSource, 'utf-8');
  }
  
  const agents = load(yamlText) as AgentsList;
  if (!agents || typeof agents !== 'object') {
    throw new Error('Invalid agents YAML format');
  }

  if (agents.kind !== 'agents') {
    throw new Error('Invalid agents YAML: kind must be "agents"');
  }
  
  return agents;
}

/**
 * Fetch agents list from configured source (no caching)
 * @returns Array of agent names
 * @throws Error if fetch fails or no agents are available
 */
async function fetchAvailableAgents(): Promise<string[]> {
  const agents = await fetchAgentsList();

  if (!agents.agents || agents.agents.length === 0) {
    throw new Error('No agents defined in configuration');
  }

  return agents.agents.map(agent => agent.name);
}

/**
 * Load agents list from configured source with caching
 */
async function retrieveAgentsList(): Promise<AgentsList> {
  const cached = agentsCache.get('agents_list');
  if (cached) {
    return cached;
  }

  const agents = await fetchAgentsList();
  
  // Cache the result
  agentsCache.set('agents_list', agents);
  
  return agents;
}

/**
 * Clear agents cache
 */
function clearCache(): void {
  agentsCache.clear();
}

/**
 * Get full agents list (for internal use)
 */
async function getAgents(): Promise<AgentsList> {
  return await retrieveAgentsList();
}

export default {
  getAvailableAgents,
  getAgents,
  fetchAvailableAgents,
  clearCache
};
