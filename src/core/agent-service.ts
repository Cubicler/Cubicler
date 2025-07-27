import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import { config } from 'dotenv';
import axios from 'axios';
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
  console.log(`🤖 [AgentService] Getting available agents list`);
  
  const agents = await retrieveAgentsList();

  if (!agents.agents || agents.agents.length === 0) {
    console.error(`❌ [AgentService] No agents available in the agents list`);
    throw new Error('No agents available in the agents list');
  }

  const agentNames = agents.agents.map((agent) => agent.name);
  console.log(`✅ [AgentService] Found ${agentNames.length} agents: ${agentNames.join(', ')}`);
  
  return agentNames;
}

/**
 * Fetch and parse agents list from configured source (no caching)
 * @returns Complete AgentsList object
 * @throws Error if fetch fails or format is invalid
 */
async function fetchAgentsList(): Promise<AgentsList> {
  const agentsSource = process.env.CUBICLER_AGENTS_LIST;
  if (!agentsSource) {
    console.error('❌ [AgentService] CUBICLER_AGENTS_LIST environment variable not defined');
    throw new Error('CUBICLER_AGENTS_LIST is not defined in environment variables');
  }

  console.log(`🔄 [AgentService] Fetching agents list from: ${agentsSource}`);

  let yamlText: string;

  if (agentsSource.startsWith('http')) {
    console.log(`🌐 [AgentService] Fetching agents from URL: ${agentsSource}`);
    try {
      const response = await fetchWithDefaultTimeout(agentsSource);
      if (response.status < 200 || response.status >= 300) {
        console.error(`❌ [AgentService] HTTP error: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to fetch agents list: ${response.statusText}`);
      }
      console.log(`✅ [AgentService] Successfully fetched agents from URL`);
      yamlText = response.data;
    } catch (error) {
      console.error(`❌ [AgentService] Failed to fetch agents from URL:`, error instanceof Error ? error.message : 'Unknown error');
      if (axios.isAxiosError(error)) {
        const statusText = error.response?.statusText || 'Unknown error';
        throw new Error(`Failed to fetch agents list: ${statusText}`);
      }
      throw error;
    }
  } else {
    console.log(`📁 [AgentService] Reading agents from local file: ${agentsSource}`);
    yamlText = readFileSync(agentsSource, 'utf-8');
    console.log(`✅ [AgentService] Successfully read agents file`);
  }

  const agents = load(yamlText) as AgentsList;
  if (!agents || typeof agents !== 'object') {
    console.error(`❌ [AgentService] Invalid agents YAML format`);
    throw new Error('Invalid agents YAML format');
  }

  if (agents.kind !== 'agents') {
    console.error(`❌ [AgentService] Invalid agents YAML: kind is "${agents.kind}", expected "agents"`);
    throw new Error('Invalid agents YAML: kind must be "agents"');
  }

  console.log(`✅ [AgentService] Successfully parsed agents YAML with ${agents.agents?.length || 0} agents`);
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

  return agents.agents.map((agent) => agent.name);
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
  clearCache,
};
