import axios from 'axios';
import promptService from './prompt-service.js';
import providerService from './provider-service.js';
import agentService from './agent-service.js';
import { fetchWithAgentTimeout } from '../utils/fetch-helper.js';
import type { Agent, AgentRequest, CallRequest, CallResponse } from '../model/types.js';

/**
 * Call an AI agent with the provided messages
 * @param agentName - Name of the agent to call (optional, uses first available if not provided)
 * @param request - The call request containing messages
 * @returns Promise that resolves to the agent's response
 * @throws Error if agent is not found or call fails
 */
async function callAgent(
  agentName: string | undefined,
  request: CallRequest
): Promise<CallResponse> {
  const agents = await agentService.getAgents();

  let selectedAgent: Agent;
  if (agentName) {
    // Find specific agent
    const foundAgent = agents.agents.find((agent) => agent.name === agentName);
    if (!foundAgent) {
      throw new Error(`Agent '${agentName}' not found`);
    }
    selectedAgent = foundAgent;
  } else {
    // Use first available agent as default
    if (!agents.agents || agents.agents.length === 0) {
      throw new Error('No agents available');
    }
    const firstAgent = agents.agents[0];
    if (!firstAgent) {
      throw new Error('No agents available');
    }
    selectedAgent = firstAgent;
  }

  const prompt = await promptService.getPrompt(selectedAgent.name);

  const providers = await providerService.getProviders();
  const providerInfo = providers.map((provider) => ({
    name: provider.name,
    description: provider.description,
  }));

  // Prepare request for the agent
  const agentRequest: AgentRequest = {
    prompt,
    providers: providerInfo,
    messages: request.messages,
  };

  // Call the agent
  try {
    const response = await fetchWithAgentTimeout(`${selectedAgent.endpoints}/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: agentRequest,
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Agent call failed: ${response.status} ${response.statusText}`);
    }

    const result = response.data;

    if (!result.message || typeof result.message !== 'string') {
      throw new Error('Invalid agent response format: missing or invalid message field');
    }

    return {
      message: result.message,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 0;
      const statusText = error.response?.statusText || 'Unknown error';
      throw new Error(`Agent call failed: ${status} ${statusText}`);
    }
    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        throw new Error(`Agent call timed out after 90 seconds`);
      }
      throw error;
    }
    throw new Error('Unknown error occurred during agent call');
  }
}

export default {
  callAgent,
};
