import { readFileSync, readdirSync } from 'fs';
import { config } from 'dotenv';
import axios from 'axios';
import { Cache, createEnvCache } from '../utils/cache.js';
import { fetchWithDefaultTimeout } from '../utils/fetch-helper.js';
import agentService from './agent-service.js';

config();

export interface PromptsData {
  default: string;
  agents: Record<string, string>;
}

const promptsCache: Cache<PromptsData> = createEnvCache('PROMPTS', 600); // 10 minutes default

/**
 * Get prompt for a specific agent
 * @param agentName - Name of the agent to get prompt for
 * @returns Promise that resolves to the prompt text (agent-specific or default)
 * @throws Error if no prompts are available
 */
async function getPrompt(agentName: string): Promise<string> {
  const prompts = await retrievePrompts();
  
  // Return agent-specific prompt if available, otherwise default
  const prompt = prompts.agents[agentName] || prompts.default;
  
  if (!prompt) {
    throw new Error(`No prompts available. Default prompt is empty and no agent-specific prompt found for '${agentName}'.`);
  }
  
  return prompt;
}

/**
 * Fetch and parse prompts from configured source (no caching)
 * @returns PromptsData object with default and agent-specific prompts
 * @throws Error if environment variable is missing or if fetch fails
 */
async function fetchPrompts(): Promise<PromptsData> {
  const promptsSource = process.env.CUBICLER_PROMPTS_SOURCE;
  if (!promptsSource) {
    throw new Error('CUBICLER_PROMPTS_SOURCE is not defined in environment variables');
  }

  if (promptsSource.startsWith('http')) {
    return await fetchPromptsFromUrl(promptsSource);
  } else {
    return fetchPromptsFromFile(promptsSource);
  }
}

/**
 * Fetch prompts from URL source
 * @param promptsSource - URL to fetch prompts from
 * @returns PromptsData object with default and agent-specific prompts
 * @throws Error if unable to fetch prompts from URL
 */
async function fetchPromptsFromUrl(promptsSource: string): Promise<PromptsData> {
  const prompts: PromptsData = {
    default: '',
    agents: {}
  };

  const errors: string[] = [];

  // Try to fetch as single prompt first
  try {
    const response = await fetchWithDefaultTimeout(promptsSource);
    if (response.status >= 200 && response.status < 300) {
      prompts.default = response.data;
      // Try to fetch agent-specific prompts too
      const agentPrompts = await fetchAgentSpecificPromptsFromUrl(promptsSource, errors);
      prompts.agents = { ...prompts.agents, ...agentPrompts };
      return prompts;
    }
    errors.push(`Single file fetch failed: ${response.status} ${response.statusText}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      errors.push(`Single file fetch timeout: ${error.message}`);
    } else if (axios.isAxiosError(error)) {
      const status = error.response?.status || 0;
      const statusText = error.response?.statusText || 'Unknown error';
      errors.push(`Single file fetch failed: ${status} ${statusText}`);
    } else {
      errors.push(`Single file fetch error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Try to fetch multiple prompts
  try {
    // Try default prompt
    const defaultResponse = await fetchWithDefaultTimeout(`${promptsSource}/prompts.md`);
    if (defaultResponse.status >= 200 && defaultResponse.status < 300) {
      prompts.default = defaultResponse.data;
      // Try to fetch agent-specific prompts
      const agentPrompts = await fetchAgentSpecificPromptsFromUrl(promptsSource, errors);
      prompts.agents = { ...prompts.agents, ...agentPrompts };
      return prompts;
    }
    errors.push(`Multi-file fetch failed: ${defaultResponse.status} ${defaultResponse.statusText}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      errors.push(`Multi-file fetch timeout: ${error.message}`);
    } else if (axios.isAxiosError(error)) {
      const status = error.response?.status || 0;
      const statusText = error.response?.statusText || 'Unknown error';
      errors.push(`Multi-file fetch failed: ${status} ${statusText}`);
    } else {
      errors.push(`Multi-file fetch error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // If we get here, all attempts failed
  throw new Error(`Cannot fetch prompts from URL '${promptsSource}'. Errors: ${errors.join('; ')}`);
}

/**
 * Fetch agent-specific prompts from URL source
 * @param promptsSource - Base URL to fetch prompts from
 * @param errors - Array to collect any errors encountered
 * @returns Record of agent names to their specific prompts
 */
async function fetchAgentSpecificPromptsFromUrl(promptsSource: string, errors: string[]): Promise<Record<string, string>> {
  const agentPrompts: Record<string, string> = {};
  
  try {
    // Get list of available agent names
    const agentNames = await agentService.getAvailableAgents();
    
    // Try to fetch prompt for each agent
    for (const agentName of agentNames) {
      try {
        const url = `${promptsSource}/prompts.${agentName}.md`;
        const agentResponse = await fetchWithDefaultTimeout(url);
        if (agentResponse.status >= 200 && agentResponse.status < 300) {
          agentPrompts[agentName] = agentResponse.data;
        }
        // Don't add to errors if agent-specific prompt doesn't exist - it's optional
      } catch (error) {
        // Agent-specific prompts are optional, so we don't fail the entire operation
        // but we can log for debugging purposes if needed
      }
    }
  } catch (error) {
    // If we can't get agents list, that's not necessarily a fatal error for prompts
    errors.push(`Failed to fetch agents list for agent-specific prompts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return agentPrompts;
}

/**
 * Fetch prompts from local file/folder source
 * @param promptsSource - Local path to fetch prompts from
 * @returns PromptsData object with default and agent-specific prompts
 * @throws Error if unable to fetch prompts from local path
 */
function fetchPromptsFromFile(promptsSource: string): PromptsData {
  const prompts: PromptsData = {
    default: '',
    agents: {}
  };

  const errors: string[] = [];

  // Check if it's a single file
  try {
    const singlePrompt = readFileSync(promptsSource, 'utf-8');
    prompts.default = singlePrompt;
    return prompts;
  } catch (error) {
    errors.push(`Single file read error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Try as folder
  try {
    // Try default prompt
    prompts.default = readFileSync(`${promptsSource}/prompts.md`, 'utf-8');

    // Try to load agent-specific prompts
    // We'll scan for prompts.{agentName}.md files
    try {
      const files = readdirSync(promptsSource);
      for (const file of files) {
        if (file.startsWith('prompts.') && file.endsWith('.md') && file !== 'prompts.md') {
          const agentName = file.slice(8, -3); // Remove 'prompts.' prefix and '.md' suffix
          prompts.agents[agentName] = readFileSync(`${promptsSource}/${file}`, 'utf-8');
        }
      }
    } catch (error) {
      // Agent-specific prompts are optional, so we don't add this to errors
    }

    return prompts;
  } catch (error) {
    errors.push(`Folder read error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // If we get here, all attempts failed
  throw new Error(`Cannot fetch prompts from path '${promptsSource}'. Errors: ${errors.join('; ')}`);
}

/**
 * Load prompts from configured source with caching
 */
async function retrievePrompts(): Promise<PromptsData> {
  const cached = promptsCache.get('prompts_data');
  if (cached) {
    return cached;
  }

  const prompts = await fetchPrompts();
  
  // Cache the result
  promptsCache.set('prompts_data', prompts);
  
  return prompts;
}

/**
 * Clear prompts cache
 */
function clearCache(): void {
  promptsCache.clear();
}

export default { 
  getPrompt,
  fetchPrompts,
  clearCache
};
